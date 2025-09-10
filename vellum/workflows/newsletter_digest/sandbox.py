#!/usr/bin/env python3

import asyncio
from vellum import VellumClient
from workflow import NewsletterDigestWorkflow


async def main():
    client = VellumClient()
    
    final_event = await client.execute_workflow(
        workflow=NewsletterDigestWorkflow,
        inputs={}
    )
    
    if final_event.name != "workflow.execution.fulfilled":
        raise Exception("Workflow failed" + str(final_event))

    print("Newsletter Digest Workflow Results:")
    print(f"Summary: {final_event.outputs['summary']}")
    print(f"Emails processed: {final_event.outputs['emails_processed']}")
    print(f"Newsletters found: {final_event.outputs['newsletters_found']}")


if __name__ == "__main__":
    asyncio.run(main())
