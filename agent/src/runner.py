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

from src.routine_job import RoutineJob
from src.services import postgres_session
from src.models.routine_job import RoutineJob as RoutineJobModel
from sqlmodel import select
from src.workflows.triage_message.workflow import TriageMessageWorkflow
from src.utils import get_version, create_file_logger


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
        self._current_version = get_version()
        self._logger = logger or create_file_logger(__name__, "agent.log", self._current_version)
        log_level = os.getenv("LOG_LEVEL")
        if log_level:
            self._logger.setLevel(log_level)

        self._cancel_signal = cancel_signal or Event()
        self._sleep_time = sleep_time
        self._max_loops = max_loops
        self._last_updated = datetime.now()
        self._update_interval = timedelta(minutes=1)

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

            if datetime.now() - self._last_updated > self._update_interval:
                self._logger.info("Checking for updates...")
                self._last_updated = datetime.now()
                
                from src.cli import check_and_reboot_if_needed
                try:
                    check_and_reboot_if_needed(self._logger)
                except Exception:
                    self._logger.exception("Failed to check for updates")




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
