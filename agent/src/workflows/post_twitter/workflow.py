import os
import random
from logging import Logger
import tweepy
from pydantic import BaseModel
from vellum import ChatMessagePromptBlock, JinjaPromptBlock, PromptParameters
from vellum.workflows import BaseWorkflow
from vellum.workflows.nodes import BaseNode, InlinePromptNode
from src.services import get_application_by_name


class TweetContent(BaseModel):
    text: str
    hashtags: list[str]


def generate_tweets(tweets: list[TweetContent]) -> None:
    pass


class GenerateTweetContent(InlinePromptNode):
    ml_model = "gpt-4o"
    blocks = [
        ChatMessagePromptBlock(
            chat_role="SYSTEM",
            blocks=[
                JinjaPromptBlock(
                    template="""\
Generate engaging Twitter content for a personal/professional account. The content should be:
- Authentic and personal
- Valuable to followers (insights, tips, thoughts)
- Appropriate for a software engineer/entrepreneur
- Under 280 characters
- Engaging and likely to drive interaction

Create 3 different tweet options with different styles:
1. A professional insight or tip
2. A personal reflection or observation
3. An industry trend or commentary

For each tweet, provide:
- Text (under 280 characters)
- Hashtags (2-4 relevant hashtags)
"""
                )
            ],
        )
    ]
    functions = [
        generate_tweets,
    ]
    parameters = PromptParameters(
        temperature=0.8,
        max_tokens=2000,
    )


class SelectTweet(BaseNode):
    raw_tweets = GenerateTweetContent.Outputs.results[0]["value"]["arguments"]["tweets"]

    class Outputs(BaseNode.Outputs):
        selected_tweet = TweetContent

    def run(self) -> Outputs:
        selected_tweet = TweetContent.model_validate(random.choice(self.raw_tweets))
        logger: Logger = getattr(self._context, "logger")
        logger.info(f"Selected tweet: {selected_tweet.text}")
        return self.Outputs(selected_tweet=selected_tweet)


class PostToTwitter(BaseNode):
    selected_tweet = SelectTweet.Outputs.selected_tweet

    class Outputs(BaseNode.Outputs):
        tweet_id: str
        summary: str

    def run(self) -> Outputs:
        logger: Logger = getattr(self._context, "logger")
        
        twitter_app = get_application_by_name("Twitter")
        if not twitter_app:
            raise ValueError("Twitter application not found in database")
        
        api_key = twitter_app.client_id
        api_secret = twitter_app.client_secret
        access_token = os.getenv("TWITTER_ACCESS_TOKEN")
        access_token_secret = os.getenv("TWITTER_ACCESS_TOKEN_SECRET")
        
        if not all([api_key, api_secret, access_token, access_token_secret]):
            raise ValueError("Twitter API credentials not complete")

        auth = tweepy.OAuthHandler(api_key, api_secret)
        auth.set_access_token(access_token, access_token_secret)
        api = tweepy.API(auth, wait_on_rate_limit=True)

        try:
            api.verify_credentials()
            logger.info("Twitter API authentication successful")
        except Exception as e:
            raise ValueError(f"Twitter API authentication failed: {e}")

        tweet_text = self.selected_tweet.text
        if self.selected_tweet.hashtags:
            hashtag_text = " " + " ".join(f"#{tag}" for tag in self.selected_tweet.hashtags)
            if len(tweet_text + hashtag_text) <= 280:
                tweet_text += hashtag_text

        try:
            tweet = api.update_status(tweet_text)
            tweet_id = str(tweet.id)
            summary = f"Successfully posted tweet: '{tweet_text}' (ID: {tweet_id})"
            logger.info(summary)
            return self.Outputs(tweet_id=tweet_id, summary=summary)
        except Exception as e:
            error_msg = f"Failed to post tweet: {e}"
            logger.error(error_msg)
            raise Exception(error_msg)


class PostTwitterWorkflow(BaseWorkflow):
    graph = GenerateTweetContent >> SelectTweet >> PostToTwitter

    class Outputs(BaseWorkflow.Outputs):
        tweet_id = PostToTwitter.Outputs.tweet_id
        summary = PostToTwitter.Outputs.summary
