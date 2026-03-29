#!/usr/bin/env bash
set -euo pipefail

WEB_CLIENT_PORT="${WEB_CLIENT_PORT:-8097}"

mapfile -t pids < <(ss -ltnp "( sport = :$WEB_CLIENT_PORT )" 2>/dev/null | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u)

if [[ "${#pids[@]}" -eq 0 ]]; then
    echo "No process is listening on port $WEB_CLIENT_PORT"
    exit 0
fi

kill "${pids[@]}"
echo "Stopped process(es) on port $WEB_CLIENT_PORT: ${pids[*]}"
