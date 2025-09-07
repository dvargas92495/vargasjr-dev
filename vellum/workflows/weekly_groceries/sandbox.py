#!/usr/bin/env python3

import asyncio
from .workflow import Workflow
from .inputs import Inputs


async def main():
    """Test the weekly groceries workflow with sample inputs."""
    
    test_cases = [
        {
            "number_of_people": "2",
            "dietary_requirements": "vegetarian, gluten-free",
            "health_goals": "weight loss, high protein"
        },
        {
            "number_of_people": "4", 
            "dietary_requirements": "no restrictions",
            "health_goals": "muscle building, balanced nutrition"
        }
    ]
    
    workflow = Workflow()
    
    for i, test_case in enumerate(test_cases):
        print(f"\nTesting case {i+1}: {test_case}")
        try:
            inputs = Inputs(**test_case)
            result = await workflow.run(inputs=inputs)
            print(f"Result: {result.outputs}")
        except Exception as e:
            print(f"Error: {e}")


if __name__ == "__main__":
    asyncio.run(main())
