#!/usr/bin/env python3

from typing import Literal
from pydantic import BaseModel, Field


class BaseMetric(BaseModel):
    """Base class for all metric types."""
    type: str
    output_name: str
    weight: int = Field(gt=0, description="Weight of this metric in scoring")


class ExactMatchMetric(BaseMetric):
    """Metric that checks for exact value match."""
    type: Literal["exact_match"] = "exact_match"
    expected_value: str


class RegexMatchMetric(BaseMetric):
    """Metric that checks if value matches a regex pattern."""
    type: Literal["regex_match"] = "regex_match"
    target_expression: str = Field(description="Regex pattern to match against")
