# Vargas JR Scripts

This directory contains utility scripts for managing Vargas JR agents.

## create-agent.ts

Creates a new Vargas JR agent with automated EC2 setup.

### Usage

```bash
npm run create-agent <agent-name>
# or
npx tsx scripts/create-agent.ts <agent-name>
```

### What it does

1. Creates an EC2 key pair
2. Launches a new EC2 instance
3. Tags the instance appropriately
4. Generates a setup script for manual completion

### Prerequisites

- AWS credentials configured (via environment variables or AWS CLI)
- Appropriate AWS permissions for EC2 operations
- Node.js and npm installed

### Manual steps after running

1. Update the generated `.env` file with your actual credentials
2. Copy `run_agent.sh` to the instance
3. Run the generated setup script
