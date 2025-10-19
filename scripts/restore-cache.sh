#!/bin/bash
set -e

if [ -z "$CI" ] || [ -n "$VERCEL" ]; then
  echo "Not in CI or running in Vercel, skipping cache restoration"
  exit 0
fi

if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
  echo "AWS credentials not found, skipping cache restoration"
  exit 0
fi

echo "Restoring cache from S3..."

PACKAGE_LOCK_HASH=$(sha256sum package-lock.json | awk '{print $1}' | cut -c1-16)
CACHE_KEY="v1-deps-$(uname -s | tr '[:upper:]' '[:lower:]')-${PACKAGE_LOCK_HASH}"
S3_KEY="cache/${CACHE_KEY}.tar.gz"
TEMP_FILE="/tmp/cache-$(date +%s).tar.gz"

echo "Cache key: ${CACHE_KEY}"

if aws s3 cp "s3://vargas-jr-memory/${S3_KEY}" "${TEMP_FILE}" 2>/dev/null; then
  echo "✅ Cache found in S3, extracting..."
  tar -xzf "${TEMP_FILE}" -C "${HOME}"
  rm "${TEMP_FILE}"
  echo "Cache restored successfully"
else
  echo "Cache not found in S3, will create after npm install"
fi
