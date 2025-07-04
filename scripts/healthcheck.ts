#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';

async function runHealthcheck(): Promise<void> {
  let screenOutput = '';
  
  try {
    screenOutput = execSync('screen -ls 2>/dev/null', { encoding: 'utf8' });
  } catch (error) {
    screenOutput = '';
  }
  
  const hasAgentSession = screenOutput.includes('agent-') || screenOutput.includes('\tagent\t');
  
  if (hasAgentSession) {
    console.log('Agent running');
    return;
  }
  
  if (existsSync('error.log')) {
    const errorLogContent = readFileSync('error.log', 'utf8').trim();
    if (errorLogContent.length > 0) {
      console.error(`Error Log: ${errorLogContent}`);
      process.exit(2);
    }
  }
  
  console.error('No Sockets found in /run/screen/S-root.');
  process.exit(1);
}

runHealthcheck();
