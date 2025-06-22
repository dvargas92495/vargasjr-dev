from datetime import datetime
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

from src.routine_job import RoutineJob
from src.services import postgres_session
from src.models.routine_job import RoutineJob as RoutineJobModel
from sqlmodel import select
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
        self._logger = logger or self._default_logger()
        log_level = os.getenv("LOG_LEVEL")
        if log_level:
            self._logger.setLevel(log_level)

        self._cancel_signal = cancel_signal or Event()
        self._sleep_time = sleep_time
        self._max_loops = max_loops

        self._routine_jobs = self._load_routine_jobs()

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

            for job in self._routine_jobs:
                if job.should_run():
                    job.run()
                    break



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

    def _load_routine_jobs(self) -> list[RoutineJob]:
        with postgres_session() as session:
            statement = select(RoutineJobModel).where(RoutineJobModel.enabled == True)
            db_jobs = session.exec(statement).all()
        
        routine_jobs = []
        for db_job in db_jobs:
            routine_jobs.append(
                RoutineJob(
                    name=db_job.name,
                    cron_expression=db_job.cron_expression,
                    logger=self._logger,
                )
            )
        
        return routine_jobs
