#!/usr/bin/env node

import { getHealthCheckData, HealthCheckData } from '../server/health-check';

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
