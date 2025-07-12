FROM vellumai/python-workflow-runtime:0.14.87

WORKDIR /app

RUN pip install --upgrade pip && pip install poetry

COPY pyproject.toml ./
COPY models ./models
COPY services ./services
COPY workflows ./workflows

RUN poetry config virtualenvs.create false

RUN poetry install --only=main

ENV PYTHONPATH="/app"

RUN mkdir -p /app/.memory

CMD ["vellum_start_server"]
