from logging import Logger
import logging
import os
import random
import time
import requests
from runwayml import RunwayML
from pydantic import BaseModel
from services.aws import send_email
from vellum import ChatMessagePromptBlock, JinjaPromptBlock, PromptParameters
from vellum.workflows import BaseWorkflow
from vellum.workflows.nodes import BaseNode, InlinePromptNode


class VideoPrompt(BaseModel):
    title: str
    description: str
    hashtags: list[str]


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
Our end goal is to generate a short, highly engaging and adorable video concept featuring either a baby or an animal that has the potential to go viral on Instagram. 
The concept should include a unique, heartwarming, or funny scenario that resonates with a broad audience. Keep the idea simple, relatable, and visually appealing. 
Details such as the setting, the key action or reaction, and any special elements that enhance cuteness and engagement will be essential.

Come up with 3 videos, and for each, give me:
- Title
- Description
- Hashtags (list 5-10 viral hashtags)
"""
                )
            ],
        )
    ]
    functions = [
        generate_videos,
    ]
    parameters = PromptParameters(
        temperature=0.8,
        max_tokens=8000,
    )


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
Our end goal is to generate a short, highly engaging and adorable video concept featuring either a baby or an animal that has the potential to go viral on Instagram. 
The concept should include a unique, heartwarming, or funny scenario that resonates with a broad audience. Keep the idea simple, relatable, and visually appealing. 
Details such as the setting, the key action or reaction, and any special elements that enhance cuteness and engagement will be key.

Here is some data about the video:

Title: {self.selected_video.title}
Description: {self.selected_video.description}

Generate an image that captures the essence of the video and would serve as the thumbnail.
""",
                "model": "dall-e-3",
                "response_format": "url",
                "size": "1024x1792",
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
        prompt = f"""\
Generate a short, highly engaging and adorable video concept featuring either a baby or an animal that has the potential to go viral on Instagram. 
The concept should include a unique, heartwarming, or funny scenario that resonates with a broad audience. Keep the idea simple, relatable, and visually appealing. 
Provide details such as the setting, the key action or reaction, and any special elements that enhance cuteness and engagement.

Here is some information about the video:
- Title: {self.selected_video.title}
- Description: {self.selected_video.description}
"""
        first_task = client.image_to_video.create(
            model="gen3a_turbo",
            prompt_image=self.image_url,
            prompt_text=prompt,
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
        print(f"Video URL: {video_url}")
        return self.Outputs(video_url=video_url)


class UploadVideo(BaseNode):
    pass


class PostToYoutube(BaseNode):
    pass


class PostToTiktok(BaseNode):
    pass


class PostToInstagram(BaseNode):
    pass


class EmailSummary(BaseNode):
    selected_video = SelectVideo.Outputs.selected_video
    image_url = GenerateImage.Outputs.url
    video_url = GenerateVideo.Outputs.video_url

    class Outputs(BaseNode.Outputs):
        summary: str

    def run(self) -> Outputs:
        summary = f"""\
Hey there! I just generated a new video for you.

Title: {self.selected_video.title}
Description: {self.selected_video.description}

Image URL: {self.image_url}
Video URL: {self.video_url}
"""
        try:
            to_email = os.getenv("BRAINROT_EMAIL")
            send_email(
                to=to_email,
                body=summary,
                subject=f"New Video: {self.selected_video.title}",
            )
            return self.Outputs(summary=f"Sent video to {to_email}.")
        except Exception:
            logger: Logger = getattr(self._context, "logger", logging.getLogger(__name__))
            logger.exception("Failed to send email")

        return self.Outputs(summary=summary)


class BrainrotWorkflow(BaseWorkflow):
    graph = (
        # FetchFavoriteVideosFromBurnerAccount
        # >> ForEachVideoPullDataAboutWhatItsAbout
        BrainstormContent
        >> SelectVideo
        >> GenerateImage
        # >> ResizeImage to 1080x1920
        >> GenerateVideo
        >> UploadVideo
        >> {
            PostToYoutube,
            PostToTiktok,
            PostToInstagram,
        }
        >> EmailSummary
    )

    class Outputs(BaseWorkflow.Outputs):
        image_url = GenerateImage.Outputs.url
        video_url = GenerateVideo.Outputs.video_url
        output = BrainstormContent.Outputs.results[0]
