from typing import Any, Dict, List
from vellum.workflows.state import BaseState
from vellum.client.core.pydantic_utilities import UniversalBaseModel


class ActionRecord(UniversalBaseModel):
    name: str
    args: Dict[str, Any]
    result: str


class State(BaseState):
    action_history: List[ActionRecord] = []
