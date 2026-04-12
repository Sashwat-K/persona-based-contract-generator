# IBM Confidential Computing Contract Generator - Low-Level Design (LLD)

> **Version:** 0.3  
> **Date:** 2026-04-12  
> **Status:** Draft  
> **Parent Document:** [1-high-level-design.md](./1-high-level-design.md)

---

## 1. Scope and Source of Truth

This document is implementation-aligned to the current codebase in:

- `backend/` (Go + chi + sqlc + PostgreSQL)
- `app/` (Electron + React + Carbon)

If this document conflicts with code, code is authoritative.

---

## 2. Codebase Structure

### 2.1 Backend

```text
backend/
  cmd/server/main.go
  internal/
    config/config.go
    crypto/{hash.go,signature.go}
    middleware/
      auth.go
      context.go
      cors.go
      hardening.go
      logging.go
      ratelimit.go
      rbac.go
      setup_guard.go
      signature.go
      system_log_hook.go
    handler/
      auth_handler.go
      user_handler.go
      role_handler.go
      build_handler.go
      section_handler.go
      assignment_handler.go
      audit_handler.go
      export_handler.go
      rotation_handler.go
      system_log_handler.go
      swagger_handler.go
      response.go
    model/
      user.go
      build.go
      audit.go
      errors.go
    repository/
      queries/*.sql
      *.sql.go (sqlc generated)
      db.go, models.go, querier.go
    service/
      auth_service.go
      user_service.go
      role_service.go
      build_service.go
      section_service.go
      assignment_service.go
      audit_service.go
      verification_service.go
      export_service.go
      rotation_service.go
      system_log_service.go
  migrations/*.sql
```

### 2.2 Desktop App

```text
app/
  main/
    index.js
    preload.js
    crypto/
      contractCli.js
      encryptor.js
      keyManager.js
      keyStorage.js
      signer.js
  src/
    App.jsx
    views/
      Login.jsx
      Home.jsx
      BuildManagement.jsx
      BuildDetails.jsx
      AccountSettings.jsx
      UserManagement.jsx
      AdminAnalytics.jsx
      SystemLogs.jsx
      NotFound.jsx
      ServerConfigSettings.jsx
    components/
      AppShell.jsx
      DesktopTitleBar.jsx
      BuildAssignments.jsx
      SectionSubmit.jsx
      AuditorSection.jsx
      FinaliseContract.jsx
      ContractExport.jsx
      AuditViewer.jsx
      PasswordManager.jsx
      PublicKeyManager.jsx
      CredentialRotation.jsx
      APITokenManager.jsx
      ToastManager.jsx
      ErrorBoundary.jsx
      ...
    services/
      apiClient.js
      signatureMiddleware.js
      authService.js
      userService.js
      roleService.js
      buildService.js
      assignmentService.js
      sectionService.js
      exportService.js
      verificationService.js
      rotationService.js
      systemLogService.js
      tokenService.js
      cryptoService.js
    store/
      authStore.js
      buildStore.js
      configStore.js
      userStore.js
      rotationStore.js
      uiStore.js
      themeStore.js
```

---

## 3. Backend Runtime Pipeline

Middleware order in `cmd/server/main.go`:

1. `Recoverer`
2. `RequestID`
3. `SecurityHeaders`
4. `Logging`
5. `CORS`
6. `MaxBodyBytes`
7. `RequestTimeout`
8. `RateLimit`

Authenticated group adds:

1. `Auth`
2. `SetupGuard`
3. `RequireRequestSignature`

### 3.1 Setup Guard

When setup is incomplete (`must_change_password` or missing/expired public key), only these endpoints are allowed:

- `POST /auth/logout`
- `PATCH /users/{id}/password` (owner only)
- `PUT /users/{id}/public-key` (owner only)

All other endpoints return `403 ACCOUNT_SETUP_REQUIRED`.

### 3.2 Request Signature Guard

