from threading import Event
import time


class AgentRunner:
    def __init__(self, cancel_signal: Event):
        self.cancel_signal = cancel_signal

    def run(self):
        while self._should_run():
            print("Running...")
            time.sleep(1)

    def _should_run(self):
        return not self.cancel_signal.is_set()
