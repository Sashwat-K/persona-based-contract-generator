# HPCR Contract Builder

> **HPCR Contract Builder** is a self-hosted, open-source system that enables organizations to collaboratively construct, sign, and finalize encrypted userdata contracts (YAML format) for HPCR (Hyper Protect Container Runtime), HPCR4RHVS, and HPCC deployments.

The system enforces a strict, linear, multi-persona workflow. Each persona contributes exactly once per build. Once finalized, the contract becomes immutable.

## Table of Contents
- [Architecture & Principles](#architecture--principles)
- [Workflow Personas](#workflow-personas)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Documentation](#documentation)

## Architecture & Principles
- **Client-Side Crypto:** All cryptographic operations (encryption, signing, contract assembly) are executed locally on the client (e.g., the Flutter desktop application). 
- **Zero-Knowledge Backend:** The Go backend **never** performs encryption, signing, or contract assembly. It only orchestrates the workflow, verifies signatures, stores encrypted artifacts, and maintains an audit hash chain.
- **Auditability:** Every action produces a deterministic hash chain event, ensuring a tamper-evident audit trail.
- **Immutability:** The final artifact is a signed and encrypted YAML contract file that cannot be modified once assembled.

## Workflow Personas

The contract building process follows a strict linear progression, with distinct duties:

1. **Solution Provider:** Provides the workload definition and encryption certificate. Encrypts the workload locally and signs the hash.
2. **Data Owner:** Provides logging credentials and environment configuration. Generates a random symmetric key locally to encrypt the environment section, then signs and uploads the encrypted payload.
3. **Auditor:** Provides the attestation public key and signing key/cert. Downloads the staged encrypted payloads, decrypts them locally, performs the final contract assembly, and signs the final `.yaml` artifact.
4. **Env Operator:** Downloads the finalized YAML contract to deploy to the HPCR instance. (No cryptographic operations performed).
5. **Admin:** Manages users, assigns roles, and can cancel pre-finalized builds.
6. **Viewer:** Has read-only access to builds and audit logs.

## Project Structure

This repository is a monorepo containing:

- **`backend/`**: The Go-based API server using `chi` for routing, `pgx`/`sqlc` for PostgreSQL persistence, and structured `slog` logging.
- **`Design/`**: Contains architectural documentation (HLD, LLD, and Project Timeline).

*(Note: The Flutter Desktop Application is planned for the next development phase).*

## Getting Started

### Prerequisites
- [Go](https://go.dev/) 1.22+
- [PostgreSQL](https://www.postgresql.org/) 16
- [golang-migrate](https://github.com/golang-migrate/migrate) CLI (for DB migrations)
- (Optional) Docker & Docker Compose for local deployment

### Running the Backend Locally

1. **Start PostgreSQL:**
   ```bash
   docker run -d --name hpcr-postgres -e POSTGRES_DB=hpcr_builder -e POSTGRES_USER=hpcr -e POSTGRES_PASSWORD=devpass -p 5432:5432 postgres:16-alpine
   ```

2. **Run Migrations:**
   ```bash
   docker run --rm -v "$PWD/backend/migrations:/migrations" --network host migrate/migrate \
  -path=/migrations \
  -database "postgres://hpcr:devpass@localhost:5432/hpcr_builder?sslmode=disable" up
   ```

3. **Start the API Server:**
   ```bash
   DATABASE_URL="postgres://hpcr:devpass@localhost:5432/hpcr_builder?sslmode=disable" go run ./cmd/server/
   ```

4. **Open API Documentation (Swagger UI):**
   - Swagger UI: `http://localhost:8080/swagger`
   - OpenAPI JSON: `http://localhost:8080/openapi.json`

*(On first boot with an empty database, the server will automatically seed an initial `System Admin` user).*

## Documentation
For detailed architectural choices and API contracts, refer to the documents in the `Design/` directory:
- [High-Level Design (HLD)](Design/high-level-design.md)
- [Low-Level Design (LLD)](Design/low-level-design.md)
- [Project Timeline](Design/project-timeline.md)
