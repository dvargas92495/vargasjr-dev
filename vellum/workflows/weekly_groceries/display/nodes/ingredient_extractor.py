from uuid import UUID

from vellum_ee.workflows.display.editor import NodeDisplayComment, NodeDisplayData, NodeDisplayPosition
from vellum_ee.workflows.display.nodes import BaseInlinePromptNodeDisplay
from vellum_ee.workflows.display.nodes.types import NodeOutputDisplay, PortDisplayOverrides

from ...nodes.ingredient_extractor import IngredientExtractor


class IngredientExtractorDisplay(BaseInlinePromptNodeDisplay[IngredientExtractor]):
    label = "Ingredient Extractor"
    node_id = UUID("c0c5fc71-c56d-4061-a2a7-f9ab3bea82bf")
    output_id = UUID("a196ecd8-ce47-427f-a0b3-583bbb4d0b45")
    array_output_id = UUID("163f397f-2f34-4090-991e-e8d2b4fe4949")
    target_handle_id = UUID("7c814a7d-235c-42aa-804c-dd82591f4338")
    node_input_ids_by_name = {"prompt_inputs.meal_plan": UUID("1631c193-4c53-4a4c-a627-9f99fef13ad9")}
    attribute_ids_by_name = {
        "ml_model": UUID("83684af8-1714-4af7-af15-87816e85bbfd"),
        "blocks": UUID("4ece2607-cea4-4719-a0d5-2cbb08a458c2"),
        "prompt_inputs": UUID("f1d4af6e-769c-41ae-9bd4-a3e425dd1cba"),
        "parameters": UUID("3ed134a1-2e31-4d17-9d7b-4830312cc067"),
        "functions": UUID("4f6b355c-5c1b-4884-8509-de05b8f702b2"),
    }
    output_display = {
        IngredientExtractor.Outputs.text: NodeOutputDisplay(
            id=UUID("a196ecd8-ce47-427f-a0b3-583bbb4d0b45"), name="text"
        ),
        IngredientExtractor.Outputs.results: NodeOutputDisplay(
            id=UUID("163f397f-2f34-4090-991e-e8d2b4fe4949"), name="results"
        ),
        IngredientExtractor.Outputs.json: NodeOutputDisplay(
            id=UUID("77083098-2f29-427e-9a4b-73f16b65c957"), name="json"
        ),
    }
    port_displays = {
        IngredientExtractor.Ports.default: PortDisplayOverrides(id=UUID("e5ebcdea-e150-4ef3-8799-7b223281ddd0"))
    }
    display_data = NodeDisplayData(
        position=NodeDisplayPosition(x=938, y=77.25),
        z_index=None,
        width=554,
        height=253,
        comment=NodeDisplayComment(
            expanded=True,
            value="Extracts and consolidates all ingredients from the meal plan into a comprehensive shopping list.",
        ),
    )
