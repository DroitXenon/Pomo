#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
"${PYTHON:-python3}" -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
