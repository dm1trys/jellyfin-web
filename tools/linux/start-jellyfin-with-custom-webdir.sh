#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
node_bin="${NODE_BIN:-node}"
script_path="$repo_root/serve-dist.js"
dist_index="$repo_root/dist/index.html"
log_dir="$repo_root/.runtime-web"
stdout_log="$log_dir/stdout.log"
stderr_log="$log_dir/stderr.log"
backend_port="${BACKEND_PORT:-8096}"
web_client_port="${WEB_CLIENT_PORT:-8097}"
bind_host="${BIND_HOST:-0.0.0.0}"

is_listening() {
    local port="$1"
    ss -ltn "( sport = :$port )" 2>/dev/null | tail -n +2 | grep -q .
}

if ! command -v "$node_bin" >/dev/null 2>&1; then
    echo "Node.js executable not found: $node_bin" >&2
    exit 1
fi

if [[ ! -f "$dist_index" ]]; then
    echo "Build output not found in $repo_root/dist. Run 'npm run build:production' first." >&2
    exit 1
fi

mkdir -p "$log_dir"

if ! is_listening "$backend_port"; then
    if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files jellyfin.service >/dev/null 2>&1; then
        systemctl start jellyfin >/dev/null 2>&1 || true
    fi

    deadline=$((SECONDS + 25))
    while ! is_listening "$backend_port" && (( SECONDS < deadline )); do
        sleep 1
    done
fi

if ! is_listening "$backend_port"; then
    echo "Jellyfin backend is not listening on port $backend_port." >&2
    echo "Start Jellyfin first, then rerun this script." >&2
    exit 1
fi

if is_listening "$web_client_port"; then
    echo "Web client is already listening on http://$bind_host:$web_client_port"
    echo "Backend: http://127.0.0.1:$backend_port"
    exit 0
fi

nohup env WEB_CLIENT_PORT="$web_client_port" BIND_HOST="$bind_host" "$node_bin" "$script_path" >"$stdout_log" 2>"$stderr_log" </dev/null &
web_pid=$!

deadline=$((SECONDS + 10))
while ! is_listening "$web_client_port" && (( SECONDS < deadline )); do
    sleep 1
done

if ! is_listening "$web_client_port"; then
    echo "Custom web client did not start on port $web_client_port." >&2
    echo "See logs: $stdout_log $stderr_log" >&2
    exit 1
fi

echo "Backend: http://127.0.0.1:$backend_port"
echo "Custom web client: http://$bind_host:$web_client_port"
echo "PID: $web_pid"
