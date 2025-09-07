from vellum.workflows.nodes.displayable import FinalOutputNode
from vellum.workflows.state import BaseState

from .whole_foods_order import WholeFoodsOrder


class FinalOutputOrderStatus(FinalOutputNode[BaseState, str]):
    """Outputs the status of the Whole Foods order placement."""

    class Outputs(FinalOutputNode.Outputs):
        value = WholeFoodsOrder.Outputs.text
