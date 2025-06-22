import argparse
import sys

from src.runner import AgentRunner
from src.reboot_manager import get_latest_version, reboot_agent
from src.utils import get_version


def agent():
    """Run the agent"""
    agent_runner = AgentRunner(sleep_time=5)
    agent_runner.run()


def main():
    """Main entry point for the CLI"""
    parser = argparse.ArgumentParser(description="VargasJR Agent CLI")
    subparsers = parser.add_subparsers(dest="command", help="Available commands")
    
    agent_parser = subparsers.add_parser("agent", help="Run the agent")
    
    reboot_parser = subparsers.add_parser("reboot", help="Reboot the agent to a specific version")
    reboot_parser.add_argument(
        "--version", 
        type=str, 
        help="Specific version to reboot to (e.g., '0.0.65'). If not provided, will use the latest release."
    )
    reboot_parser.add_argument(
        "--check-only",
        action="store_true",
        help="Only check for updates without actually rebooting"
    )
    
    args = parser.parse_args()
    
    if args.command is None or args.command == "agent":
        agent()
    elif args.command == "reboot":
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


def reboot():
    """Entry point for the reboot command (for poetry script)"""
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
