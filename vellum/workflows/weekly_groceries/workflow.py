from vellum.workflows import BaseWorkflow
from vellum.workflows.state import BaseState

from .inputs import Inputs
from .nodes.final_output import FinalOutput
from .nodes.final_output_order_status import FinalOutputOrderStatus
from .nodes.final_output_shopping_list import FinalOutputShoppingList
from .nodes.ingredient_extractor import IngredientExtractor
from .nodes.meal_planner import MealPlanner
from .nodes.notion_meal_plan_agent import NotionMealPlanAgent
from .nodes.whole_foods_order import WholeFoodsOrder


class Workflow(BaseWorkflow[Inputs, BaseState]):
    graph = MealPlanner >> {
        NotionMealPlanAgent >> FinalOutput,
        IngredientExtractor
        >> {
            WholeFoodsOrder >> FinalOutputOrderStatus,
            FinalOutputShoppingList,
        },
    }

    class Outputs(BaseWorkflow.Outputs):
        order_status = FinalOutputOrderStatus.Outputs.value
        shopping_list = FinalOutputShoppingList.Outputs.value
        notion_page_status = FinalOutput.Outputs.value
