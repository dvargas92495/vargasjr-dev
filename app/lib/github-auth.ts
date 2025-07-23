import jwt from 'jsonwebtoken';

const GITHUB_APP_ID = '1344447';
const GITHUB_INSTALLATION_ID = '77219262';

interface GitHubAppConfig {
  appId: string;
  privateKey: string;
  installationId: string;
}

interface InstallationToken {
  token: string;
  expiresAt: string;
}

export class GitHubAppAuth {
  private config: GitHubAppConfig;

  constructor() {
    this.config = {
      appId: GITHUB_APP_ID,
      privateKey: process.env.GITHUB_PRIVATE_KEY || '',
      installationId: GITHUB_INSTALLATION_ID,
    };

    if (!this.config.privateKey) {
      throw new Error('GitHub App configuration missing. Required: GITHUB_PRIVATE_KEY');
    }
  }

  private generateJWT(): string {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iat: now - 60,
      exp: now + 600,
      iss: this.config.appId,
    };

    return jwt.sign(payload, this.config.privateKey, { algorithm: 'RS256' });
  }

  async getInstallationToken(): Promise<string> {
    const jwtToken = this.generateJWT();
    
    const response = await fetch(`https://api.github.com/app/installations/${this.config.installationId}/access_tokens`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get installation token: ${response.status} ${errorText}`);
    }

    const data: InstallationToken = await response.json();
    return data.token;
  }

  async getAuthenticatedHeaders(): Promise<Record<string, string>> {
    const token = await this.getInstallationToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }
}

export async function getGitHubAuthHeaders(): Promise<Record<string, string>> {
  const auth = new GitHubAppAuth();
  return auth.getAuthenticatedHeaders();
}
