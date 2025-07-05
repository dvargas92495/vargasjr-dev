from services.aws import download_memory
import logging

logger = logging.getLogger(__name__)

if __name__ == "__main__":
    download_memory(logger)

