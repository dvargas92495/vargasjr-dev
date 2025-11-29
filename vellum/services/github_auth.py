import os
from datetime import datetime, timezone
from typing import Dict

import jwt
import requests

GITHUB_APP_ID = "1344447"
GITHUB_INSTALLATION_ID = "77219262"


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


def _get_installation_token() -> str:
    jwt_token = _generate_jwt()
    response = requests.post(
        f"https://api.github.com/app/installations/{GITHUB_INSTALLATION_ID}/access_tokens",
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


def get_github_auth_headers() -> Dict[str, str]:
    token = _get_installation_token()
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
