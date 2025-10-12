#!/usr/bin/env python3

from typing import List, Dict, Any


class BaseEval:
    """Base class for all evaluation test cases."""
    
    name: str
    description: str
    test_cases: List[Dict[str, Any]]
