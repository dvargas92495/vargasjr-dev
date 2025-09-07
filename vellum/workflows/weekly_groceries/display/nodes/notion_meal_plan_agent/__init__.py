from uuid import UUID

from vellum_ee.workflows.display.editor import NodeDisplayData, NodeDisplayPosition
from vellum_ee.workflows.display.nodes import BaseNodeDisplay
from vellum_ee.workflows.display.nodes.types import NodeOutputDisplay, PortDisplayOverrides

from ....nodes.notion_meal_plan_agent import NotionMealPlanAgent


class NotionMealPlanAgentDisplay(BaseNodeDisplay[NotionMealPlanAgent]):
    label = "NotionMealPlanAgent"
    node_id = UUID("1ad7f8d2-9fc4-41a0-82de-fd8830e80777")
    attribute_ids_by_name = {
        "ml_model": UUID("ff040941-532c-48b5-af73-83a29d3d27c6"),
        "system_prompt": UUID("3aa0282a-8636-41dc-a9fd-19996a2d6048"),
        "prompt_inputs": UUID("588a4aa0-54db-446e-a309-29171c381e39"),
        "tools": UUID("57bb8e20-69e4-4ec5-97db-509b4ceec000"),
        "max_tool_iterations": UUID("c03d185b-1c27-4779-be14-be258199daf6"),
        "blocks": UUID("fa4ef6f1-211a-4c28-8509-32cd2a76688e"),
        "functions": UUID("a42cc31a-1e30-4de2-a4c5-d4fc70098014"),
        "parameters": UUID("deabb0e1-41dc-413b-9aa0-b0e355b9816a"),
        "max_prompt_iterations": UUID("fcdb259e-6cbb-4497-8e4d-e6b206e22109"),
        "settings": UUID("9a36cf55-e1d6-4a14-acc6-ef72bdba8400"),
    }
    output_display = {
        NotionMealPlanAgent.Outputs.text: NodeOutputDisplay(
            id=UUID("d6e6ae61-ea65-4e2b-8c27-0af26e19c582"), name="text"
        ),
        NotionMealPlanAgent.Outputs.chat_history: NodeOutputDisplay(
            id=UUID("70ef9ff8-f31f-4937-8ad8-134ccaf5087c"), name="chat_history"
        ),
    }
    port_displays = {
        NotionMealPlanAgent.Ports.default: PortDisplayOverrides(id=UUID("108a184e-78fa-4238-ba30-a7043617b0ad"))
    }
    display_data = NodeDisplayData(position=NodeDisplayPosition(x=975, y=806.75), z_index=None, width=None, height=None)
