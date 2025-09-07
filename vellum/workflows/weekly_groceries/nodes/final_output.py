from vellum.workflows.nodes.displayable import FinalOutputNode
from vellum.workflows.state import BaseState

from .notion_meal_plan_agent import NotionMealPlanAgent


class FinalOutput(FinalOutputNode[BaseState, str]):
    class Outputs(FinalOutputNode.Outputs):
        value = NotionMealPlanAgent.Outputs.text
