from datetime import datetime, timedelta
import logging
from logging.handlers import TimedRotatingFileHandler
import os
from pathlib import Path
import subprocess
import sys
from threading import Event, Thread
import time
from typing import Optional
from dotenv import load_dotenv

import requests
from src.workflows.triage_message.workflow import TriageMessageWorkflow


class AgentRunner:
    def __init__(
        self,
        *,
        cancel_signal: Optional[Event] = None,
        logger: Optional[logging.Logger] = None,
        sleep_time: float = 0.01,
        max_loops: Optional[int] = None,
    ):
        load_dotenv()
        self._current_version = self._get_version()
        self._cancel_signal = cancel_signal or Event()
        self._logger = logger or self._default_logger()
        self._sleep_time = sleep_time
        self._max_loops = max_loops
        self._last_updated = datetime.now()
        self._update_interval = timedelta(minutes=1)

        log_level = os.getenv("LOG_LEVEL")
        if log_level:
            self._logger.setLevel(log_level)

        self._logger.info(f"Initialized agent v{self._current_version}")

    def run(self):
        main_thread = Thread(target=self._main_thread)
        main_thread.start()

    def _main_thread(self):
        loops = 0
        while self._should_run():
            self._logger.info("Running...")

            workflow = TriageMessageWorkflow()
            final_event = workflow.run()
            if final_event.name == "workflow.execution.fulfilled":
                self._logger.info(f"Workflow Complete: {final_event.outputs.summary}")
            elif final_event.name == "workflow.execution.rejected":
                self._logger.error(f"Workflow Failed: {final_event.error.message}")

            time.sleep(self._sleep_time)
            loops += 1
            if self._max_loops and loops >= self._max_loops:
                self._logger.info("Max loops reached, stopping...")
                self._cancel_signal.set()

            if datetime.now() - self._last_updated > self._update_interval:
                self._logger.info("Checking for updates...")
                self._last_updated = datetime.now()
                release_url = "https://api.github.com/repos/dvargas92495/vargasjr-dev/releases/latest"
                response = requests.get(release_url)
                if response.status_code != 200:
                    self._logger.error(f"Failed to check for updates: {response.status_code}")
                    continue

                release_data = response.json()
                if not isinstance(release_data, dict):
                    self._logger.error(f"Unexpected release data: {type(release_data)}")
                    continue

                latest_version = release_data.get("tag_name")
                if not isinstance(latest_version, str):
                    self._logger.error(f"Failed to parse release data for tag name: {release_data}")
                    continue

                if latest_version == self._current_version:
                    self._logger.info(f"No new version available: {latest_version}")
                    continue

                try:
                    self._logger.info(f"New version available: {latest_version}")
                    os.chdir("..")
                    os.system(f"rm -Rf vargasjr_dev_agent-*")
                    os.system(
                        f"wget https://github.com/dvargas92495/vargasjr-dev/releases/download/v{latest_version}/vargasjr_dev_agent-{latest_version}.tar.gz"
                    )
                    os.system(f"tar -xzf vargasjr_dev_agent-{latest_version}.tar.gz")
                    os.chdir(f"vargasjr_dev_agent-{latest_version}")
                    os.system("cp ../.env .")
                    os.system("poetry install")
                    subprocess.Popen(["poetry", "run", "agent"])
                    sys.exit(0)
                except Exception:
                    self._logger.exception(f"Failed to update to version: {latest_version}")
                    continue

    def _get_version(self) -> str:
        with open("pyproject.toml", "r") as f:
            for line in f:
                if line.startswith("version = "):
                    return line.split("=")[1].strip().strip('"')
        return "unknown"

    def _default_logger(self) -> logging.Logger:
        log_dir = Path.home() / ".local" / "var" / "log" / "vargas-jr" / f"v{self._current_version}"
        log_dir.mkdir(exist_ok=True, parents=True)

        logger = logging.getLogger(__name__)
        log_file = log_dir / "agent.log"
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
        return logger

    def _should_run(self):
        return not self._cancel_signal.is_set()
