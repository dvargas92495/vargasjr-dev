from uuid import UUID

from vellum_ee.workflows.display.editor import NodeDisplayData, NodeDisplayPosition
from vellum_ee.workflows.display.nodes import BaseFinalOutputNodeDisplay
from vellum_ee.workflows.display.nodes.types import NodeOutputDisplay

from ...nodes.final_output import FinalOutput


class FinalOutputDisplay(BaseFinalOutputNodeDisplay[FinalOutput]):
    label = "Final Output"
    node_id = UUID("d237542b-026e-468b-8005-f0f6c52baaa8")
    target_handle_id = UUID("53234db9-91f9-4aba-a6d4-e0354cb13013")
    output_name = "notion_page_status"
    node_input_ids_by_name = {"node_input": UUID("5673dc9a-0ac6-4f58-a514-64f67e54a080")}
    output_display = {
        FinalOutput.Outputs.value: NodeOutputDisplay(id=UUID("bc162329-25aa-4499-b21e-035552bcec6c"), name="value")
    }
    display_data = NodeDisplayData(
        position=NodeDisplayPosition(x=1649.8147674286433, y=1108.0256283404965), z_index=None, width=522, height=262
    )
