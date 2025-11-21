# Contributing to Vargas JR

## Style Guide

### Python Code Style

- **Import Organization**: All imports should be placed at the top of the file where possible. Avoid inline imports within functions unless absolutely necessary for lazy loading or conditional imports.

### TypeScript Code Style

- **Dynamic Imports**: Prefer static imports at the top of the file over dynamic `await import()` calls within functions. Dynamic imports should only be used when truly necessary for code splitting or conditional loading.

## General Guidelines

- Follow existing code patterns and conventions in the codebase
- Ensure all tests pass before submitting changes
- Run linting checks with `npm run lint` before committing

## Development Setup

### Frontend (Next.js)

```bash
npm install
npm run dev
```

### Vellum Workflows (Python)

```bash
cd vellum
poetry install
```

### Vellum Container Image Updates

When making changes to `vellum/services/` or `vellum/models/`, you must update the container image version:

```bash
npm run upgrade-vargasjr-image
```

This command will:

1. Increment the patch version in `vellum/vellum.lock.json`
2. Update all workflow entries with the new container image tag

After running this command:

1. Commit the `vellum.lock.json` changes along with your code changes
2. Push your changes to trigger the CI workflow
3. The CI will automatically build and push the new container image when it detects lock file changes

## Testing Guidelines

### Mocking Best Practices

We should never mock our own source code in tests. Instead, use database fixtures and mock external dependencies only.

**This rule is automatically enforced by ESLint for test files.**

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
- Linting: `npm run lint`

## Pull Request Guidelines

- Create descriptive branch names following the pattern: `your_name/description`
- Include clear commit messages describing the changes
- Ensure all CI checks pass before requesting review
- Reference any related issues in the PR description
