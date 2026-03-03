#!/usr/bin/env bash
set -euo pipefail

REPO_URL_DEFAULT="https://github.com/Sashwat-K/persona-based-contract-generator.git"
TARGET_DIR_DEFAULT="persona-based-contract-generator"
ENV_FILE=".env"
ENV_EXAMPLE_FILE=".env.example"

REPO_URL=""
TARGET_DIR=""
POSTGRES_PASSWORD_GEN=""
ADMIN_PASSWORD_GEN=""
POSTGRES_DB=""
POSTGRES_USER=""
ADMIN_EMAIL_VAL=""

usage() {
  cat <<'EOF'
Usage:
  bring_up.sh [target_dir]

Defaults:
  target_dir = persona-based-contract-generator

What it does:
  1. Clones the repository (if target_dir does not already exist)
  2. Generates random POSTGRES_PASSWORD and ADMIN_PASSWORD
  3. Writes .env from .env.example with generated passwords
  4. Starts infrastructure with docker compose up -d --build

Pipe-to-bash (use RAW URL, not /blob/ URL):
  curl -fsSL https://raw.githubusercontent.com/Sashwat-K/persona-based-contract-generator/main/scripts/bring_up.sh | bash
EOF
}

check_deps() {
  command -v git >/dev/null 2>&1 || { echo "git is required."; exit 1; }
  command -v docker >/dev/null 2>&1 || { echo "docker is required."; exit 1; }
}

parse_args() {
  if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    usage
    exit 0
  fi

  TARGET_DIR="${1:-$TARGET_DIR_DEFAULT}"
  REPO_URL="$REPO_URL_DEFAULT"
}

clone_repo_if_needed() {
  if [[ ! -d "$TARGET_DIR" ]]; then
    echo "Cloning repository into $TARGET_DIR ..."
    git clone "$REPO_URL" "$TARGET_DIR"
  else
    echo "Directory $TARGET_DIR already exists; skipping clone."
  fi
}

enter_repo_dir() {
  cd "$TARGET_DIR"
  if [[ ! -f "$ENV_EXAMPLE_FILE" ]]; then
    echo "$ENV_EXAMPLE_FILE not found in $TARGET_DIR"
    exit 1
  fi
}

generate_password() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 32 | tr -d '\n' | tr '/+' '_-' | cut -c1-32
  else
    # Fallback to /dev/urandom if openssl is unavailable.
    LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32
  fi
}

set_env_value() {
  local key="$1"
  local value="$2"
  if grep -qE "^${key}=" "$ENV_FILE"; then
    sed -i.bak "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

prepare_env() {
  POSTGRES_PASSWORD_GEN="$(generate_password)"
  ADMIN_PASSWORD_GEN="$(generate_password)"

  cp "$ENV_EXAMPLE_FILE" "$ENV_FILE"

  POSTGRES_DB="$(grep -E '^POSTGRES_DB=' "$ENV_FILE" | cut -d= -f2- || true)"
  POSTGRES_USER="$(grep -E '^POSTGRES_USER=' "$ENV_FILE" | cut -d= -f2- || true)"
  ADMIN_EMAIL_VAL="$(grep -E '^ADMIN_EMAIL=' "$ENV_FILE" | cut -d= -f2- || true)"

  POSTGRES_DB="${POSTGRES_DB:-hpcr_builder}"
  POSTGRES_USER="${POSTGRES_USER:-hpcr}"
  ADMIN_EMAIL_VAL="${ADMIN_EMAIL_VAL:-admin@hpcr-builder.local}"

  set_env_value "POSTGRES_PASSWORD" "$POSTGRES_PASSWORD_GEN"
  set_env_value "ADMIN_PASSWORD" "$ADMIN_PASSWORD_GEN"
  set_env_value "DATABASE_URL" "postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD_GEN}@postgres:5432/${POSTGRES_DB}?sslmode=disable"
  set_env_value "MIGRATE_DATABASE_URL" "postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD_GEN}@postgres:5432/${POSTGRES_DB}?sslmode=disable"

  rm -f "${ENV_FILE}.bak"
}

start_stack() {
  echo "Starting infrastructure with docker compose ..."
  docker compose up -d --build
}

print_summary() {
  echo
  echo "Infrastructure is starting."
  echo "Generated secrets are stored in: $(pwd)/$ENV_FILE"
  echo "API endpoint (via reverse proxy): http://localhost:\${REVERSE_PROXY_PORT:-8080}"
  echo "Admin username (email): ${ADMIN_EMAIL_VAL}"
  echo "Admin password: ${ADMIN_PASSWORD_GEN}"
  echo "Note: admin credentials are used only for initial seeding on a fresh database."
}

main() {
  parse_args "${1:-}"
  check_deps
  clone_repo_if_needed
  enter_repo_dir
  prepare_env
  start_stack
  print_summary
}

main "$@"
