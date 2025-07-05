from pydantic import BaseModel


class TweetContent(BaseModel):
    text: str
    hashtags: list[str]


def generate_tweets(tweets: list[TweetContent]) -> None:
    pass
