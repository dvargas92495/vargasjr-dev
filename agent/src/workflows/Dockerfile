FROM vellumai/python-workflow-runtime:latest

WORKDIR /app

RUN pip install --upgrade pip && pip install poetry

COPY pyproject.toml ./
COPY src ./src

RUN poetry config virtualenvs.create false

# Temporarily modify pyproject.toml to allow Python 3.11 and install without lock file
RUN sed -i 's/python = "^3.12"/python = "^3.11"/' pyproject.toml && \
    poetry install --only=main --no-cache

ENV PYTHONPATH="/app/src"

ENV POSTGRES_URL=""
ENV SLACK_BOT_TOKEN=""
ENV ODDS_API_KEY=""
ENV MERCURY_API_TOKEN=""
ENV CAPITAL_ONE_API_KEY=""
ENV GOOGLE_CREDENTIALS=""
ENV BRAINROT_OPENAI_API_KEY=""
ENV BRAINROT_EMAIL=""
ENV LOG_LEVEL="INFO"

ENV AWS_DEFAULT_REGION="us-east-1"

RUN mkdir -p /app/.memory

CMD ["vellum_start_server"]
