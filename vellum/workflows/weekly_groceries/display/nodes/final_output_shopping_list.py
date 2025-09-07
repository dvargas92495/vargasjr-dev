from uuid import UUID

from vellum_ee.workflows.display.editor import NodeDisplayComment, NodeDisplayData, NodeDisplayPosition
from vellum_ee.workflows.display.nodes import BaseFinalOutputNodeDisplay
from vellum_ee.workflows.display.nodes.types import NodeOutputDisplay

from ...nodes.final_output_shopping_list import FinalOutputShoppingList


class FinalOutputShoppingListDisplay(BaseFinalOutputNodeDisplay[FinalOutputShoppingList]):
    label = "Final Output Shopping List"
    node_id = UUID("9d0072ee-4ebb-4a9d-8a2a-fc520673c880")
    target_handle_id = UUID("da8468ac-1b1a-4a52-a002-ca23e0c4692c")
    output_name = "shopping_list"
    node_input_ids_by_name = {"node_input": UUID("21062b14-a268-4971-b6f0-7015913f1270")}
    output_display = {
        FinalOutputShoppingList.Outputs.value: NodeOutputDisplay(
            id=UUID("705aec10-a777-458b-838c-3d3efdee1232"), name="value"
        )
    }
    display_data = NodeDisplayData(
        position=NodeDisplayPosition(x=1638, y=367.5),
        z_index=None,
        width=522,
        height=296,
        comment=NodeDisplayComment(
            expanded=True, value="Outputs the consolidated shopping list organized by store sections."
        ),
    )
