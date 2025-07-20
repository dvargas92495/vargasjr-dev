import os
from logging import Logger
import logging
import tweepy
from vellum.workflows.nodes import BaseNode
from .select_tweet import SelectTweet
from services import get_application_by_name


class PostToTwitter(BaseNode):
    selected_tweet = SelectTweet.Outputs.selected_tweet

    class Outputs(BaseNode.Outputs):
        tweet_id: str
        summary: str

    def run(self) -> Outputs:
        logger: Logger = getattr(self._context, "logger", logging.getLogger(__name__))
        
        twitter_app = get_application_by_name("Twitter")
        if not twitter_app:
            raise ValueError("Twitter application not found in database")
        
        api_key = twitter_app.client_id
        api_secret = twitter_app.client_secret
        
        tweet_text = self.selected_tweet.text
        if self.selected_tweet.hashtags:
            hashtag_text = " " + " ".join(f"#{tag}" for tag in self.selected_tweet.hashtags)
            if len(tweet_text + hashtag_text) <= 280:
                tweet_text += hashtag_text
        
        tweet_id = "mock_tweet_id"
        summary = f"Mock tweet prepared: '{tweet_text}'"
        logger.info(summary)
        return self.Outputs(tweet_id=tweet_id, summary=summary)
