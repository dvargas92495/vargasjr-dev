#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync, existsSync, statSync } from 'fs';

async function runHealthcheck(): Promise<void> {
  console.log('=== VargasJR Agent Health Check ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('');

  let hasAgentSession = false;
  let hasFatalError = false;

  console.log('--- Environment Information ---');
  const agentEnv = process.env.AGENT_ENVIRONMENT || 'unknown';
  const prNumber = process.env.PR_NUMBER || 'none';
  console.log(`Agent Environment: ${agentEnv}`);
  console.log(`PR Number: ${prNumber}`);
  console.log(`Working Directory: ${process.cwd()}`);
  console.log(`Node Version: ${process.version}`);
  console.log('');

  console.log('--- Environment Variables Check ---');
  const criticalEnvVars = ['AGENT_ENVIRONMENT', 'DATABASE_URL', 'VELLUM_API_KEY', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'];
  const optionalEnvVars = ['PR_NUMBER', 'GITHUB_TOKEN', 'NEON_API_KEY'];
  
  criticalEnvVars.forEach(varName => {
    const value = process.env[varName];
    console.log(`${varName}: ${value ? '✓ Set' : '✗ Missing'}`);
  });
  
  optionalEnvVars.forEach(varName => {
    const value = process.env[varName];
    console.log(`${varName}: ${value ? '✓ Set' : '- Not set'}`);
  });
  console.log('');

  console.log('--- Process Information ---');
  try {
    const psOutput = execSync('ps aux', { encoding: 'utf8' });
    console.log('All running processes:');
    console.log(psOutput);
    console.log('');
    
    const agentProcesses = psOutput.split('\n').filter(line => 
      line.includes('poetry run agent') || 
      line.includes('python') && line.includes('agent') ||
      line.includes('npm run browser:start') ||
      line.includes('node') && line.includes('browser')
    );
    
    if (agentProcesses.length > 0) {
      console.log('Agent-related processes found:');
      agentProcesses.forEach(process => console.log(`  ${process}`));
    } else {
      console.log('No agent-related processes found');
    }
    console.log('');
  } catch (error) {
    console.error(`Failed to get process information: ${error}`);
  }

  console.log('--- Screen Sessions ---');
  let screenOutput = '';
  try {
    screenOutput = execSync('screen -ls 2>/dev/null', { encoding: 'utf8' });
    console.log('Screen sessions:');
    console.log(screenOutput);
    
    hasAgentSession = screenOutput.includes('agent-') || screenOutput.includes('\tagent\t');
    console.log(`Agent screen session detected: ${hasAgentSession ? '✓ Yes' : '✗ No'}`);
  } catch (error) {
    console.log('No screen sessions found or screen command failed');
    console.log(`Screen error: ${error}`);
  }
  console.log('');

  console.log('--- System Resources ---');
  try {
    const memInfo = execSync('free -h', { encoding: 'utf8' });
    console.log('Memory usage:');
    console.log(memInfo);
    
    const diskInfo = execSync('df -h .', { encoding: 'utf8' });
    console.log('Disk usage (current directory):');
    console.log(diskInfo);
  } catch (error) {
    console.error(`Failed to get system resource information: ${error}`);
  }
  console.log('');

  console.log('--- File System Checks ---');
  const importantFiles = ['.env', 'error.log', 'browser-error.log', 'agent.log'];
  const importantDirs = ['node_modules', 'agent', 'browser'];
  
  importantFiles.forEach(file => {
    if (existsSync(file)) {
      try {
        const stats = statSync(file);
        console.log(`${file}: ✓ Exists (${stats.size} bytes, modified: ${stats.mtime.toISOString()})`);
      } catch (error) {
        console.log(`${file}: ✓ Exists (unable to read stats: ${error})`);
      }
    } else {
      console.log(`${file}: ✗ Missing`);
    }
  });
  
  importantDirs.forEach(dir => {
    if (existsSync(dir)) {
      console.log(`${dir}/: ✓ Exists`);
    } else {
      console.log(`${dir}/: ✗ Missing`);
    }
  });
  console.log('');

  console.log('--- Log File Analysis ---');
  if (existsSync('error.log')) {
    try {
      const errorLogContent = readFileSync('error.log', 'utf8').trim();
      if (errorLogContent.length > 0) {
        console.log(`Error Log (${errorLogContent.length} chars):`);
        const lines = errorLogContent.split('\n');
        if (lines.length > 20) {
          console.log('... (showing last 20 lines) ...');
          console.log(lines.slice(-20).join('\n'));
        } else {
          console.log(errorLogContent);
        }
        
        if (errorLogContent.toLowerCase().includes('fatal') || 
            errorLogContent.toLowerCase().includes('critical') ||
            errorLogContent.toLowerCase().includes('traceback')) {
          hasFatalError = true;
        }
      } else {
        console.log('Error log exists but is empty');
      }
    } catch (error) {
      console.log(`Failed to read error.log: ${error}`);
    }
  } else {
    console.log('No error.log file found');
  }

  if (existsSync('browser-error.log')) {
    try {
      const browserErrorContent = readFileSync('browser-error.log', 'utf8').trim();
      if (browserErrorContent.length > 0) {
        console.log(`Browser Error Log (${browserErrorContent.length} chars):`);
        const lines = browserErrorContent.split('\n');
        if (lines.length > 10) {
          console.log('... (showing last 10 lines) ...');
          console.log(lines.slice(-10).join('\n'));
        } else {
          console.log(browserErrorContent);
        }
      } else {
        console.log('Browser error log exists but is empty');
      }
    } catch (error) {
      console.log(`Failed to read browser-error.log: ${error}`);
    }
  } else {
    console.log('No browser-error.log file found');
  }

  if (existsSync('agent.log')) {
    try {
      const agentLogContent = readFileSync('agent.log', 'utf8').trim();
      if (agentLogContent.length > 0) {
        console.log(`Agent Log (${agentLogContent.length} chars):`);
        const lines = agentLogContent.split('\n');
        if (lines.length > 10) {
          console.log('... (showing last 10 lines) ...');
          console.log(lines.slice(-10).join('\n'));
        } else {
          console.log(agentLogContent);
        }
      } else {
        console.log('Agent log exists but is empty');
      }
    } catch (error) {
      console.log(`Failed to read agent.log: ${error}`);
    }
  } else {
    console.log('No agent.log file found');
  }
  console.log('');

  console.log('--- Network Connectivity ---');
  try {
    console.log('Testing GitHub API connectivity...');
    const githubTest = execSync('curl -s -o /dev/null -w "%{http_code}" https://api.github.com/user', { encoding: 'utf8', timeout: 10000 });
    console.log(`GitHub API response: ${githubTest}`);
  } catch (error) {
    console.log(`GitHub API test failed: ${error}`);
  }

  try {
    console.log('Testing Vellum API connectivity...');
    const vellumTest = execSync('curl -s -o /dev/null -w "%{http_code}" https://api.vellum.ai', { encoding: 'utf8', timeout: 10000 });
    console.log(`Vellum API response: ${vellumTest}`);
  } catch (error) {
    console.log(`Vellum API test failed: ${error}`);
  }
  console.log('');

  console.log('--- Installation Verification ---');
  try {
    const poetryVersion = execSync('poetry --version', { encoding: 'utf8' }).trim();
    console.log(`Poetry: ✓ ${poetryVersion}`);
  } catch (error) {
    console.log(`Poetry: ✗ Not available (${error})`);
  }

  try {
    const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
    console.log(`NPM: ✓ ${npmVersion}`);
  } catch (error) {
    console.log(`NPM: ✗ Not available (${error})`);
  }

  try {
    const pythonVersion = execSync('python --version', { encoding: 'utf8' }).trim();
    console.log(`Python: ✓ ${pythonVersion}`);
  } catch (error) {
    console.log(`Python: ✗ Not available (${error})`);
  }
  console.log('');

  console.log('--- Health Check Summary ---');
  if (hasAgentSession) {
    console.log('✓ Agent screen session is running');
    console.log('Status: HEALTHY');
    process.exit(0);
  } else if (hasFatalError) {
    console.log('✗ Fatal error detected in logs');
    console.log('Status: FATAL ERROR');
    process.exit(2);
  } else {
    console.log('✗ No agent screen session found');
    console.log('Status: UNHEALTHY');
    console.log('Common causes:');
    console.log('  - Agent process failed to start');
    console.log('  - Poetry dependencies not installed');
    console.log('  - Environment variables missing');
    console.log('  - Database connection issues');
    console.log('  - Screen session terminated unexpectedly');
    process.exit(1);
  }
}

runHealthcheck();
