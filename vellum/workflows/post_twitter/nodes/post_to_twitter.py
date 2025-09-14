import os
from logging import Logger
import logging
import tweepy
from vellum.workflows.nodes import BaseNode
from vellum.workflows.exceptions import NodeException
from vellum.workflows.errors.types import WorkflowErrorCode
from .select_tweet import SelectTweet
from services import get_twitter_application_by_name


class PostToTwitter(BaseNode):
    selected_tweet = SelectTweet.Outputs.selected_tweet

    class Outputs(BaseNode.Outputs):
        tweet_id: str
        summary: str

    def run(self) -> Outputs:
        logger: Logger = getattr(self._context, "logger", logging.getLogger(__name__))
        
        twitter_app = get_twitter_application_by_name("Twitter")
        if not twitter_app:
            raise NodeException("Twitter application not found in database", WorkflowErrorCode.INVALID_INPUTS)
        
        if not twitter_app['client_id'] or not twitter_app['client_secret']:
            raise NodeException("Twitter API consumer key and secret not configured", WorkflowErrorCode.PROVIDER_CREDENTIALS_UNAVAILABLE)
        
        if not twitter_app['access_token'] or not twitter_app['refresh_token']:
            raise NodeException("Twitter access token and secret not configured", WorkflowErrorCode.PROVIDER_CREDENTIALS_UNAVAILABLE)
        
        tweet_text = self.selected_tweet.text
        if self.selected_tweet.hashtags:
            hashtag_text = " " + " ".join(f"#{tag}" for tag in self.selected_tweet.hashtags)
            if len(tweet_text + hashtag_text) <= 280:
                tweet_text += hashtag_text
        
        try:
            client = tweepy.Client(
                consumer_key=twitter_app['client_id'],
                consumer_secret=twitter_app['client_secret'],
                access_token=twitter_app['access_token'],
                access_token_secret=twitter_app['refresh_token']
            )
            
            response = client.create_tweet(text=tweet_text)
            tweet_id = response.data['id']
            summary = f"Successfully posted tweet: '{tweet_text}' (ID: {tweet_id})"
            logger.info(summary)
            
            return self.Outputs(tweet_id=str(tweet_id), summary=summary)
            
        except tweepy.Unauthorized as e:
            error_msg = f"Twitter authentication failed: {str(e)}"
            logger.error(error_msg)
            raise NodeException(error_msg, WorkflowErrorCode.PROVIDER_ERROR)
        except tweepy.Forbidden as e:
            error_msg = f"Twitter API access forbidden: {str(e)}"
            logger.error(error_msg)
            raise NodeException(error_msg, WorkflowErrorCode.PROVIDER_ERROR)
        except tweepy.TooManyRequests as e:
            error_msg = f"Twitter API rate limit exceeded: {str(e)}"
            logger.error(error_msg)
            raise NodeException(error_msg, WorkflowErrorCode.PROVIDER_ERROR)
        except tweepy.TwitterServerError as e:
            error_msg = f"Twitter server error: {str(e)}"
            logger.error(error_msg)
            raise NodeException(error_msg, WorkflowErrorCode.PROVIDER_ERROR)
        except Exception as e:
            error_msg = f"Unexpected error posting to Twitter: {str(e)}"
            logger.error(error_msg)
            raise NodeException(error_msg, WorkflowErrorCode.NODE_EXECUTION)
