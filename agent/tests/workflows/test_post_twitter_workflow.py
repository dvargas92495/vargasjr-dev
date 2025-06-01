import pytest
from unittest.mock import Mock, patch
from src.workflows.post_twitter.workflow import PostTwitterWorkflow, TweetContent


class TestPostTwitterWorkflow:
    def test_workflow_structure(self):
        workflow = PostTwitterWorkflow()
        assert hasattr(workflow, 'graph')

    def test_tweet_content_validation(self):
        tweet = TweetContent(text="Test tweet", hashtags=["test", "validation"])
        assert tweet.text == "Test tweet"
        assert tweet.hashtags == ["test", "validation"]
