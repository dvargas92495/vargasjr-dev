#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync, existsSync, statSync } from 'fs';

async function runHealthcheck(): Promise<void> {
  console.log('=== VargasJR Agent Health Check ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('');

  let hasAgentSession = false;
  let hasFatalError = false;
  let detailedReport = '';

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
  const optionalEnvVars = ['PR_NUMBER', 'GITHUB_PRIVATE_KEY', 'NEON_API_KEY'];
  
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
  } catch (error) {
    console.error(`Failed to get process information: ${error}`);
  }
  console.log('');

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

  detailedReport += '--- System Resources ---\n';
  try {
    const memInfo = execSync('free -h', { encoding: 'utf8' });
    detailedReport += 'Memory usage:\n';
    detailedReport += memInfo + '\n';
    
    const diskInfo = execSync('df -h .', { encoding: 'utf8' });
    detailedReport += 'Disk usage (current directory):\n';
    detailedReport += diskInfo + '\n';
  } catch (error) {
    detailedReport += `Failed to get system resource information: ${error}\n`;
  }
  detailedReport += '\n';

  detailedReport += '--- File System Checks ---\n';
  const importantFiles = ['.env', 'error.log', 'browser-error.log', 'agent.log', 'out.log'];
  const importantDirs = ['node_modules', 'agent', 'browser'];
  
  importantFiles.forEach(file => {
    if (existsSync(file)) {
      try {
        const stats = statSync(file);
        detailedReport += `${file}: ✓ Exists (${stats.size} bytes, modified: ${stats.mtime.toISOString()})\n`;
      } catch (error) {
        detailedReport += `${file}: ✓ Exists (unable to read stats: ${error})\n`;
      }
    } else {
      detailedReport += `${file}: ✗ Missing\n`;
    }
  });
  
  importantDirs.forEach(dir => {
    if (existsSync(dir)) {
      detailedReport += `${dir}/: ✓ Exists\n`;
    } else {
      detailedReport += `${dir}/: ✗ Missing\n`;
    }
  });
  detailedReport += '\n';

  detailedReport += '--- Network Connectivity ---\n';
  try {
    detailedReport += 'Testing GitHub API connectivity...\n';
    const githubTest = execSync('curl -s -o /dev/null -w "%{http_code}" https://api.github.com/user', { encoding: 'utf8', timeout: 10000 });
    detailedReport += `GitHub API response: ${githubTest}\n`;
  } catch (error) {
    detailedReport += `GitHub API test failed: ${error}\n`;
  }

  try {
    detailedReport += 'Testing Vellum API connectivity...\n';
    const vellumTest = execSync('curl -s -o /dev/null -w "%{http_code}" https://api.vellum.ai', { encoding: 'utf8', timeout: 10000 });
    detailedReport += `Vellum API response: ${vellumTest}\n`;
  } catch (error) {
    detailedReport += `Vellum API test failed: ${error}\n`;
  }
  detailedReport += '\n';

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

  if (existsSync('out.log')) {
    try {
      const outLogContent = readFileSync('out.log', 'utf8').trim();
      if (outLogContent.length > 0) {
        console.log(`Output Log (${outLogContent.length} chars):`);
        const lines = outLogContent.split('\n');
        if (lines.length > 20) {
          console.log('... (showing last 20 lines) ...');
          console.log(lines.slice(-20).join('\n'));
        } else {
          console.log(outLogContent);
        }
      } else {
        console.log('Output log exists but is empty');
      }
    } catch (error) {
      console.log(`Failed to read out.log: ${error}`);
    }
  } else {
    console.log('No out.log file found');
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


  console.log('--- Health Check Summary ---');
  console.log(`Detailed report saved to memory (${detailedReport.length} chars)`);
  
  if (hasAgentSession) {
    console.log('✅ HEALTHY: Agent is running');
    process.exit(0);
  } else if (hasFatalError) {
    console.log('💀 FATAL ERROR: Critical errors found in logs');
    console.log('Common causes:');
    console.log('  - Missing or invalid environment variables');
    console.log('  - Database connection issues');
    console.log('  - Poetry/Python environment problems');
    console.log('  - Permission issues');
    process.exit(2);
  } else {
    console.log('⚠️  UNHEALTHY: Agent not running');
    console.log('Common causes:');
    console.log('  - Agent process crashed or failed to start');
    console.log('  - Screen session terminated unexpectedly');
    console.log('  - Missing dependencies or configuration');
    console.log('  - Resource constraints (memory/disk)');
    process.exit(1);
  }
}

runHealthcheck();
