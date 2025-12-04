import os
from datetime import datetime, timezone
from typing import Dict

import jwt
import requests

GITHUB_APP_ID = "1344447"


class GitHubAppAuthError(Exception):
    pass


def _get_private_key() -> str:
    raw_private_key = os.environ.get("GITHUB_PRIVATE_KEY", "")
    if not raw_private_key:
        raise GitHubAppAuthError(
            "GitHub App configuration missing. Required: GITHUB_PRIVATE_KEY"
        )
    return raw_private_key.replace("\\n", "\n")


def _generate_jwt() -> str:
    private_key = _get_private_key()
    now = int(datetime.now(timezone.utc).timestamp())
    payload = {
        "iat": now - 60,
        "exp": now + 600,
        "iss": GITHUB_APP_ID,
    }
    token = jwt.encode(payload, private_key, algorithm="RS256")
    if isinstance(token, bytes):
        token = token.decode("utf-8")
    return token


def _get_installation_id_for_repo(repo: str) -> str:
    """
    Fetch the installation ID for a given repository.
    
    Args:
        repo: Repository in 'owner/repo' format
        
    Returns:
        The installation ID as a string
        
    Raises:
        GitHubAppAuthError: If the installation cannot be found
    """
    jwt_token = _generate_jwt()
    response = requests.get(
        f"https://api.github.com/repos/{repo}/installation",
        headers={
            "Authorization": f"Bearer {jwt_token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        timeout=10,
    )
    if not response.ok:
        raise GitHubAppAuthError(
            f"Failed to get installation for repo {repo}: {response.status_code} {response.text}"
        )
    data = response.json()
    installation_id = data.get("id")
    if not installation_id:
        raise GitHubAppAuthError(
            f"Installation response for repo {repo} missing 'id' field"
        )
    return str(installation_id)


def _get_installation_token(repo: str) -> str:
    """
    Get an installation access token for a given repository.
    
    Args:
        repo: Repository in 'owner/repo' format
        
    Returns:
        The installation access token
    """
    installation_id = _get_installation_id_for_repo(repo)
    jwt_token = _generate_jwt()
    response = requests.post(
        f"https://api.github.com/app/installations/{installation_id}/access_tokens",
        headers={
            "Authorization": f"Bearer {jwt_token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        timeout=10,
    )
    if not response.ok:
        raise GitHubAppAuthError(
            f"Failed to get installation token: {response.status_code} {response.text}"
        )
    data = response.json()
    token = data.get("token")
    if not token:
        raise GitHubAppAuthError("Installation token response missing 'token' field")
    return token


def get_github_auth_headers(repo: str) -> Dict[str, str]:
    """
    Get authenticated headers for GitHub API requests.
    
    Args:
        repo: Repository in 'owner/repo' format. Used to determine which
              GitHub App installation to authenticate with.
              
    Returns:
        Dictionary of headers for authenticated GitHub API requests
    """
    token = _get_installation_token(repo)
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