All authenticated mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`) require:

- `X-Signature`
- `X-Signature-Hash`
- `X-Timestamp`
- optional `X-Key-Fingerprint`

Exemptions:

- `POST /auth/logout`
- `PATCH /users/{id}/password`
- `PUT /users/{id}/public-key`

Verification is performed against the caller's registered public key.

---

## 4. Authorization Model

### 4.1 Roles

System roles:

- `ADMIN`
- `SOLUTION_PROVIDER`
- `DATA_OWNER`
- `AUDITOR`
- `ENV_OPERATOR`
- `VIEWER`

### 4.2 Two-Layer Build Access

Build operations are protected by both:

1. global role checks (RBAC)
2. per-build assignment checks

Implemented by:

- router-level role middleware (`RequireRole`, `RequireOwnerOrAdmin`)
- build-level middleware (`RequireBuildAccess`) on `/builds/{id}/...`
- service-level assignment checks (`AssignmentService`, `BuildService`, `ExportService`, `SectionService`)

### 4.3 Build Visibility Rules

- `GET /builds`
  - `ADMIN`: sees all builds
  - non-admin: sees only builds where user has at least one assignment
- `GET /builds/{id}` and all nested build routes
  - `ADMIN`: full access
  - non-admin: only if assigned to that build

### 4.4 Assignment Creation Rules

`POST /builds/{id}/assignments` (admin only) enforces:

- build is non-terminal
- role is workflow-assignable (`SOLUTION_PROVIDER`, `DATA_OWNER`, `AUDITOR`, `ENV_OPERATOR`)
- assignee exists
- assignee has the target global role
- role not already assigned for that build/user pair

---

## 5. Database Design

## 5.1 Migrations

Current migration chain (001..015) defines users, roles, tokens, builds, sections, assignments, audit events, system logs, and downloaded terminal status.

## 5.2 Enumerations

`build_status`:

- `CREATED`
- `WORKLOAD_SUBMITTED`
- `ENVIRONMENT_STAGED`
- `AUDITOR_KEYS_REGISTERED`
- `CONTRACT_ASSEMBLED`
- `FINALIZED`
- `CANCELLED`
- `CONTRACT_DOWNLOADED` (added in migration 015)

`persona_role` enum is still used by `user_roles.role`.

`audit_event_type` includes:

- `BUILD_CREATED`
- `WORKLOAD_SUBMITTED`
- `ENVIRONMENT_STAGED`
- `AUDITOR_KEYS_REGISTERED`
- `CONTRACT_ASSEMBLED`
- `BUILD_FINALIZED`
- `BUILD_CANCELLED`
- `CONTRACT_DOWNLOADED`
- plus system/user/token events

## 5.3 Core Tables

### users

Identity + credential-rotation fields:

- `must_change_password`
- `password_changed_at`
- `public_key`
- `public_key_fingerprint`
- `public_key_registered_at`
- `public_key_expires_at`

### user_roles

Global RBAC assignments; uses `persona_role` enum column `role`.

### roles

Reference table used by build assignments and build sections (`role_id`).

### api_tokens

- stores only `token_hash` (SHA-256)
- no `expires_at` column
- validity window enforced from `created_at + TOKEN_EXPIRY`
- supports `last_used_at`, `revoked_at`

### builds

- lifecycle state + final artifact fields
- `contract_yaml`, `contract_hash`, `is_immutable`, `finalized_at`

### build_assignments

Per-build role binding (`build_id`, `role_id`, `user_id`), with admin assigner metadata.

### build_sections

Encrypted persona submissions with:

- `persona_role`
- `role_id`
- `encrypted_payload`
- `wrapped_symmetric_key` (data owner flow)
- `section_hash`
- `signature`

### audit_events

Tamper-evident chain fields:

- `sequence_no`
- `previous_event_hash`
- `event_hash`
- `signature`
- `actor_public_key`
- `actor_key_fingerprint`

`build_id` is nullable to allow system-level events.

### system_logs

Operational log feed for admin/auditor views.

---

## 6. Build State Machine

Linear transitions:

- `CREATED -> WORKLOAD_SUBMITTED`
- `WORKLOAD_SUBMITTED -> ENVIRONMENT_STAGED`
- `ENVIRONMENT_STAGED -> AUDITOR_KEYS_REGISTERED`
- `AUDITOR_KEYS_REGISTERED -> CONTRACT_ASSEMBLED`
- `CONTRACT_ASSEMBLED -> FINALIZED`
- `FINALIZED -> CONTRACT_DOWNLOADED`

Cancellation:

- `-> CANCELLED` from any pre-finalized, non-terminal state

Terminal statuses:

- `FINALIZED`
- `CONTRACT_DOWNLOADED`
- `CANCELLED`

Role + assignment required per transition:

- `WORKLOAD_SUBMITTED`: `SOLUTION_PROVIDER`
- `ENVIRONMENT_STAGED`: `DATA_OWNER`
- `AUDITOR_KEYS_REGISTERED`: `AUDITOR`
- `CONTRACT_ASSEMBLED`: `AUDITOR`
- `FINALIZED`: `AUDITOR`
- `CONTRACT_DOWNLOADED`: `ENV_OPERATOR` (only via acknowledge-download flow)

Additional rules:

- `PATCH /builds/{id}/status` cannot set `CONTRACT_DOWNLOADED`
- downloaded acknowledgement is one-time
- re-export/userdata/download acknowledgement blocked once downloaded

---

## 7. Service-Level Behavior

### 7.1 AuthService

- email/password validation with bcrypt
- issues random bearer token
- stores SHA-256 token hash
- returns token expiry timestamp as `now + TOKEN_EXPIRY`
- computes setup requirements from password/public-key state

### 7.2 UserService

- user CRUD and role updates (admin)
- token creation/revocation/list
- public key register/read
- password change and admin reset
- setup-state computation

### 7.3 BuildService

- build creation and retrieval
- assignment-aware list filtering (`ListBuildsForUser`)
- strict transition enforcement + transition-role checks
- assignment check for transition actor
- finalize requires assigned auditor

### 7.4 SectionService

- role resolution by `role_id` (or fallback `persona_role`)
- validates assignment + required current state
- data owner requires wrapped symmetric key
- blocks duplicate section submissions by role
- auto-transitions build status after successful submit

### 7.5 AssignmentService

- enforces workflow-role assignment constraints
- enforces assignee holds target global role
- emits assignment audit event

### 7.6 AuditService + VerificationService

- deterministic hash-chain append
- actor key fingerprint capture
- full-chain verification:
  - sequence continuity
  - previous-hash linkage
  - event-hash recomputation
  - required signature checks for signed stages

Signed-stage expectation in verification:

- `WORKLOAD_SUBMITTED`
- `ENVIRONMENT_STAGED`
- `AUDITOR_KEYS_REGISTERED`
- `CONTRACT_ASSEMBLED`
- `BUILD_FINALIZED`
- `CONTRACT_DOWNLOADED`

### 7.7 ExportService

- export/userdata only for assigned `ENV_OPERATOR` on finalized builds
- `acknowledge-download` verifies hash + signature + assignee
- writes `CONTRACT_DOWNLOADED` audit event
- moves build to `CONTRACT_DOWNLOADED`

### 7.8 RotationService

- expired credential reporting
- admin force-password-change
- admin public-key revocation
- background monitor (24h interval from server startup)

---

## 8. Route and Access Matrix (Current)

Legend:

- `Auth`: authenticated bearer token required
- `Sig`: request-signature headers required
- `BuildAccess`: admin OR assigned to that build

### 8.1 Public

- `GET /health`
- `GET /openapi.json`
- `GET /swagger`
- `GET /swagger/`
- `POST /auth/login`

### 8.2 User/Auth

- `POST /auth/logout` - Auth, signature exempt
- `GET /roles` - Auth

- `GET /users` - ADMIN
- `POST /users` - ADMIN
- `PATCH /users/{id}` - ADMIN
- `PATCH /users/{id}/roles` - ADMIN
- `DELETE /users/{id}` - ADMIN
- `PATCH /users/{id}/reactivate` - ADMIN
- `PATCH /users/{id}/reset-password` - ADMIN

- `PUT /users/{id}/public-key` - owner or ADMIN, signature exempt
- `GET /users/{id}/public-key` - owner or ADMIN
- `PATCH /users/{id}/password` - owner or ADMIN, signature exempt

- `GET /users/{id}/tokens` - owner or ADMIN
- `POST /users/{id}/tokens` - owner or ADMIN, Sig
- `DELETE /users/{id}/tokens/{token_id}` - owner or ADMIN, Sig

- `GET /users/{id}/assignments` - owner or ADMIN

### 8.3 System Logs

- `GET /system-logs` - ADMIN or AUDITOR

### 8.4 Builds

- `GET /builds` - Auth, assignment-filtered for non-admin
- `POST /builds` - ADMIN, Sig

All `/builds/{id}/...` routes enforce BuildAccess middleware:

- `GET /builds/{id}`
- `PATCH /builds/{id}/status` (Sig)
- `POST /builds/{id}/attestation` - AUDITOR, Sig
- `POST /builds/{id}/finalize` - AUDITOR, Sig
- `POST /builds/{id}/cancel` - ADMIN, Sig

- `GET /builds/{id}/sections`
- `POST /builds/{id}/sections` (Sig)

- `GET /builds/{id}/audit`
- `GET /builds/{id}/audit-trail`

- `GET /builds/{id}/assignments`
- `POST /builds/{id}/assignments` - ADMIN, Sig
- `DELETE /builds/{id}/assignments` - ADMIN, Sig

- `GET /builds/{id}/export`
- `GET /builds/{id}/userdata`
- `POST /builds/{id}/acknowledge-download` (Sig)
- `GET /builds/{id}/verify`
- `GET /builds/{id}/verify-contract`

Export/userdata/acknowledge still enforce assigned ENV_OPERATOR at service level.

### 8.5 Rotation

- `GET /rotation/expired` - ADMIN
- `POST /rotation/force-password-change/{user_id}` - ADMIN, Sig
- `POST /rotation/revoke-key/{user_id}` - ADMIN, Sig

---

## 9. Frontend/Electron Implementation Notes

## 9.1 App Shell and Role Switching

- `App.jsx` restores role set from persisted auth state
- current role can be switched only among server-returned roles
- UI route availability changes on role switch
- backend still enforces access server-side

## 9.2 Build Management

- admin-only create-build flow
- role-specific assignee dropdowns
- assignee must be setup-ready and have target global role
- active/completed build tables with pagination

## 9.3 Build Details Tabs by Role

- ADMIN: Assignments, Audit
- SOLUTION_PROVIDER: Assignments, Add Workload, Audit
- DATA_OWNER: Assignments, Add Environment, Audit
- AUDITOR: Assignments, Sign & Add Attestation, Finalise Contract, Audit
- ENV_OPERATOR: Assignments, Export Contract, Audit
- VIEWER: Assignments, Audit

## 9.4 Local Crypto Boundary

Sensitive cryptographic operations stay local in Electron main process through preload IPC bridges:

- key generation/storage
- hashing/signing
- contract-cli encryption/signing orchestration
- local file save/read for export flows

---

## 10. Security Controls

- token hashes only at rest (no raw token persistence in DB)
- request-signature verification bound to registered public keys
- setup-gated account activation before full API usage
- layered RBAC + assignment authorization
- audit hash chain tamper detection
- terminal build-state immutability semantics

---

## 11. Configuration (Backend)

From `internal/config/config.go`:

- `SERVER_HOST` (default `0.0.0.0`)
- `SERVER_PORT` (default `8080`)
- `DATABASE_URL` (required)
- `TOKEN_EXPIRY` (default `24h`)
- `BCRYPT_COST` (default `12`)
- `LOG_LEVEL` (default `info`)
- `LOG_FORMAT` (default `json`)
- `MAX_PAYLOAD_SIZE` (default `52428800`)
- `CORS_ALLOWED_ORIGINS` (default `http://localhost:5173,http://127.0.0.1:5173,null`)
- `CORS_ALLOW_ALL` (default `false`)
- `TRUST_PROXY_HEADERS` (default `false`)
- `REQUEST_TIMEOUT` (default `30s`)

Server startup seeding env vars:

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ADMIN_NAME`

---

## 12. Known Constraints / Backlog

- Build listing for non-admin users currently performs assignment-first filtering then build fetches (functional but not the most query-efficient shape).
- Roles are modeled in both `persona_role` enum (`user_roles`) and `roles` table (`build_assignments`, `build_sections`) for backward compatibility and staged migration.
- OpenAPI endpoint is static and can lag runtime behavior.

---

> End of LLD v0.3
