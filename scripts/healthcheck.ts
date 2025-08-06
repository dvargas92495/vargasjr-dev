#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync, existsSync, statSync } from 'fs';

export interface HealthCheckData {
  status: 'healthy' | 'unhealthy' | 'fatal';
  timestamp: string;
  environment: {
    agentEnvironment: string;
    prNumber: string;
    workingDirectory: string;
    nodeVersion: string;
  };
  environmentVariables: {
    critical: Record<string, boolean>;
    optional: Record<string, boolean>;
  };
  processes: {
    agentProcesses: string[];
    hasAgentSession: boolean;
    screenOutput: string;
  };
  systemResources: {
    memory: string;
    disk: string;
  };
  fileSystem: {
    files: Record<string, any>;
    directories: Record<string, boolean>;
  };
  network: {
    github: string;
    vellum: string;
  };
  logs: {
    errorLog: any;
    browserErrorLog: any;
    outLog: any;
    agentLog: any;
    hasFatalError: boolean;
  };
  detailedReport: string;
}

export async function getHealthCheckData(): Promise<HealthCheckData> {
  let hasAgentSession = false;
  let hasFatalError = false;
  let detailedReport = '';

  const agentEnv = process.env.AGENT_ENVIRONMENT || 'unknown';
  const prNumber = process.env.PR_NUMBER || 'none';

  const criticalEnvVars = ['AGENT_ENVIRONMENT', 'DATABASE_URL', 'VELLUM_API_KEY', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'];
  const optionalEnvVars = ['PR_NUMBER', 'GITHUB_PRIVATE_KEY', 'NEON_API_KEY'];
  
  const criticalEnvStatus: Record<string, boolean> = {};
  criticalEnvVars.forEach(varName => {
    criticalEnvStatus[varName] = !!process.env[varName];
  });
  
  const optionalEnvStatus: Record<string, boolean> = {};
  optionalEnvVars.forEach(varName => {
    optionalEnvStatus[varName] = !!process.env[varName];
  });

  let agentProcesses: string[] = [];
  try {
    const psOutput = execSync('ps aux', { encoding: 'utf8' });
    
    agentProcesses = psOutput.split('\n').filter(line => 
      line.includes('poetry run agent') || 
      line.includes('python') && line.includes('agent') ||
      line.includes('npm run browser:start') ||
      line.includes('node') && line.includes('browser')
    );
  } catch (error) {
    detailedReport += `Failed to get process information: ${error}\n`;
  }

  let screenOutput = '';
  try {
    screenOutput = execSync('screen -ls 2>/dev/null', { encoding: 'utf8' });
    hasAgentSession = screenOutput.includes('agent-') || screenOutput.includes('\tagent\t');
  } catch (error) {
    screenOutput = `No screen sessions found or screen command failed: ${error}`;
  }

  detailedReport += '--- System Resources ---\n';
  let memInfo = '';
  let diskInfo = '';
  try {
    memInfo = execSync('free -h', { encoding: 'utf8' });
    detailedReport += 'Memory usage:\n';
    detailedReport += memInfo + '\n';
    
    diskInfo = execSync('df -h .', { encoding: 'utf8' });
    detailedReport += 'Disk usage (current directory):\n';
    detailedReport += diskInfo + '\n';
  } catch (error) {
    detailedReport += `Failed to get system resource information: ${error}\n`;
  }
  detailedReport += '\n';

  detailedReport += '--- File System Checks ---\n';
  const importantFiles = ['.env', 'error.log', 'browser-error.log', 'agent.log', 'out.log'];
  const importantDirs = ['node_modules', 'agent', 'browser'];
  
  const fileStatus: Record<string, any> = {};
  importantFiles.forEach(file => {
    if (existsSync(file)) {
      try {
        const stats = statSync(file);
        fileStatus[file] = {
          exists: true,
          size: stats.size,
          modified: stats.mtime.toISOString()
        };
        detailedReport += `${file}: ✓ Exists (${stats.size} bytes, modified: ${stats.mtime.toISOString()})\n`;
      } catch (error) {
        fileStatus[file] = { exists: true, error: String(error) };
        detailedReport += `${file}: ✓ Exists (unable to read stats: ${error})\n`;
      }
    } else {
      fileStatus[file] = { exists: false };
      detailedReport += `${file}: ✗ Missing\n`;
    }
  });
  
  const dirStatus: Record<string, boolean> = {};
  importantDirs.forEach(dir => {
    const exists = existsSync(dir);
    dirStatus[dir] = exists;
    detailedReport += `${dir}/: ${exists ? '✓ Exists' : '✗ Missing'}\n`;
  });
  detailedReport += '\n';

  detailedReport += '--- Network Connectivity ---\n';
  let githubTest = '';
  let vellumTest = '';
  try {
    detailedReport += 'Testing GitHub API connectivity...\n';
    githubTest = execSync('curl -s -o /dev/null -w "%{http_code}" https://api.github.com/user', { encoding: 'utf8', timeout: 10000 });
    detailedReport += `GitHub API response: ${githubTest}\n`;
  } catch (error) {
    githubTest = `Failed: ${error}`;
    detailedReport += `GitHub API test failed: ${error}\n`;
  }

  try {
    detailedReport += 'Testing Vellum API connectivity...\n';
    vellumTest = execSync('curl -s -o /dev/null -w "%{http_code}" https://api.vellum.ai', { encoding: 'utf8', timeout: 10000 });
    detailedReport += `Vellum API response: ${vellumTest}\n`;
  } catch (error) {
    vellumTest = `Failed: ${error}`;
    detailedReport += `Vellum API test failed: ${error}\n`;
  }
  detailedReport += '\n';

  const logAnalysis: any = {};

  if (existsSync('error.log')) {
    try {
      const errorLogContent = readFileSync('error.log', 'utf8').trim();
      if (errorLogContent.length > 0) {
        const lines = errorLogContent.split('\n');
        logAnalysis.errorLog = {
          exists: true,
          length: errorLogContent.length,
          lines: lines.length,
          lastLines: lines.length > 20 ? lines.slice(-20) : lines
        };
        
        if (errorLogContent.toLowerCase().includes('fatal') || 
            errorLogContent.toLowerCase().includes('critical') ||
            errorLogContent.toLowerCase().includes('traceback')) {
          hasFatalError = true;
        }
      } else {
        logAnalysis.errorLog = { exists: true, empty: true };
      }
    } catch (error) {
      logAnalysis.errorLog = { exists: true, error: String(error) };
    }
  } else {
    logAnalysis.errorLog = { exists: false };
  }

  if (existsSync('browser-error.log')) {
    try {
      const browserErrorContent = readFileSync('browser-error.log', 'utf8').trim();
      if (browserErrorContent.length > 0) {
        const lines = browserErrorContent.split('\n');
        logAnalysis.browserErrorLog = {
          exists: true,
          length: browserErrorContent.length,
          lines: lines.length,
          lastLines: lines.length > 10 ? lines.slice(-10) : lines
        };
      } else {
        logAnalysis.browserErrorLog = { exists: true, empty: true };
      }
    } catch (error) {
      logAnalysis.browserErrorLog = { exists: true, error: String(error) };
    }
  } else {
    logAnalysis.browserErrorLog = { exists: false };
  }

  if (existsSync('out.log')) {
    try {
      const outLogContent = readFileSync('out.log', 'utf8').trim();
      if (outLogContent.length > 0) {
        const lines = outLogContent.split('\n');
        logAnalysis.outLog = {
          exists: true,
          length: outLogContent.length,
          lines: lines.length,
          lastLines: lines.length > 20 ? lines.slice(-20) : lines
        };
      } else {
        logAnalysis.outLog = { exists: true, empty: true };
      }
    } catch (error) {
      logAnalysis.outLog = { exists: true, error: String(error) };
    }
  } else {
    logAnalysis.outLog = { exists: false };
  }

  if (existsSync('agent.log')) {
    try {
      const agentLogContent = readFileSync('agent.log', 'utf8').trim();
      if (agentLogContent.length > 0) {
        const lines = agentLogContent.split('\n');
        logAnalysis.agentLog = {
          exists: true,
          length: agentLogContent.length,
          lines: lines.length,
          lastLines: lines.length > 10 ? lines.slice(-10) : lines
        };
      } else {
        logAnalysis.agentLog = { exists: true, empty: true };
      }
    } catch (error) {
      logAnalysis.agentLog = { exists: true, error: String(error) };
    }
  } else {
    logAnalysis.agentLog = { exists: false };
  }

  let status: 'healthy' | 'unhealthy' | 'fatal';
  if (hasAgentSession) {
    status = 'healthy';
  } else if (hasFatalError) {
    status = 'fatal';
  } else {
    status = 'unhealthy';
  }

  return {
    status,
    timestamp: new Date().toISOString(),
    environment: {
      agentEnvironment: agentEnv,
      prNumber,
      workingDirectory: process.cwd(),
      nodeVersion: process.version
    },
    environmentVariables: {
      critical: criticalEnvStatus,
      optional: optionalEnvStatus
    },
    processes: {
      agentProcesses,
      hasAgentSession,
      screenOutput
    },
    systemResources: {
      memory: memInfo,
      disk: diskInfo
    },
    fileSystem: {
      files: fileStatus,
      directories: dirStatus
    },
    network: {
      github: githubTest,
      vellum: vellumTest
    },
    logs: {
      ...logAnalysis,
      hasFatalError
    },
    detailedReport
  };
}

async function runHealthcheck(): Promise<void> {
  try {
    const healthData = await getHealthCheckData();
    
    console.log('=== VargasJR Agent Health Check ===');
    console.log(`Timestamp: ${healthData.timestamp}`);
    console.log('');

    console.log('--- Environment Information ---');
    console.log(`Agent Environment: ${healthData.environment.agentEnvironment}`);
    console.log(`PR Number: ${healthData.environment.prNumber}`);
    console.log(`Working Directory: ${healthData.environment.workingDirectory}`);
    console.log(`Node Version: ${healthData.environment.nodeVersion}`);
    console.log('');

    console.log('--- Environment Variables Check ---');
    Object.entries(healthData.environmentVariables.critical).forEach(([varName, isSet]) => {
      console.log(`${varName}: ${isSet ? '✓ Set' : '✗ Missing'}`);
    });
    
    Object.entries(healthData.environmentVariables.optional).forEach(([varName, isSet]) => {
      console.log(`${varName}: ${isSet ? '✓ Set' : '- Not set'}`);
    });
    console.log('');

    console.log('--- Process Information ---');
    if (healthData.processes.agentProcesses.length > 0) {
      console.log('Agent-related processes found:');
      healthData.processes.agentProcesses.forEach(process => console.log(`  ${process}`));
    } else {
      console.log('No agent-related processes found');
    }
    console.log('');

    console.log('--- Screen Sessions ---');
    console.log('Screen sessions:');
    console.log(healthData.processes.screenOutput);
    console.log(`Agent screen session detected: ${healthData.processes.hasAgentSession ? '✓ Yes' : '✗ No'}`);
    console.log('');

    console.log('--- Log File Analysis ---');
    if (healthData.logs.errorLog?.exists) {
      if (healthData.logs.errorLog.empty) {
        console.log('Error log exists but is empty');
      } else if (healthData.logs.errorLog.error) {
        console.log(`Failed to read error.log: ${healthData.logs.errorLog.error}`);
      } else {
        console.log(`Error Log (${healthData.logs.errorLog.length} chars):`);
        if (healthData.logs.errorLog.lines > 20) {
          console.log('... (showing last 20 lines) ...');
        }
        console.log(healthData.logs.errorLog.lastLines.join('\n'));
      }
    } else {
      console.log('No error.log file found');
    }

    if (healthData.logs.browserErrorLog?.exists) {
      if (healthData.logs.browserErrorLog.empty) {
        console.log('Browser error log exists but is empty');
      } else if (healthData.logs.browserErrorLog.error) {
        console.log(`Failed to read browser-error.log: ${healthData.logs.browserErrorLog.error}`);
      } else {
        console.log(`Browser Error Log (${healthData.logs.browserErrorLog.length} chars):`);
        if (healthData.logs.browserErrorLog.lines > 10) {
          console.log('... (showing last 10 lines) ...');
        }
        console.log(healthData.logs.browserErrorLog.lastLines.join('\n'));
      }
    } else {
      console.log('No browser-error.log file found');
    }

    if (healthData.logs.outLog?.exists) {
      if (healthData.logs.outLog.empty) {
        console.log('Output log exists but is empty');
      } else if (healthData.logs.outLog.error) {
        console.log(`Failed to read out.log: ${healthData.logs.outLog.error}`);
      } else {
        console.log(`Output Log (${healthData.logs.outLog.length} chars):`);
        if (healthData.logs.outLog.lines > 20) {
          console.log('... (showing last 20 lines) ...');
        }
        console.log(healthData.logs.outLog.lastLines.join('\n'));
      }
    } else {
      console.log('No out.log file found');
    }

    if (healthData.logs.agentLog?.exists) {
      if (healthData.logs.agentLog.empty) {
        console.log('Agent log exists but is empty');
      } else if (healthData.logs.agentLog.error) {
        console.log(`Failed to read agent.log: ${healthData.logs.agentLog.error}`);
      } else {
        console.log(`Agent Log (${healthData.logs.agentLog.length} chars):`);
        if (healthData.logs.agentLog.lines > 10) {
          console.log('... (showing last 10 lines) ...');
        }
        console.log(healthData.logs.agentLog.lastLines.join('\n'));
      }
    } else {
      console.log('No agent.log file found');
    }
    console.log('');

    console.log('--- Health Check Summary ---');
    console.log(`Detailed report saved to memory (${healthData.detailedReport.length} chars)`);
    
    if (healthData.status === 'healthy') {
      console.log('✅ HEALTHY: Agent is running');
      process.exit(0);
    } else if (healthData.status === 'fatal') {
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
  } catch (error) {
    console.error('Health check failed:', error);
    process.exit(2);
  }
}

runHealthcheck();
