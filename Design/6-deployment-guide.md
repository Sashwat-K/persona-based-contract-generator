# IBM Confidential Computing Contract Generator - Deployment Guide

> **Version:** 1.1  
> **Date:** 2026-04-18  
> **Status:** Implementation-aligned runbook  
> **Source of Truth:** `docker-compose.yaml`, `docker-compose.prod.yaml`, `config/nginx/*.conf`, `backend/cmd/server/main.go`, `app/BUILD.md`

---

## 1. Purpose

This guide documents how to deploy and operate the current stack safely in:

- local/dev environments
- production-like environments with TLS

It also includes upgrade, rollback, validation, and operational checks.

---

## 2. Runtime Topology

Default container topology:

- `reverse_proxy` (nginx, public entrypoint)
- `backend` (Go API)
- `postgres` (PostgreSQL 16)
- `vault` (HashiCorp Vault, Transit secrets engine)
- `migrate` (one-shot schema migration job)

Traffic flow:

```
Client -> reverse_proxy -> backend -> postgres
                             |-> vault (key management)
```

Network layout:

- `app_net`: reverse proxy <-> backend <-> vault
- `db_net` (`internal: true`): backend/migrate <-> postgres

---

## 3. Prerequisites

### 3.1 Server-side

- Docker Engine with Compose v2 (`docker compose`)
- Access to TLS cert/key files for production deployment
- Host with persistent storage path for Postgres data

### 3.2 Desktop client

- Electron desktop app package built from `app/` (see `app/BUILD.md`)
- Access from desktop client to reverse proxy endpoint

---

## 4. Configuration Inputs

Primary config file:

- `.env` (copy from `.env.example`)

Critical values to set before production:

- `POSTGRES_PASSWORD`
- `ADMIN_PASSWORD`
- `DATABASE_URL`
- `MIGRATE_DATABASE_URL`
- `NGINX_CONF_PATH=./config/nginx/tls.conf`
- `TLS_CERT_PATH`
- `TLS_KEY_PATH`
- `CORS_ALLOWED_ORIGINS`
- `CORS_ALLOW_ALL=false`

Important backend runtime controls:

- `TOKEN_EXPIRY`
- `BCRYPT_COST`
- `MAX_PAYLOAD_SIZE`
- `REQUEST_TIMEOUT`
- `TRUST_PROXY_HEADERS` (keep `true` only behind trusted reverse proxy)

### V2: Key Provider and Vault Configuration

| Variable | Default | Purpose |
|---|---|---|
| `KEY_PROVIDER` | `mock` | Set to `vault` for production |
| `VAULT_ADDR` | `http://vault:8200` | Vault server address |
| `VAULT_AUTH_METHOD` | `approle` | `approle` (production) or `token` (dev) |
| `VAULT_ROLE_ID` | | Required for AppRole auth |
| `VAULT_SECRET_ID` | | Required for AppRole auth |
| `VAULT_TOKEN` | | Dev root token (alternative to AppRole) |
| `VAULT_TRANSIT_MOUNT` | `transit` | Transit engine mount path |
| `VAULT_REQUEST_TIMEOUT` | `10s` | API timeout |

For local/dev mode, `KEY_PROVIDER=mock` bypasses Vault entirely.

---

## 5. Local/Dev Deployment (HTTP)

### 5.1 Prepare environment

```bash
cp .env.example .env
```

Set at least:

- `POSTGRES_PASSWORD`
- `ADMIN_PASSWORD`
- `DATABASE_URL`
- `MIGRATE_DATABASE_URL`

For local HTTP mode, keep:

- `NGINX_CONF_PATH=./config/nginx/default.conf`

### 5.2 Start stack

```bash
docker compose -f docker-compose.yaml up -d --build
```

### 5.3 Validate

```bash
docker compose ps
curl -sS http://localhost:8080/health
```

Expected health response:

```json
{"status":"ok"}
```

Vault health (dev mode):

```bash
curl -sS http://localhost:8200/v1/sys/health
```

### 5.4 Stop stack

```bash
docker compose -f docker-compose.yaml down
```

---

## 6. Production Deployment (TLS)

### 6.1 Prepare `.env`

```bash
cp .env.example .env
```

Required production updates:

- strong `POSTGRES_PASSWORD` and `ADMIN_PASSWORD`
- production DB credentials in `DATABASE_URL` and `MIGRATE_DATABASE_URL`
- `NGINX_CONF_PATH=./config/nginx/tls.conf`
- valid `TLS_CERT_PATH` and `TLS_KEY_PATH`
- restrictive `CORS_ALLOWED_ORIGINS`
- `CORS_ALLOW_ALL=false`
- `KEY_PROVIDER=vault`
- production Vault address, AppRole credentials, and Transit mount

### 6.2 Start stack with production overlay

```bash
docker compose -f docker-compose.yaml -f docker-compose.prod.yaml up -d --build
```

