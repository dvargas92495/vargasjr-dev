# Vargas JR Scripts

This directory contains utility scripts for managing Vargas JR agents.

## Create Agent

Creates a new Vargas JR agent with automated EC2 setup using the `scripts/create-agent.ts` script.

### Usage

```bash
npm run create-agent <agent-name>
```

### What it does

1. Creates an EC2 key pair
2. Launches a new EC2 instance
3. Tags the instance appropriately
4. Automatically sets up the instance with Python, Poetry, and environment variables
5. Copies environment configuration to the instance

### Prerequisites

- AWS credentials configured (via environment variables or AWS CLI)
- Appropriate AWS permissions for EC2 operations
- Node.js and npm installed
- Required environment variables set: `POSTGRES_URL`, `VELLUM_API_KEY`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`

### Manual steps after running

1. Copy `run_agent.sh` to the instance
2. Run the agent using the copied script
