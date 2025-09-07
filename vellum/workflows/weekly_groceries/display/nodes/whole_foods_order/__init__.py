from uuid import UUID

from vellum_ee.workflows.display.editor import NodeDisplayData, NodeDisplayPosition
from vellum_ee.workflows.display.nodes import BaseNodeDisplay
from vellum_ee.workflows.display.nodes.types import NodeOutputDisplay, PortDisplayOverrides

from ....nodes.whole_foods_order import WholeFoodsOrder


class WholeFoodsOrderDisplay(BaseNodeDisplay[WholeFoodsOrder]):
    label = "WholeFoodsOrder"
    node_id = UUID("e46fc8a4-15a1-4323-93c0-c9b22b783472")
    attribute_ids_by_name = {
        "ml_model": UUID("76ed170c-311f-43db-85d4-d580342aca51"),
        "system_prompt": UUID("6c6df561-f0c7-484e-8817-df0289f75c43"),
        "prompt_inputs": UUID("f5e66998-3991-4161-a459-86d521e39d64"),
        "tools": UUID("0d3c6ca4-bfc2-4f24-856e-6337bd2967cd"),
        "max_tool_iterations": UUID("2a1274d1-7154-48e3-8c49-36d61d4f3fa6"),
        "blocks": UUID("4d767373-c03e-457d-a8a9-fe3b16de2a24"),
        "functions": UUID("f68a9c19-56de-4f26-9033-185bcb1bb33d"),
        "parameters": UUID("eed20f21-fdd0-43ad-9e40-06121a9b29f1"),
        "max_prompt_iterations": UUID("7dd5358e-8351-47d4-ae2a-e4d5a9e24d73"),
    }
    output_display = {
        WholeFoodsOrder.Outputs.text: NodeOutputDisplay(id=UUID("fc7ff65b-343c-4f3c-9919-1b0149993a62"), name="text"),
        WholeFoodsOrder.Outputs.chat_history: NodeOutputDisplay(
            id=UUID("ff54cd7e-1036-4bab-b249-b959e358b7c5"), name="chat_history"
        ),
    }
    port_displays = {
        WholeFoodsOrder.Ports.default: PortDisplayOverrides(id=UUID("1d1cc84b-78c4-4e9f-b720-dfc6641a56b5"))
    }
    display_data = NodeDisplayData(
        position=NodeDisplayPosition(x=1623.9045340240127, y=-310.47663440757617), z_index=None, width=None, height=None
    )
