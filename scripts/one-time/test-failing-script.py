#!/usr/bin/env python3

import os
import sys

print("🔥 Test failing script started")
print(f"📋 Processing PR #{os.environ.get('PR_NUMBER', 'unknown')}")
print("⚠️ This script is designed to fail for testing error handling")

print("Doing some work...")

print("❌ Simulating failure condition", file=sys.stderr)
sys.exit(1)
