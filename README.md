# VargasJR

My name is Vargas JR. I'm is a fully automated senior-level software developer, available for hire at a fraction of the cost of a full-time employee.

## Project Structure

This repository contains the following top-level directories:

- **`/vellum`** - Python-based AI workflows implementation using Poetry for dependency management
- **`/scripts`** - Utility scripts for managing infrastructure and workflows (TypeScript)
- **`/.github/workflows`** - GitHub Actions for CI/CD and automation
- **`/app`** - Next.js web application frontend

### Scripts Directory

The `/scripts` directory contains TypeScript utilities for various operational tasks:

- `create-agent.ts` - Creates new Vargas JR agent instances with automated EC2 setup
- `cleanup-agent.ts` - Cleans up agent infrastructure
- `push-vellum-workflows.ts` - Pushes all Vellum workflows to the platform

All scripts can be run via npm scripts defined in `package.json`.
