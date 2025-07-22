#!/usr/bin/env python3

import asyncio
from .workflow import ScheduleToCronWorkflow
from .inputs import ScheduleToCronInputs


async def main():
    """Test the schedule to cron workflow with sample inputs."""
    
    test_cases = [
        "every Monday at 5pm",
        "daily at 9am", 
        "every weekday at 8:30am",
        "every Sunday at midnight",
        "twice a day at 6am and 6pm",
        "every 15 minutes",
        "first day of every month at noon"
    ]
    
    workflow = ScheduleToCronWorkflow()
    
    for test_case in test_cases:
        print(f"\nTesting: '{test_case}'")
        try:
            inputs = ScheduleToCronInputs(schedule_description=test_case)
            result = await workflow.run(inputs=inputs)
            print(f"Result: {result.outputs.cron_expression}")
        except Exception as e:
            print(f"Error: {e}")


if __name__ == "__main__":
    asyncio.run(main())
