from typing import Optional

from vellum.workflows.inputs import BaseInputs


class Inputs(BaseInputs):
    number_of_people: Optional[str] = "2"
    dietary_requirements: str
    health_goals: str
