from typing import List
from vellum.workflows.state import BaseState
from services import ActionRecord


class State(BaseState):
    action_history: List[ActionRecord] = []
