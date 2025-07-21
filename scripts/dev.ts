#!/usr/bin/env node

import { spawn } from 'child_process';
import LocalSetup from './setup-local';

async function main() {
  console.log('🚀 Starting development server...\n');

  if (!(process.env.NEON_URL || process.env.POSTGRES_URL)) {
    console.log('⚠️  POSTGRES_URL not found in environment variables.');
    console.log('🔧 Running local setup to configure PostgreSQL...\n');
    
    try {
      const setup = new LocalSetup();
      await setup.run();
      console.log('\n✅ Local setup completed successfully!');
    } catch (error) {
      console.error('❌ Local setup failed:', error);
      process.exit(1);
    }
  } else {
    console.log('✅ POSTGRES_URL found, using existing database configuration.');
  }

  console.log('\n🌟 Starting Next.js development server...\n');
  
  const nextProcess = spawn('npx', ['next', 'dev', '--turbopack'], {
    stdio: 'inherit',
    env: process.env
  });

  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down development server...');
    nextProcess.kill('SIGINT');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    nextProcess.kill('SIGTERM');
    process.exit(0);
  });

  nextProcess.on('exit', (code) => {
    process.exit(code || 0);
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Development server failed to start:', error);
    process.exit(1);
  });
}
