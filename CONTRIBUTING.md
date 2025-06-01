# Contributing to vargasjr-dev

## Style Guide

### Python Code Style

- **Import Organization**: All imports should be placed at the top of the file where possible. Avoid inline imports within functions unless absolutely necessary for lazy loading or conditional imports.

### General Guidelines

- Follow existing code patterns and conventions in the codebase
- Ensure all tests pass before submitting changes
- Run linting checks with `npm run lint` before committing
- For Python tests, use `poetry run pytest` in the agent directory

## Development Setup

### Frontend (Next.js)
```bash
npm install
npm run dev
```

### Agent (Python)
```bash
cd agent
poetry install
poetry run pytest  # Run tests
```

### Database
```bash
npm run db:generate  # Generate migrations
npm run db:migrate   # Apply migrations
```

## Testing

- Frontend tests: `npm t`
- Python tests: `cd agent && poetry run pytest`
- Linting: `npm run lint`

## Pull Request Guidelines

- Create descriptive branch names following the pattern: `feature/description` or `fix/description`
- Include clear commit messages describing the changes
- Ensure all CI checks pass before requesting review
- Reference any related issues in the PR description
