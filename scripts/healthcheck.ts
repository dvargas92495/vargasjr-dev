#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';

async function runHealthcheck(): Promise<void> {
  try {
    const screenOutput = execSync('screen -ls 2>/dev/null', { encoding: 'utf8' });
    
    const hasAgentSession = screenOutput.includes('agent-') || screenOutput.includes('\tagent\t');
    
    if (hasAgentSession) {
      console.log('Agent running');
      return;
    }
    
    if (existsSync('error.log')) {
      const errorLogContent = readFileSync('error.log', 'utf8');
      console.log(errorLogContent);
      return;
    }
    
    if (existsSync('browser-error.log')) {
      const browserErrorLogContent = readFileSync('browser-error.log', 'utf8');
      console.log(browserErrorLogContent);
      return;
    }
    
    console.log('No Sockets found in /run/screen/S-root.');
    
  } catch (error) {
    if (existsSync('error.log')) {
      const errorLogContent = readFileSync('error.log', 'utf8');
      console.log(errorLogContent);
      return;
    }
    
    if (existsSync('browser-error.log')) {
      const browserErrorLogContent = readFileSync('browser-error.log', 'utf8');
      console.log(browserErrorLogContent);
      return;
    }
    
    console.log('No Sockets found in /run/screen/S-root.');
  }
}

runHealthcheck().catch((error) => {
  console.error('Healthcheck failed:', error);
  process.exit(1);
});
