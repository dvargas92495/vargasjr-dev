import logging
from logging.handlers import TimedRotatingFileHandler
from pathlib import Path
from typing import Optional


def get_version() -> str:
    """Get the current version from pyproject.toml"""
    with open("pyproject.toml", "r") as f:
        for line in f:
            if line.startswith("version = "):
                return line.split("=")[1].strip().strip('"')
    return "unknown"


def create_file_logger(name: str, log_filename: str, version: Optional[str] = None) -> logging.Logger:
    """Create a file-based logger with rotation, reusing the pattern from AgentRunner"""
    if version is None:
        version = get_version()
    
    log_dir = Path.home() / ".local" / "var" / "log" / "vargas-jr" / f"v{version}"
    log_dir.mkdir(exist_ok=True, parents=True)

    logger = logging.getLogger(name)
    if not logger.handlers:
        log_file = log_dir / log_filename
        file_handler = TimedRotatingFileHandler(
            str(log_file),
            when="midnight",
            interval=1,
            backupCount=30,
            encoding="utf-8",
        )
        formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
        logger.setLevel(logging.INFO)
    
    return logger
