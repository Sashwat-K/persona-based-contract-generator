# IBM Confidential Computing Contract Generator

> Self-hosted, open-source platform to collaboratively build, verify, and deliver encrypted HPCR/HPCR4RHVS/HPCC userdata contracts with persona-based controls and cryptographic auditability.

The system enforces a linear multi-persona workflow with role + per-build assignment controls. All private-key operations happen on the desktop client; backend validates signatures, enforces workflow/state rules, and stores encrypted artifacts and audit metadata.

## Table of Contents
- [Key Capabilities](#key-capabilities)
- [Architecture](#architecture)
- [Workflow and Personas](#workflow-and-personas)
- [Security Model](#security-model)
- [Repository Structure](#repository-structure)
- [Getting Started](#getting-started)
- [Running the Desktop App](#running-the-desktop-app)
- [API and Operations Endpoints](#api-and-operations-endpoints)
- [Documentation](#documentation)

## Key Capabilities
- Persona-driven contract workflow (`ADMIN`, `SOLUTION_PROVIDER`, `DATA_OWNER`, `AUDITOR`, `ENV_OPERATOR`, `VIEWER`).
- Strict lifecycle enforcement from build creation through download acknowledgment.
- Assignment-based access (role alone is not enough to act on a build).
- Signed mutating API requests (`X-Signature*` headers) with backend verification.
- Hash-chained audit trail and verification APIs.
- Electron desktop app with IBM Carbon UI and local cryptographic execution.

## Architecture

```text
[ Electron Desktop App ]  <----HTTP/HTTPS---->  [ nginx Reverse Proxy ]  --->  [ Go Backend ]  --->  [ PostgreSQL ]
```

Principles:
- Client-side crypto: encryption/signing/contract assembly run on desktop client.
- Backend orchestration: state machine, authorization, signature verification, audit chain.
- Zero private-key exposure to backend.

## Workflow and Personas

Current build lifecycle:

```text
CREATED -> WORKLOAD_SUBMITTED -> ENVIRONMENT_STAGED -> AUDITOR_KEYS_REGISTERED -> CONTRACT_ASSEMBLED -> FINALIZED -> CONTRACT_DOWNLOADED
```

Cancellation is allowed from non-terminal pre-finalized states.

Persona responsibilities:
1. `SOLUTION_PROVIDER`: encrypts/submits workload section with hash + signature.
2. `DATA_OWNER`: encrypts environment section, wraps symmetric key for auditor, submits hash + signature.
3. `AUDITOR`: registers attestation stage readiness and finalizes contract with signature.
4. `ENV_OPERATOR`: exports finalized contract and submits signed download acknowledgment.
5. `ADMIN`: manages users/roles, creates builds, assigns build personas, may cancel eligible builds.
6. `VIEWER`: read-only visibility.

## Security Model
- Backend verifies mutating request signatures against registered user public keys.
- Build access uses two layers:
  - global role checks
  - explicit build assignment checks
- Setup guard blocks non-setup endpoints until required password/key setup is complete.
- Audit integrity is verifiable via hash chain + signature verification.
- Desktop app hardening includes sandboxed renderer, context isolation, sender-validated IPC, and blocked webviews.

For detailed controls, see [Security Design](./Design/5-security-design.md).

## Repository Structure

- `app/`: Electron + React + IBM Carbon desktop application.
- `backend/`: Go API server (`chi`, `pgx`, `sqlc`) and business/security logic.
- `config/nginx/`: reverse-proxy configs (`default.conf`, `tls.conf`).
- `scripts/`: helper scripts including bring-up bootstrap.
- `Design/`: architecture, API, security, and deployment documentation.

## Getting Started

### Prerequisites
- Docker + Docker Compose v2 (recommended)
- For local backend-only run: Go `1.25+`, PostgreSQL `16`
- For desktop app development: Node `>=25.9.0`, npm `>=11.12.1`

### Option 1: Full Stack via Docker Compose (Local HTTP)

1. Prepare environment:
   ```bash
   cp .env.example .env
   ```

2. Set required secrets/DB values in `.env`:
   - `POSTGRES_PASSWORD`
   - `ADMIN_PASSWORD`
   - `DATABASE_URL`
   - `MIGRATE_DATABASE_URL`

3. Start stack:
   ```bash
   docker compose -f docker-compose.yaml up -d --build
   ```

4. Validate:
   ```bash
   curl -sS http://localhost:8080/health
   ```

5. Stop:
   ```bash
   docker compose -f docker-compose.yaml down
   ```

Notes:
- Postgres data persists at `${POSTGRES_DATA_DIR:-./data/postgres}`.
- Initial admin seed (`ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`) runs only on empty DB.
- pgAdmin is available at `http://localhost:${PGADMIN_PORT:-5050}` (login with `PGADMIN_DEFAULT_EMAIL` / `PGADMIN_DEFAULT_PASSWORD`).
- Vault UI is available at `http://localhost:${VAULT_UI_PORT:-8000}` (use `VAULT_TOKEN`, default dev token: `dev-root-token`).

### Option 2: Production-Style Deployment (TLS)

1. Prepare `.env`:
   ```bash
   cp .env.example .env
   ```

2. Update production values:
   - strong `POSTGRES_PASSWORD` and `ADMIN_PASSWORD`
   - production `DATABASE_URL` / `MIGRATE_DATABASE_URL`
   - `NGINX_CONF_PATH=./config/nginx/tls.conf`
   - valid `TLS_CERT_PATH` and `TLS_KEY_PATH`
   - restrictive `CORS_ALLOWED_ORIGINS` and `CORS_ALLOW_ALL=false`

3. Start stack:
   ```bash
   docker compose -f docker-compose.yaml -f docker-compose.prod.yaml up -d --build
   ```

4. Validate:
   ```bash
   curl -k https://localhost:8443/health
   ```

5. Stop:
   ```bash
   docker compose -f docker-compose.yaml -f docker-compose.prod.yaml down
   ```

### Option 3: One-Command Bootstrap Script

```bash
curl -fsSL https://raw.githubusercontent.com/Sashwat-K/persona-based-contract-generator/main/scripts/bring_up.sh | bash
```

This script clones (if needed), generates strong passwords, writes `.env`, and starts compose.

### Option 4: Run Backend Locally (Without Compose)

From `backend/`:

```bash
DATABASE_URL="postgres://<user>:<pass>@localhost:5432/<db>?sslmode=disable" go run ./cmd/server/
```

(Ensure migrations are applied first.)

## Running the Desktop App

From `app/`:

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start dev mode (Vite + Electron):
   ```bash
   npm run dev
   ```

3. Configure backend server URL in login/server settings.

Useful scripts:
- `npm run build` (renderer build)
- `npm run package` (electron-builder package)
- `npm run package:mac|win|linux` (platform-specific packaging)

Detailed packaging guide: [app/BUILD.md](./app/BUILD.md)

## API and Operations Endpoints

Default local endpoints:
- Health: `GET /health`
- Swagger UI: `GET /swagger`
- OpenAPI JSON: `GET /openapi.json`

Build verification:
- `GET /builds/{id}/verify`
- `GET /builds/{id}/verify-contract`

## Documentation

- [High-Level Design](./Design/1-high-level-design.md)
- [Low-Level Design](./Design/2-low-level-design.md)
- [Desktop App Design](./Design/3-desktop-app-design.md)
- [API Documentation](./Design/4-api-documentation.md)
- [Security Design](./Design/5-security-design.md)
- [Deployment Guide](./Design/6-deployment-guide.md)
