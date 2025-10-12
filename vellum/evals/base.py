#!/usr/bin/env python3

from typing import List, Union
from evals.metrics import ExactMatchMetric, RegexMatchMetric


class BaseEval:
    """Base class for all evaluation test cases."""
    
    name: str
    description: str
    id: str
    metrics: List[Union[ExactMatchMetric, RegexMatchMetric]]
