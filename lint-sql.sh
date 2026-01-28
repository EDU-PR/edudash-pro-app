#!/usr/bin/env sh
set -e

DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
"$DIR/scripts/lint-sql.sh" "$@"
