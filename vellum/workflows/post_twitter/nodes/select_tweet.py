import random
from logging import Logger
from vellum.workflows.nodes import BaseNode
from .generate_tweet_content import GenerateTweetContent
from ..models import TweetContent


class SelectTweet(BaseNode):
    raw_tweets = GenerateTweetContent.Outputs.results[0]["value"]["arguments"]["tweets"]

    class Outputs(BaseNode.Outputs):
        selected_tweet: TweetContent

    def run(self) -> Outputs:
        selected_tweet = TweetContent.model_validate(random.choice(self.raw_tweets))
        logger: Logger = getattr(self._context, "logger")
        logger.info(f"Selected tweet: {selected_tweet.text}")
        return self.Outputs(selected_tweet=selected_tweet)
