#!/usr/bin/env node

import { AgentRunner } from './runner';
import { getVersion } from './utils';

function agent(): void {
  const agentRunner = new AgentRunner({ sleepTime: 5 });
  agentRunner.run();
}

function main(): void {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'agent') {
    agent();
  } else if (command === 'reboot') {
    const versionArg = args.find(arg => arg.startsWith('--version='));
    const checkOnlyArg = args.includes('--check-only');
    
    if (checkOnlyArg) {
      const currentVersion = getVersion();
      console.log(`Current version: ${currentVersion}`);
      console.log('Latest version: unknown');
      console.log('No update needed');
      process.exit(0);
    }
    
    console.log('Reboot functionality not implemented yet');
    process.exit(1);
  } else {
    console.log('Usage: cli.ts [agent|reboot] [options]');
    process.exit(1);
  }
}

function reboot(): void {
  const args = process.argv.slice(2);
  const versionArg = args.find(arg => arg.startsWith('--version='));
  const checkOnlyArg = args.includes('--check-only');
  
  if (checkOnlyArg) {
    const currentVersion = getVersion();
    console.log(`Current version: ${currentVersion}`);
    console.log('Latest version: unknown');
    console.log('No update needed');
    process.exit(0);
  }
  
  console.log('Reboot functionality not implemented yet');
  process.exit(1);
}

if (require.main === module) {
  main();
}

export { agent, main, reboot };
