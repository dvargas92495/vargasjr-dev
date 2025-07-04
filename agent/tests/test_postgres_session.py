import os
import pytest
from unittest.mock import patch
from src.services import postgres_session


def test_postgres_session_handles_postgres_prefix():
    """Test that postgres:// URLs are converted to postgresql+psycopg://"""
    with patch.dict(os.environ, {"POSTGRES_URL": "postgres://user:pass@localhost:5432/db"}):
        with patch('src.services.create_engine') as mock_create_engine:
            with patch('src.services.Session') as mock_session:
                postgres_session()
                mock_create_engine.assert_called_once_with("postgresql+psycopg://user:pass@localhost:5432/db")


def test_postgres_session_handles_postgresql_prefix():
    """Test that postgresql:// URLs are converted to postgresql+psycopg://"""
    with patch.dict(os.environ, {"POSTGRES_URL": "postgresql://user:pass@localhost:5432/db"}):
        with patch('src.services.create_engine') as mock_create_engine:
            with patch('src.services.Session') as mock_session:
                postgres_session()
                mock_create_engine.assert_called_once_with("postgresql+psycopg://user:pass@localhost:5432/db")


def test_postgres_session_missing_url():
    """Test that missing POSTGRES_URL raises ValueError"""
    with patch.dict(os.environ, {}, clear=True):
        with pytest.raises(ValueError, match="POSTGRES_URL is not set"):
            postgres_session()
