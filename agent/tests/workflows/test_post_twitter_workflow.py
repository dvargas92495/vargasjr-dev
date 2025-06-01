import pytest
from unittest.mock import Mock, patch
from src.workflows.post_twitter.workflow import PostTwitterWorkflow, TweetContent


def test_workflow_structure():
    workflow = PostTwitterWorkflow()
    assert hasattr(workflow, 'graph')


def test_tweet_content_validation():
    tweet = TweetContent(text="Test tweet", hashtags=["test", "validation"])
    assert tweet.text == "Test tweet"
    assert tweet.hashtags == ["test", "validation"]


@patch('src.workflows.post_twitter.workflow.get_application_by_name')
@patch('src.workflows.post_twitter.workflow.tweepy.API')
@patch('src.workflows.post_twitter.workflow.tweepy.OAuthHandler')
def test_post_to_twitter_with_mocked_tweepy(mock_oauth, mock_api_class, mock_get_app):
    from src.workflows.post_twitter.workflow import PostToTwitter
    from src.models.application import Application
    from vellum.workflows.state.context import WorkflowContext
    
    mock_app = Application(
        name="Twitter",
        client_id="test_key",
        client_secret="test_secret"
    )
    mock_get_app.return_value = mock_app
    
    mock_auth = Mock()
    mock_oauth.return_value = mock_auth
    
    mock_api = Mock()
    mock_api_class.return_value = mock_api
    mock_api.verify_credentials.return_value = True
    
    mock_tweet = Mock()
    mock_tweet.id = 12345
    mock_api.update_status.return_value = mock_tweet

    context = WorkflowContext()
    context.logger = Mock()
    
    node = PostToTwitter(context=context)
    node.selected_tweet = TweetContent(
        text="Test tweet content",
        hashtags=["test", "automation"]
    )
    
    with patch('src.workflows.post_twitter.workflow.os.getenv') as mock_getenv:
        mock_getenv.side_effect = lambda key: {
            'TWITTER_ACCESS_TOKEN': 'test_token',
            'TWITTER_ACCESS_TOKEN_SECRET': 'test_token_secret'
        }.get(key)
        
        result = node.run()
        
        assert result.tweet_id == "12345"
        assert "Successfully posted tweet" in result.summary
        mock_api.update_status.assert_called_once()
        mock_get_app.assert_called_once_with("Twitter")
