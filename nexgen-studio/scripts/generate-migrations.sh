#!/usr/bin/env bash
set -euo pipefail

MESSAGE="${1:-schema update}"

cd "$(dirname "$0")/../backend"
alembic revision --autogenerate -m "$MESSAGE"
echo "Created migration with message: $MESSAGE"
