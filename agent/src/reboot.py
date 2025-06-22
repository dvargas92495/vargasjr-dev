#!/usr/bin/env python3

import argparse
import logging
import os
import subprocess
import sys
from pathlib import Path
from typing import Optional

import requests


def get_version() -> str:
    """Get the current version from pyproject.toml"""
    with open("pyproject.toml", "r") as f:
        for line in f:
            if line.startswith("version = "):
                return line.split("=")[1].strip().strip('"')
    return "unknown"


def setup_logger(version: str) -> logging.Logger:
    """Set up logging for the reboot script"""
    log_dir = Path.home() / ".local" / "var" / "log" / "vargas-jr" / f"v{version}"
    log_dir.mkdir(exist_ok=True, parents=True)

    logger = logging.getLogger("reboot")
    logger.setLevel(logging.INFO)
    
    if not logger.handlers:
        log_file = log_dir / "reboot.log"
        file_handler = logging.FileHandler(str(log_file))
        formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
        
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)
    
    return logger


def get_latest_version() -> Optional[str]:
    """Fetch the latest version from GitHub releases"""
    release_url = "https://api.github.com/repos/dvargas92495/vargasjr-dev/releases/latest"
    try:
        response = requests.get(release_url)
    except Exception as e:
        print(f"Failed to check for updates: {e}")
        return None

    if response.status_code != 200:
        print(f"Failed to check for updates: {response.status_code}")
        return None

    release_data = response.json()
    if not isinstance(release_data, dict):
        print(f"Unexpected release data: {type(release_data)}")
        return None

    latest_version = release_data.get("tag_name")
    if not isinstance(latest_version, str):
        print(f"Failed to parse release data for tag name: {release_data}")
        return None

    return latest_version.replace("v", "")


def reboot_agent(target_version: Optional[str] = None) -> bool:
    """
    Reboot the agent to a specific version or the latest version.
    
    Args:
        target_version: Specific version to reboot to, or None for latest
        
    Returns:
        True if reboot was successful, False otherwise
    """
    current_version = get_version()
    logger = setup_logger(current_version)
    
    logger.info(f"Starting reboot process from version {current_version}")
    
    if target_version is None:
        logger.info("Checking for latest version...")
        target_version = get_latest_version()
        if target_version is None:
            logger.error("Failed to get latest version")
            return False
    
    logger.info(f"Target version: {target_version}")
    
    if target_version == current_version:
        logger.info(f"Already on target version: {target_version}")
        return True

    try:
        logger.info(f"Rebooting to version: {target_version}")
        os.chdir("..")

        if os.system(f"rm -Rf vargasjr_dev_agent-*") != 0:
            logger.error("Failed to remove old agent")
            return False
        logger.info("Removed old agent")

        if os.system("yes | rm -rf ~/.cache/pypoetry/virtualenvs/*") != 0:
            logger.error("Failed to remove old virtualenvs")
            return False
        logger.info("Removed old virtualenvs")

        download_url = f"https://github.com/dvargas92495/vargasjr-dev/releases/download/v{target_version}/vargasjr_dev_agent-{target_version}.tar.gz"
        if os.system(f"wget {download_url}") != 0:
            logger.error("Failed to download new agent")
            return False
        logger.info("Downloaded new agent")

        if os.system(f"tar -xzf vargasjr_dev_agent-{target_version}.tar.gz") != 0:
            logger.error("Failed to extract new agent")
            return False
        logger.info("Extracted new agent")

        os.chdir(f"vargasjr_dev_agent-{target_version}")
        if os.system("cp ../.env .") != 0:
            logger.error("Failed to copy .env file")
            return False
        logger.info("Copied .env file")

        if os.system("poetry lock && poetry install") != 0:
            logger.error("Failed to install dependencies")
            return False
        logger.info("Installed dependencies")

        screen_name = f"agent-{target_version.replace('.', '-')}"
        subprocess.Popen(
            ["screen", "-dmS", screen_name, "bash", "-c", "poetry run agent 2> error.log"],
            start_new_session=True,
        )
        logger.info(f"Started new agent in screen session: {screen_name}")
        
        return True
        
    except Exception as e:
        logger.exception(f"Failed to reboot to version: {target_version}")
        return False


def main():
    """Main entry point for the reboot script"""
    parser = argparse.ArgumentParser(description="Reboot the VargasJR agent to a specific version")
    parser.add_argument(
        "--version", 
        type=str, 
        help="Specific version to reboot to (e.g., '0.0.65'). If not provided, will use the latest release."
    )
    parser.add_argument(
        "--check-only",
        action="store_true",
        help="Only check for updates without actually rebooting"
    )
    
    args = parser.parse_args()
    
    if args.check_only:
        current_version = get_version()
        latest_version = get_latest_version()
        print(f"Current version: {current_version}")
        print(f"Latest version: {latest_version}")
        if latest_version and latest_version != current_version:
            print("Update available!")
            sys.exit(1)
        else:
            print("No update needed")
            sys.exit(0)
    
    success = reboot_agent(args.version)
    if success:
        print("Reboot completed successfully")
        sys.exit(0)
    else:
        print("Reboot failed")
        sys.exit(1)


if __name__ == "__main__":
    main()
