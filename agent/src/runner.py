import logging
from threading import Event, Thread
import time
from typing import Optional
from dotenv import load_dotenv

from src.workflows.triage_message.workflow import TriageMessageWorkflow


class AgentRunner:
    def __init__(
        self,
        *,
        cancel_signal: Optional[Event] = None,
        logger: Optional[logging.Logger] = None,
        sleep_time: float = 0.01,
    ):
        load_dotenv()
        self._cancel_signal = cancel_signal or Event()
        self._logger = logger or logging.getLogger(__name__)
        self._sleep_time = sleep_time

    def run(self):
        main_thread = Thread(target=self._main_thread)
        main_thread.start()

    def _main_thread(self):
        while self._should_run():
            self._logger.info("Running...")

            workflow = TriageMessageWorkflow()
            final_event = workflow.run()
            if final_event.name == "workflow.execution.fulfilled":
                self._logger.info(f"Workflow Complete: {final_event.outputs.message}")
            elif final_event.name == "workflow.execution.rejected":
                self._logger.error(f"Workflow Failed: {final_event.error.message}")

            time.sleep(self._sleep_time)

    def _should_run(self):
        return not self._cancel_signal.is_set()
