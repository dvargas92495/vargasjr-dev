from uuid import UUID

from vellum_ee.workflows.display.editor import NodeDisplayComment, NodeDisplayData, NodeDisplayPosition
from vellum_ee.workflows.display.nodes import BaseFinalOutputNodeDisplay
from vellum_ee.workflows.display.nodes.types import NodeOutputDisplay

from ...nodes.final_output_order_status import FinalOutputOrderStatus


class FinalOutputOrderStatusDisplay(BaseFinalOutputNodeDisplay[FinalOutputOrderStatus]):
    label = "Final Output Order Status"
    node_id = UUID("55f13a14-133b-434f-ae87-1c7408d2cbc1")
    target_handle_id = UUID("1b02dc1c-e812-4177-a5f1-a5aff7e88e27")
    output_name = "order_status"
    node_input_ids_by_name = {"node_input": UUID("7fc62038-5655-477f-956d-cd26aad1a6bf")}
    output_display = {
        FinalOutputOrderStatus.Outputs.value: NodeOutputDisplay(
            id=UUID("ba981941-fcb4-4e02-b155-4d2a3e2ec462"), name="value"
        )
    }
    display_data = NodeDisplayData(
        position=NodeDisplayPosition(x=2306, y=0),
        z_index=None,
        width=522,
        height=296,
        comment=NodeDisplayComment(expanded=True, value="Outputs the status of the Whole Foods order placement."),
    )
