from vellum.workflows.nodes.displayable import FinalOutputNode
from vellum.workflows.state import BaseState

from .ingredient_extractor import IngredientExtractor


class FinalOutputShoppingList(FinalOutputNode[BaseState, str]):
    """Outputs the consolidated shopping list organized by store sections."""

    class Outputs(FinalOutputNode.Outputs):
        value = IngredientExtractor.Outputs.text
