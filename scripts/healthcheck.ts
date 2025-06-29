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
    const errorLogContent = readFileSync('error.log', 'utf8');
    throw new Error(`Error Log: ${errorLogContent}`);
  }
  
  throw new Error('No Sockets found in /run/screen/S-root.');
}

runHealthcheck();
