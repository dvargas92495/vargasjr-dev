from typing import Optional
from vellum.workflows.inputs import BaseInputs


class Inputs(BaseInputs):
    message_id: Optional[str] = None
    operation: Optional[str] = None
