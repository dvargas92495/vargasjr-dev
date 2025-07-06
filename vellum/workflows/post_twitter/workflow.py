from vellum.workflows import BaseWorkflow
from .nodes import GenerateTweetContent, SelectTweet, PostToTwitter
from .models import TweetContent


class PostTwitterWorkflow(BaseWorkflow):
    graph = GenerateTweetContent >> SelectTweet >> PostToTwitter

    class Outputs(BaseWorkflow.Outputs):
        tweet_id = PostToTwitter.Outputs.tweet_id
        summary = PostToTwitter.Outputs.summary
