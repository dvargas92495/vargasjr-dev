from uuid import UUID

from vellum_ee.workflows.display.base import (
    EdgeDisplay,
    EntrypointDisplay,
    WorkflowDisplayData,
    WorkflowDisplayDataViewport,
    WorkflowInputsDisplay,
    WorkflowMetaDisplay,
    WorkflowOutputDisplay,
)
from vellum_ee.workflows.display.editor import NodeDisplayData, NodeDisplayPosition
from vellum_ee.workflows.display.workflows import BaseWorkflowDisplay

from ..inputs import Inputs
from ..nodes.final_output import FinalOutput
from ..nodes.final_output_order_status import FinalOutputOrderStatus
from ..nodes.final_output_shopping_list import FinalOutputShoppingList
from ..nodes.ingredient_extractor import IngredientExtractor
from ..nodes.meal_planner import MealPlanner
from ..nodes.notion_meal_plan_agent import NotionMealPlanAgent
from ..nodes.whole_foods_order import WholeFoodsOrder
from ..workflow import Workflow


class WorkflowDisplay(BaseWorkflowDisplay[Workflow]):
    workflow_display = WorkflowMetaDisplay(
        entrypoint_node_id=UUID("63884a7b-c01c-4cbc-b8d4-abe0a8796f6b"),
        entrypoint_node_source_handle_id=UUID("eba8fd73-57ab-4d7b-8f75-b54dbe5fc8ba"),
        entrypoint_node_display=NodeDisplayData(
            position=NodeDisplayPosition(x=0, y=580), z_index=None, width=124, height=48
        ),
        display_data=WorkflowDisplayData(
            viewport=WorkflowDisplayDataViewport(x=-184.5580152649752, y=183.78298914835204, zoom=0.5443520304093435)
        ),
    )
    inputs_display = {
        Inputs.number_of_people: WorkflowInputsDisplay(
            id=UUID("a24936f2-4a2c-436b-840d-53ecd6982613"), name="number_of_people"
        ),
        Inputs.dietary_requirements: WorkflowInputsDisplay(
            id=UUID("e0428ae8-f95c-4bfc-abc8-a8211c6e14bb"), name="dietary_requirements"
        ),
        Inputs.health_goals: WorkflowInputsDisplay(
            id=UUID("17ecbf23-5139-4c3d-8e6b-207dc72e7832"), name="health_goals"
        ),
    }
    entrypoint_displays = {
        MealPlanner: EntrypointDisplay(
            id=UUID("63884a7b-c01c-4cbc-b8d4-abe0a8796f6b"),
            edge_display=EdgeDisplay(id=UUID("a2c8c5bb-eaa7-4d07-be5e-18cc88df2fe6")),
        )
    }
    edge_displays = {
        (MealPlanner.Ports.default, NotionMealPlanAgent): EdgeDisplay(
            id=UUID("3c32a17e-8204-433f-8216-2afaca8df4f5")
        ),
        (MealPlanner.Ports.default, IngredientExtractor): EdgeDisplay(
            id=UUID("f0953cba-4f6e-4076-84f3-1d4239637438")
        ),
        (IngredientExtractor.Ports.default, WholeFoodsOrder): EdgeDisplay(
            id=UUID("35a95be4-82c4-4773-bffe-2f26d6f0c527")
        ),
        (WholeFoodsOrder.Ports.default, FinalOutputOrderStatus): EdgeDisplay(
            id=UUID("df97b3f7-39d7-4a86-ba54-eecb1a808005")
        ),
        (IngredientExtractor.Ports.default, FinalOutputShoppingList): EdgeDisplay(
            id=UUID("5cf6042c-6e18-4b47-8136-3c69a86734c0")
        ),
        (NotionMealPlanAgent.Ports.default, FinalOutput): EdgeDisplay(
            id=UUID("8112478e-54a7-45dd-ae9a-35a54cfca1ad")
        ),
    }
    output_displays = {
        Workflow.Outputs.order_status: WorkflowOutputDisplay(
            id=UUID("ba981941-fcb4-4e02-b155-4d2a3e2ec462"), name="order_status"
        ),
        Workflow.Outputs.shopping_list: WorkflowOutputDisplay(
            id=UUID("705aec10-a777-458b-838c-3d3efdee1232"), name="shopping_list"
        ),
        Workflow.Outputs.notion_page_status: WorkflowOutputDisplay(
            id=UUID("bc162329-25aa-4499-b21e-035552bcec6c"), name="notion_page_status"
        ),
    }
