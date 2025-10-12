#!/usr/bin/env python3

import asyncio
from .workflow import NewsletterDigestWorkflow


async def main():
    workflow = NewsletterDigestWorkflow()
    
    result = await workflow.run()
    
    print("Newsletter Digest Workflow Results:")
    print(f"Summary: {result.outputs.summary}")
    print(f"Emails processed: {result.outputs.emails_processed}")
    print(f"Newsletters found: {result.outputs.newsletters_found}")


if __name__ == "__main__":
    asyncio.run(main())
