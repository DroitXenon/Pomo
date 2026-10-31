#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
if ! command -v conda >/dev/null 2>&1; then
  printf '%s\n' 'Conda is required. Install Miniconda or Miniforge, then run sh scripts/setup.sh.' >&2
  exit 1
fi
exec conda run --no-capture-output --name pomo python -m backend
