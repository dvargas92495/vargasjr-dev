#!/usr/bin/env node

import { execSync, spawn } from 'child_process';
import { existsSync, writeFileSync, readFileSync, appendFileSync } from 'fs';
import { join } from 'path';

class LocalSetup {
  private envFilePath = join(process.cwd(), '.env');
  private dbPath = join(process.cwd(), 'local.db');

  async run(): Promise<void> {
    console.log('🚀 Setting up local development environment...\n');

    if (this.isPostgresUrlSet()) {
      console.log('✅ POSTGRES_URL is already set in environment variables.');
      console.log('Using PostgreSQL for database connection.');
      console.log('Local setup complete!');
      return;
    }

    console.log('📦 Setting up local SQLite database...');
    await this.setupSQLiteDatabase();
  }

  private isPostgresUrlSet(): boolean {
    const postgresUrl = process.env.POSTGRES_URL;
    if (postgresUrl) {
      console.log(`Found POSTGRES_URL: ${postgresUrl.replace(/:[^:@]*@/, ':***@')}`);
      return true;
    }
    return false;
  }

  private async setupSQLiteDatabase(): Promise<void> {
    try {
      if (existsSync(this.dbPath)) {
        console.log('✅ SQLite database file already exists.');
      } else {
        console.log('📝 SQLite database will be created automatically on first use.');
      }

      console.log('✅ Local SQLite database setup complete!');
      console.log(`Database file: ${this.dbPath}`);
      console.log('\n🎉 Local setup complete!');
      console.log('You can now run: npm run dev');
      
    } catch (error) {
      console.error('❌ Failed to set up SQLite database:', error);
      console.log('\n💡 SQLite setup should be automatic. If you encounter issues:');
      console.log('   1. Make sure you have Node.js installed');
      console.log('   2. Run: npm install');
      console.log('   3. Try running the app: npm run dev');
      process.exit(1);
    }
  }


  private addToEnvFile(key: string, value: string): void {
    let envContent = '';
    
    if (existsSync(this.envFilePath)) {
      envContent = readFileSync(this.envFilePath, 'utf8');
      
      const lines = envContent.split('\n');
      const existingLineIndex = lines.findIndex(line => line.startsWith(`${key}=`));
      
      if (existingLineIndex !== -1) {
        lines[existingLineIndex] = `${key}=${value}`;
        envContent = lines.join('\n');
        writeFileSync(this.envFilePath, envContent);
        return;
      }
    }

    const newLine = `${key}=${value}\n`;
    if (envContent && !envContent.endsWith('\n')) {
      appendFileSync(this.envFilePath, '\n' + newLine);
    } else {
      appendFileSync(this.envFilePath, newLine);
    }
  }
}

if (require.main === module) {
  const setup = new LocalSetup();
  setup.run().catch((error) => {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  });
}

export default LocalSetup;
