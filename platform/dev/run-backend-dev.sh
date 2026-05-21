#!/usr/bin/env sh
set -u

cd "$(dirname "$0")/.."

export ARCHESTRA_LOGGING_LEVEL=debug
export ARCHESTRA_ANALYTICS=disabled

if [ "${ARCHESTRA_CODE_RUNTIME_ENABLED:-}" != "true" ]; then
  pnpm dev --filter @backend &
  backend_pid=$!
  trap 'pkill -TERM -P $$ 2>/dev/null; wait "$backend_pid" 2>/dev/null' EXIT INT TERM
  wait "$backend_pid"
  exit $?
fi

engine_namespace="dagger"
engine_selector="name=dagger-dagger-helm-engine"
backend_pid=""
current_engine_host=""

resolve_engine_host() {
  pod_name=$(kubectl get pod \
    --selector="$engine_selector" \
    --namespace="$engine_namespace" \
    --field-selector=status.phase=Running \
    --output=jsonpath='{.items[0].metadata.name}' 2>/dev/null)

  if [ -z "$pod_name" ]; then
    return 1
  fi

  printf 'kube-pod://%s?namespace=%s\n' "$pod_name" "$engine_namespace"
}

stop_backend() {
  if [ -n "$backend_pid" ] && kill -0 "$backend_pid" 2>/dev/null; then
    kill -TERM "$backend_pid" 2>/dev/null || true
    pkill -TERM -P "$backend_pid" 2>/dev/null || true
    wait "$backend_pid" 2>/dev/null || true
  fi
  backend_pid=""
}

start_backend() {
  while true; do
    current_engine_host=$(resolve_engine_host) && break
    sleep 2
  done

  export ARCHESTRA_CODE_RUNTIME_DAGGER_ENGINE_HOST="$current_engine_host"
  pnpm dev --filter @backend &
  backend_pid=$!
}

cleanup() {
  stop_backend
}

trap cleanup EXIT INT TERM

start_backend

while kill -0 "$backend_pid" 2>/dev/null; do
  sleep 2
  next_engine_host=$(resolve_engine_host || true)
  if [ -n "$next_engine_host" ] && [ "$next_engine_host" != "$current_engine_host" ]; then
    stop_backend
    start_backend
  fi
done

wait "$backend_pid"
