import os
import random
import time
import requests
from runwayml import RunwayML
from pydantic import BaseModel
from vellum import ChatMessagePromptBlock, JinjaPromptBlock
from vellum.workflows import BaseWorkflow
from vellum.workflows.nodes import BaseNode, InlinePromptNode


class VideoPrompt(BaseModel):
    title: str
    description: str
    prompt: str


def generate_videos(videos: list[VideoPrompt]) -> None:
    pass


class BrainstormContent(InlinePromptNode):
    ml_model = "gpt-4o"
    blocks = [
        ChatMessagePromptBlock(
            chat_role="SYSTEM",
            blocks=[
                JinjaPromptBlock(
                    template="""\
You are making absolute brainrot content. These should be 10 second videos of nonsensical silly fun and esoteric phenomena. Our
goal is to go VIRAL.

Come up with 3 videos, and for each, give me:
- Title
- Description
- Prompt that we will feed into another model to generate the video
"""
                )
            ],
        )
    ]
    functions = [
        generate_videos,
    ]


class SelectVideo(BaseNode):
    raw_videos = BrainstormContent.Outputs.results[0]["value"]["arguments"]["videos"]

    class Outputs(BaseNode.Outputs):
        selected_video = VideoPrompt

    def run(self) -> Outputs:
        selected_video = VideoPrompt.model_validate(random.choice(self.raw_videos))
        print(f"Selected video: {selected_video}")
        return self.Outputs(selected_video=selected_video)


class GenerateImage(BaseNode):
    selected_video = SelectVideo.Outputs.selected_video

    class Outputs(BaseNode.Outputs):
        url: str

    def run(self) -> Outputs:
        response = requests.post(
            "https://api.openai.com/v1/images/generations",
            json={
                "prompt": f"""\
You are making absolute brainrot content. Each video will be a 10 second video of nonsensical silly fun and esoteric phenomena. Our
goal is to go VIRAL.

Here is some data about the video:

Title: {self.selected_video.title}
Description: {self.selected_video.description}
Prompt: {self.selected_video.prompt}

Generate an image that captures the essence of the video.
""",
                "model": "dall-e-3",
                "response_format": "url",
            },
            headers={
                "Authorization": f"Bearer {os.getenv('BRAINROT_OPENAI_API_KEY')}",
                "Content-Type": "application/json",
            },
        )
        if response.status_code != 200:
            raise Exception(f"Failed to generate image: {response.text}")

        return self.Outputs(url=response.json()["data"][0]["url"])


class GenerateVideo(BaseNode):
    image_url = GenerateImage.Outputs.url
    selected_video = SelectVideo.Outputs.selected_video

    class Outputs(BaseNode.Outputs):
        video_url: str

    def run(self) -> Outputs:
        client = RunwayML()
        first_task = client.image_to_video.create(
            model="gen3a_turbo",
            prompt_image=self.image_url,
            prompt_text=self.selected_video.prompt,
        )
        task_id = first_task.id
        sleep_time = 1
        status = "PENDING"
        while status not in ["SUCCEEDED", "FAILED"]:
            print(f"Task status: {status}. Sleeping for {sleep_time} seconds.")
            time.sleep(sleep_time)
            sleep_time += 1
            if sleep_time > 20:
                raise Exception("Task failed to complete in 20 tries")
            task = client.tasks.retrieve(task_id)
            status = task.status

        if not task.output:
            raise Exception("Task failed to complete")

        video_url = task.output[0]
        return self.Outputs(video_url=video_url)


class UploadVideo(BaseNode):
    pass


class PostToYoutube(BaseNode):
    pass


class PostToTiktok(BaseNode):
    pass


class PostToInstagram(BaseNode):
    pass


class BrainrotWorkflow(BaseWorkflow):
    graph = (
        BrainstormContent
        >> SelectVideo
        >> GenerateImage
        >> GenerateVideo
        >> UploadVideo
        >> {
            PostToYoutube,
            PostToTiktok,
            PostToInstagram,
        }
    )

    class Outputs(BaseWorkflow.Outputs):
        image_url = GenerateImage.Outputs.url
        video_url = GenerateVideo.Outputs.video_url
        output = BrainstormContent.Outputs.results[0]
