import logging
from threading import Event, Thread
import time
from typing import Optional


class AgentRunner:
    def __init__(self, cancel_signal: Event, logger: Optional[logging.Logger] = None):
        self._cancel_signal = cancel_signal
        self._logger = logger or logging.getLogger(__name__)

    def run(self):
        main_thread = Thread(target=self._main_thread)
        main_thread.start()

    def _main_thread(self):
        while self._should_run():
            self._logger.info("Running...")
            time.sleep(1)

    def _should_run(self):
        return not self._cancel_signal.is_set()