Default TLS endpoint:

- `https://localhost:8443`

Health check:

```bash
curl -k https://localhost:8443/health
```

### 6.3 HTTP exposure note

Base compose maps port `8080` for HTTP. The prod overlay adds TLS mapping (`8443 -> 443`).

For strict production posture:

- ensure only intended public ports are exposed at infrastructure/firewall level
- if needed, use an environment-specific compose file that removes HTTP host mapping

---

## 7. Bootstrapping and Admin Seed Behavior

On empty database startup, backend seeds initial admin user from:

- `ADMIN_NAME`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

Important:

- seed occurs only when no users exist
- first login still requires setup completion (password/public key flow)

---

## 8. Database Migration Lifecycle

`migrate` service runs before backend startup:

- migration path: `backend/migrations`
- command: `up`

Operational checks:

```bash
docker compose logs migrate
```

If migration fails:

- backend will not reach healthy state
- fix migration issue and restart compose deployment

---

## 9. Post-Deploy Validation Checklist

After deployment, validate:

1. `GET /health` returns `{"status":"ok"}`
2. `GET /swagger` loads
3. login works for admin
4. setup-guard behavior works for setup-incomplete users
5. mutating endpoint calls fail without signature headers
6. one full build lifecycle succeeds through `CONTRACT_DOWNLOADED`:
   - v2 flow: signing key → workload → env → attestation key → finalize → download acknowledge
7. verify endpoints pass for completed build:
   - `/builds/{id}/verify`
   - `/builds/{id}/verify-contract`
8. If `KEY_PROVIDER=vault`: verify Vault health (`/v1/sys/health`) and Transit key creation works

---

## 10. Operations Runbook

### 10.1 Logs

```bash
docker compose logs -f reverse_proxy
docker compose logs -f backend
docker compose logs -f postgres
docker compose logs -f vault
```

### 10.2 Health and status

```bash
docker compose ps
curl -sS http://localhost:8080/health
curl -sS http://localhost:8200/v1/sys/health  # Vault
```

(Use `https://...:8443/health` in TLS mode.)

### 10.3 Vault Operations

Check Transit engine:

```bash
# List Transit keys (dev token)
curl -sS -H "X-Vault-Token: dev-root-token" \
  http://localhost:8200/v1/transit/keys?list=true
```

Vault dev mode notes:

- Dev server uses in-memory storage (data lost on restart).
- For production, use a proper Vault cluster with persistent storage and auto-unseal.

### 10.4 Restart services

```bash
docker compose restart backend
docker compose restart reverse_proxy
```

---

## 11. Upgrade Procedure

Recommended zero-surprise sequence:

1. Backup PostgreSQL data.
2. Pull/update code and verify `.env` compatibility.
3. Review migration changes in `backend/migrations`.
4. Deploy with rebuild:

```bash
docker compose -f docker-compose.yaml -f docker-compose.prod.yaml up -d --build
```

5. Run post-deploy validation checklist.

---

## 12. Rollback Procedure

If deployment fails validation:

1. stop updated stack
2. redeploy previous known-good image/tag/config
3. restore DB from backup if schema/data incompatibility occurred
4. re-run health and verification checks

Always test rollback in a staging environment before production rollout.

---

## 13. Backup and Recovery Considerations

Minimum coverage:

- PostgreSQL data directory (`POSTGRES_DATA_DIR`) or logical DB dumps
- `.env` (securely stored)
- TLS cert/key source of truth
- Vault data/storage (production Vault cluster snapshots)

Recommended:

- scheduled encrypted backups
- periodic restore drills
- documented RPO/RTO targets

---

## 14. Desktop Client Deployment Notes

- Build and package desktop app from `app/` using `app/BUILD.md`.
- Distribute signed binaries where possible.
- Configure backend URL in client login/server settings.
- Ensure client can reach reverse proxy endpoint and trust its TLS cert chain.

---

## 15. Security-Focused Deployment Checklist

Before go-live:

- TLS enabled (`tls.conf`) and valid cert chain mounted read-only
- strong secrets in `.env`
- `CORS_ALLOW_ALL=false`
- restricted `CORS_ALLOWED_ORIGINS`
- `TRUST_PROXY_HEADERS` aligned with actual proxy topology
- `KEY_PROVIDER=vault` with production Vault cluster
- Vault AppRole credentials configured (not dev root token)
- Vault key policies configured for least-privilege, build-scoped runtime retrieval by backend only
- Vault on internal network only
- infrastructure-level firewall rules in place
- system logs and audit verification tested

---

## 16. Related Documents

- [Security Design](./5-security-design.md)
- [High-Level Design](./1-high-level-design.md)
- [Low-Level Design](./2-low-level-design.md)
- [Desktop App Design](./3-desktop-app-design.md)
- [API Documentation](./4-api-documentation.md)
