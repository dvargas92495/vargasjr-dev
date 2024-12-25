from threading import Event
import time
from agent.runner import AgentRunner


def test_agent_runner__happy_path(mocker):
    # GIVEN a cancel signal and logger
    cancel_signal = Event()
    logger = mocker.Mock()

    # AND an agent runner
    agent_runner = AgentRunner(
        cancel_signal=cancel_signal,
        logger=logger,
    )

    # WHEN running the agent runner
    agent_runner.run()

    # AND sleep for a bit
    time.sleep(0.01)

    # AND then cancel the runner
    cancel_signal.set()

    # THEN the logger should have been called once
    logger.info.assert_called_once_with("Running...")

    # AND the test should exit...
