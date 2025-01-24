from datetime import datetime
from logging import Logger
from vellum.workflows import BaseWorkflow
from vellum.workflows.state.context import WorkflowContext
from vellum.workflows.events import WorkflowEvent


class RoutineJob:
    def __init__(self, name: str, cron_expression: str, logger: Logger):
        self._name = name
        self._logger = logger
        self._last_run = None

        cron_parts = cron_expression.split()
        if len(cron_parts) != 5:
            raise ValueError("Invalid cron expression")

        self._minute = cron_parts[0]
        self._hour = cron_parts[1]
        self._day = cron_parts[2]
        self._month = cron_parts[3]
        self._weekday = cron_parts[4]

    def should_run(self):
        now = datetime.now()

        # If never run before, or if it's been more than 1 minute since last run, check schedule
        if self._last_run is None or (now - self._last_run).total_seconds() > 60:
            if self._matches_schedule(now):
                self._last_run = now
                return True

        return False

    def _matches_schedule(self, dt: datetime) -> bool:
        # Check each component
        if not self._matches_field(dt.minute, self._minute):
            return False

        if not self._matches_field(dt.hour, self._hour):
            return False

        if not self._matches_field(dt.day, self._day):
            return False

        if not self._matches_field(dt.month, self._month):
            return False

        if not self._matches_field(dt.weekday(), self._weekday):
            return False

        return True

    def _matches_field(self, value: int, pattern: str) -> bool:
        if pattern == "*":
            return True

        # Handle lists (e.g., "1,3,5")
        if "," in pattern:
            return str(value) in pattern.split(",")

        # Handle ranges (e.g., "1-5")
        if "-" in pattern:
            start, end = map(int, pattern.split("-"))
            return start <= value <= end

        # Handle exact matches
        return int(pattern) == value

    def run(self):
        workflow_class = BaseWorkflow.load_from_module(f"src.workflows.{self._name}")
        workflow_context = WorkflowContext()
        setattr(workflow_context, "logger", self._logger)
        workflow = workflow_class(
            context=workflow_context,
        )
        self._logger.info(f"Running Routine Job {self._name}")
        events = workflow.stream(event_filter=self._event_filter)
        for event in events:
            if event.name == "workflow.execution.initiated":
                self._logger.info(f"Routine Job {self._name} started. Trace: {event.trace_id} Span: {event.span_id}")
            elif event.name == "node.execution.fulfilled":
                self._logger.info(
                    f"Routine Job {self._name} successfully completed node {event.node_definition.__name__}"
                )
            elif event.name == "workflow.execution.fulfilled":
                self._logger.info(f"Routine Job {self._name} completed successfully")
            elif event.name == "workflow.execution.rejected":
                self._logger.error(f"Routine Job {self._name} failed: [{event.error.code}] {event.error.message}")

    def _event_filter(self, workflow: BaseWorkflow, event: WorkflowEvent) -> bool:
        return event.name in {
            "workflow.execution.initiated",
            "workflow.execution.fulfilled",
            "workflow.execution.rejected",
            "node.execution.fulfilled",
        }
