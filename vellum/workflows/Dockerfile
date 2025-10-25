FROM vellumai/python-workflow-runtime:1.8.0

WORKDIR /app

RUN pip install --upgrade pip && pip install poetry

COPY pyproject.toml ./
COPY poetry.lock ./
COPY models ./models
COPY services ./services
COPY evals ./evals
COPY workflows ./workflows

RUN poetry config virtualenvs.create false

RUN poetry install --only=main

ENV PYTHONPATH="/app"

RUN mkdir -p /app/.memory

CMD ["vellum_start_server"]
