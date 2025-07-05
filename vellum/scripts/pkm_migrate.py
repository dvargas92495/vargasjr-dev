import importlib
import inspect
import pkgutil
import sys
from sqlmodel import SQLModel, text
from services import sqlite_session


if __name__ == "__main__":
    # Import the pkm models module
    dry_run = "--dry-run" in sys.argv
    pkm_module = importlib.import_module("models.pkm")

    pkm_models: list[type[SQLModel]] = []
    for _, name, _ in pkgutil.iter_modules(pkm_module.__path__):
        pkm_model_module = importlib.import_module(f"{pkm_module.__name__}.{name}")
        sql_model = next(
            (
                cls
                for _, cls in inspect.getmembers(pkm_model_module)
                if inspect.isclass(cls) and issubclass(cls, SQLModel) and cls != SQLModel
            ),
            None,
        )
        if not sql_model:
            raise ValueError(f"No SQLModel found in {pkm_model_module.__name__}")

        pkm_models.append(sql_model)

    # Create engine and tables
    with sqlite_session() as session:
        existing_tables = set(
            [
                row[0]
                for row in session.exec(
                    text(
                        """\
SELECT name 
FROM sqlite_master 
WHERE type='table'
AND name not like 'sqlite_%'"""
                    )
                ).fetchall()
            ]
        )

        models_to_create = [model for model in pkm_models if model.__tablename__ not in existing_tables]

        if models_to_create:
            for model in models_to_create:
                print(f"Creating table: {model.__tablename__}")
                if not dry_run:
                    SQLModel.metadata.create_all(session.bind, tables=[getattr(model, "__table__")])
        else:
            print("No models to create")

    print("Successfully migrated!")
