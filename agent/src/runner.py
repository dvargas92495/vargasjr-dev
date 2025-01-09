from datetime import datetime
import logging
import os
from pathlib import Path
import sys
from threading import Event, Thread
import time
from typing import Optional
from dotenv import load_dotenv

from src.workflows.triage_message.workflow import TriageMessageWorkflow


def _default_logger():
    Path("logs").mkdir(exist_ok=True)

    logger = logging.getLogger(__name__)
    log_file = f"logs/{datetime.now().strftime('%Y%m%d')}-stdout.log"
    file_handler = logging.FileHandler(log_file)
    formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)
    return logger


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
        self._cancel_signal = cancel_signal or Event()
        self._logger = logger or _default_logger()
        self._sleep_time = sleep_time
        self._max_loops = max_loops

        log_level = os.getenv("LOG_LEVEL")
        if log_level:
            self._logger.setLevel(log_level)

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
                self._logger.debug("Max loops reached, stopping...")
                self._cancel_signal.set()

    def _should_run(self):
        return not self._cancel_signal.is_set()
