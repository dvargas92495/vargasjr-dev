FROM vellumai/python-workflow-runtime:latest

WORKDIR /app

RUN pip install --upgrade pip && pip install poetry

COPY pyproject.toml ./
COPY src ./src

RUN poetry config virtualenvs.create false

RUN poetry install --only=main

ENV PYTHONPATH="/app/src"

RUN mkdir -p /app/.memory

CMD ["vellum_start_server"]
