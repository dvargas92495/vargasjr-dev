# Contributing to Vargas JR

## Version Management

### Agent Directory Changes
Always bump the patch version in `agent/pyproject.toml` whenever making changes in the `/agent` directory. This ensures proper versioning for agent releases.

Example:
```toml
# Before changes
version = "0.0.63"

# After changes
version = "0.0.64"
```

## Style Guide

### Python Code Style

- **Import Organization**: All imports should be placed at the top of the file where possible. Avoid inline imports within functions unless absolutely necessary for lazy loading or conditional imports.

### TypeScript Code Style

- **Dynamic Imports**: Prefer static imports at the top of the file over dynamic `await import()` calls within functions. Dynamic imports should only be used when truly necessary for code splitting or conditional loading.

## General Guidelines

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

## Testing Guidelines

### Mocking Best Practices
We should never mock our own source code in tests. Instead, use database fixtures and mock external dependencies only.

**❌ Don't do this:**
```python
@patch('src.services.get_application_by_name')
def test_something(mock_get_app):
    # Mocking our own code
```

**✅ Do this instead:**
```python
def test_something(mock_sql_session: Session):
    # Create real data in test database
    app = Application(name="Twitter", client_id="test")
    mock_sql_session.add(app)
    mock_sql_session.commit()
    
    # Test with real database interactions
```

Use `mock_sql_session` fixture to create test data in the database rather than mocking internal service functions.

### Test Categories

- Frontend tests: `npm t`
- Python tests: `npm run test:agent`
- Linting: `npm run lint`

## Pull Request Guidelines

- Create descriptive branch names following the pattern: `your_name/description`
- Include clear commit messages describing the changes
- Ensure all CI checks pass before requesting review
- Reference any related issues in the PR description
