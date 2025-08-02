import logging
import requests
from typing import Optional
from services import get_application_by_name
from vellum.workflows import BaseWorkflow
from vellum.workflows.nodes import BaseNode
from vellum.workflows.state import BaseState
from vellum.client.core.pydantic_utilities import UniversalBaseModel
from .inputs import Inputs

logger = logging.getLogger(__name__)


class DevinSessionResponse(UniversalBaseModel):
    session_id: str
    url: str


class CreateDevinChatSessionNode(BaseNode):
    issue_number = Inputs.issue_number

    class Outputs(BaseNode.Outputs):
        session_response: Optional[DevinSessionResponse]
        error_message: Optional[str]

    def run(self) -> Outputs:
        try:
            devin_app = get_application_by_name("Devin")
            if not devin_app:
                return self.Outputs(
                    session_response=None,
                    error_message="Devin application not found in Applications table"
                )

            if not devin_app.client_secret:
                return self.Outputs(
                    session_response=None,
                    error_message="Devin application missing client_secret (API token)"
                )

            prompt = f"""Create a PR that closes https://github.com/dvargas92495/vargasjr-dev/issues/{self.issue_number}

Once the PR is merged, you may archive this session"""

            response = requests.post(
                "https://api.devin.ai/v1/sessions",
                headers={
                    "Authorization": f"Bearer {devin_app.client_secret}",
                    "Content-Type": "application/json"
                },
                json={
                    "prompt": prompt
                }
            )

            if response.status_code != 200:
                logger.error(f"Devin API call failed: {response.status_code} - {response.text}")
                return self.Outputs(
                    session_response=None,
                    error_message=f"Devin API call failed: {response.status_code}"
                )

            response_data = response.json()
            session_response = DevinSessionResponse(
                session_id=response_data["session_id"],
                url=response_data["url"]
            )

            logger.info(f"Created Devin session {session_response.session_id} for issue #{self.issue_number}")
            return self.Outputs(session_response=session_response, error_message=None)

        except Exception as e:
            logger.exception(f"Error creating Devin chat session for issue #{self.issue_number}")
            return self.Outputs(
                session_response=None,
                error_message=f"Unexpected error: {str(e)}"
            )


class CreateDevinChatWorkflow(BaseWorkflow[Inputs, BaseState]):
    graph = CreateDevinChatSessionNode

    class Outputs(BaseWorkflow.Outputs):
        session_response = CreateDevinChatSessionNode.Outputs.session_response
        error_message = CreateDevinChatSessionNode.Outputs.error_message
