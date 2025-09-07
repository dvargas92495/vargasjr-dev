from uuid import UUID

from vellum_ee.workflows.display.editor import NodeDisplayComment, NodeDisplayData, NodeDisplayPosition
from vellum_ee.workflows.display.nodes import BaseInlinePromptNodeDisplay
from vellum_ee.workflows.display.nodes.types import NodeOutputDisplay, PortDisplayOverrides

from ...nodes.meal_planner import MealPlanner


class MealPlannerDisplay(BaseInlinePromptNodeDisplay[MealPlanner]):
    label = "Meal Planner"
    node_id = UUID("9a1e45f3-99ef-4b2f-a4e1-b1bc27503b4d")
    output_id = UUID("079c8c7f-8d47-4a4d-b347-284dc325f604")
    array_output_id = UUID("31ab5b6c-fa54-4c1f-a312-64eb4d82ea15")
    target_handle_id = UUID("d15ee66a-afd1-49ec-8782-425716712219")
    node_input_ids_by_name = {
        "prompt_inputs.dietary_requirements": UUID("bc7dd4bd-ea50-4101-abfc-f1882eeffcca"),
        "prompt_inputs.health_goals": UUID("ea96a4bb-62cd-4b98-82c7-f3f1d74e68a4"),
        "prompt_inputs.number_of_people": UUID("aed60765-74f5-4494-9a40-09d26c8d4f00"),
    }
    attribute_ids_by_name = {
        "ml_model": UUID("fde1d0b4-9764-4b06-8d9e-ef20d2386ff0"),
        "blocks": UUID("138a24de-9dbe-4e07-bad3-e22470d44cac"),
        "prompt_inputs": UUID("73f6dac9-0990-452d-8d4d-82d58bdd0ff8"),
        "parameters": UUID("a1f93335-aba0-44fb-96e8-9804836b0f2c"),
        "functions": UUID("ed69f68a-ddaf-46b6-a1b3-d1dbb8147a61"),
    }
    output_display = {
        MealPlanner.Outputs.text: NodeOutputDisplay(id=UUID("079c8c7f-8d47-4a4d-b347-284dc325f604"), name="text"),
        MealPlanner.Outputs.results: NodeOutputDisplay(id=UUID("31ab5b6c-fa54-4c1f-a312-64eb4d82ea15"), name="results"),
        MealPlanner.Outputs.json: NodeOutputDisplay(id=UUID("532ccf9d-4c83-46cd-86ae-1d505e7a9570"), name="json"),
    }
    port_displays = {MealPlanner.Ports.default: PortDisplayOverrides(id=UUID("386e3060-e376-4263-9400-cb1599a279f3"))}
    display_data = NodeDisplayData(
        position=NodeDisplayPosition(x=254, y=271.5),
        z_index=None,
        width=554,
        height=253,
        comment=NodeDisplayComment(
            expanded=True,
            value="Generates a comprehensive weekly meal plan based on dietary requirements and health goals.",
        ),
    )
