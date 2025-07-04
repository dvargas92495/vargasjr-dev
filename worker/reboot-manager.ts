import * as fs from 'fs';
import * as path from 'path';
import { execSync, spawn } from 'child_process';
import { getVersion, createFileLogger, Logger } from './utils';

interface GitHubRelease {
  tag_name: string;
}

export async function getLatestVersion(): Promise<string | null> {
  const releaseUrl = "https://api.github.com/repos/dvargas92495/vargasjr-dev/releases/latest";
  
  try {
    const response = await fetch(releaseUrl);
    
    if (response.status !== 200) {
      console.log(`Failed to check for updates: ${response.status}`);
      return null;
    }

    const releaseData = await response.json() as GitHubRelease;
    
    if (!releaseData || typeof releaseData !== 'object') {
      console.log(`Unexpected release data: ${typeof releaseData}`);
      return null;
    }

    const latestVersion = releaseData.tag_name;
    if (typeof latestVersion !== 'string') {
      console.log(`Failed to parse release data for tag name: ${JSON.stringify(releaseData)}`);
      return null;
    }

    return latestVersion.replace('v', '');
  } catch (error) {
    console.log(`Failed to check for updates: ${error}`);
    return null;
  }
}

export async function rebootAgent(targetVersion?: string, logger?: Logger): Promise<boolean> {
  const currentVersion = getVersion();
  const rebootLogger = logger || createFileLogger('reboot', 'reboot.log', currentVersion);
  
  rebootLogger.info(`Starting reboot process from version ${currentVersion}`);
  
  if (!targetVersion) {
    rebootLogger.info('Checking for latest version...');
    const latestVersion = await getLatestVersion();
    if (!latestVersion) {
      rebootLogger.error('Failed to get latest version');
      return false;
    }
    targetVersion = latestVersion;
  }
  
  rebootLogger.info(`Target version: ${targetVersion}`);
  
  if (targetVersion === currentVersion) {
    rebootLogger.info(`Already on target version: ${targetVersion}`);
    return true;
  }

  try {
    rebootLogger.info(`Rebooting to version: ${targetVersion}`);
    process.chdir('..');

    try {
      execSync('rm -Rf vargasjr_dev_agent-*', { stdio: 'inherit' });
      rebootLogger.info('Removed old agent');
    } catch (error) {
      rebootLogger.error('Failed to remove old agent');
      return false;
    }

    try {
      execSync('yes | rm -rf ~/.cache/pypoetry/virtualenvs/*', { stdio: 'inherit' });
      rebootLogger.info('Removed old virtualenvs');
    } catch (error) {
      rebootLogger.error('Failed to remove old virtualenvs');
      return false;
    }

    const downloadUrl = `https://github.com/dvargas92495/vargasjr-dev/releases/download/v${targetVersion}/vargasjr_dev_agent-${targetVersion}.tar.gz`;
    try {
      execSync(`wget ${downloadUrl}`, { stdio: 'inherit' });
      rebootLogger.info('Downloaded new agent');
    } catch (error) {
      rebootLogger.error('Failed to download new agent');
      return false;
    }

    try {
      execSync(`tar -xzf vargasjr_dev_agent-${targetVersion}.tar.gz`, { stdio: 'inherit' });
      rebootLogger.info('Extracted new agent');
    } catch (error) {
      rebootLogger.error('Failed to extract new agent');
      return false;
    }

    process.chdir(`vargasjr_dev_agent-${targetVersion}`);

    try {
      execSync('cp ../.env .', { stdio: 'inherit' });
      rebootLogger.info('Copied .env file');
    } catch (error) {
      rebootLogger.error('Failed to copy .env file');
      return false;
    }

    try {
      execSync('npm install', { stdio: 'inherit' });
      rebootLogger.info('Installed dependencies');
    } catch (error) {
      rebootLogger.error('Failed to install dependencies');
      return false;
    }

    const screenName = `agent-${targetVersion.replace(/\./g, '-')}`;
    spawn('screen', ['-dmS', screenName, 'bash', '-c', 'npm run agent:start 2> error.log'], {
      detached: true,
      stdio: 'ignore'
    });
    rebootLogger.info(`Started new agent in screen session: ${screenName}`);
    
    return true;
    
  } catch (error) {
    rebootLogger.error(`Failed to reboot to version: ${targetVersion} - ${error}`);
    return false;
  }
}

export async function checkAndRebootIfNeeded(logger: Logger): Promise<void> {
  const currentVersion = getVersion();
  const latestVersion = await getLatestVersion();
  
  if (!latestVersion) {
    logger.error('Failed to get latest version');
    return;
  }
  
  if (latestVersion === currentVersion) {
    logger.info(`No new version available: ${latestVersion}`);
    return;
  }
  
  logger.info(`New version available: ${latestVersion}`);
  const success = await rebootAgent(latestVersion, logger);
  if (success) {
    process.exit(0);
  }
}
