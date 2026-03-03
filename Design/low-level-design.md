# HPCR Contract Builder — Low-Level Design (LLD)

> **Version:** 0.1  
> **Date:** 2026-03-03  
> **Status:** Draft  
> **Parent Document:** [high-level-design.md](file:///Users/sashwatk/Development/github.com/Sashwat-K/persona-based-contract-generator/Design/high-level-design.md)

---

## 1. Project Structure

### 1.1 Go Backend

```
backend/
├── cmd/
│   └── server/
│       └── main.go                  # Entry point, config loading, server bootstrap
├── internal/
│   ├── config/
│   │   └── config.go                # Env-based configuration struct
│   ├── middleware/
│   │   ├── auth.go                  # Bearer token authentication
│   │   ├── rbac.go                  # Role-based access control
│   │   ├── logging.go               # Request/response logging
│   │   └── ratelimit.go             # Per-IP / per-user rate limiting
│   ├── handler/
│   │   ├── auth_handler.go          # POST /auth/login, /auth/logout
│   │   ├── user_handler.go          # User CRUD + token management
│   │   ├── build_handler.go         # Build CRUD
│   │   ├── section_handler.go       # Workload, env, attestation, finalize
│   │   └── audit_handler.go         # Audit log, verify, export, userdata
│   ├── service/
│   │   ├── auth_service.go          # Login/logout logic, token hashing
│   │   ├── user_service.go          # User + role + API token management
│   │   ├── build_service.go         # Build lifecycle & state machine
│   │   ├── section_service.go       # Section submission & validation
│   │   ├── audit_service.go         # Audit event creation & hash chain
│   │   ├── verification_service.go  # Hash chain + signature verification
│   │   └── export_service.go        # Contract export + userdata download
│   ├── repository/
│   │   ├── queries/                 # sqlc SQL query files
│   │   │   ├── users.sql
│   │   │   ├── builds.sql
│   │   │   ├── sections.sql
│   │   │   ├── audit_events.sql
│   │   │   └── api_tokens.sql
│   │   ├── db.go                    # sqlc generated DB interface
│   │   ├── models.go                # sqlc generated model structs
│   │   └── queries.sql.go           # sqlc generated query methods
│   ├── model/
│   │   ├── build.go                 # Build domain types + status enum
│   │   ├── user.go                  # User + role domain types
│   │   ├── audit.go                 # Audit event domain types
│   │   └── errors.go                # Domain-specific error types
│   └── crypto/
│       ├── hash.go                  # SHA256 helpers
│       └── signature.go             # Signature verification (public key only)
├── migrations/
│   ├── 001_create_users.up.sql
│   ├── 001_create_users.down.sql
│   ├── 002_create_builds.up.sql
│   ├── 002_create_builds.down.sql
│   ├── 003_create_sections.up.sql
│   ├── 003_create_sections.down.sql
│   ├── 004_create_audit_events.up.sql
│   ├── 004_create_audit_events.down.sql
│   ├── 005_create_api_tokens.up.sql
│   └── 005_create_api_tokens.down.sql
├── go.mod
├── go.sum
├── sqlc.yaml
└── Dockerfile
```

### 1.2 Flutter Desktop App

```
desktop_app/
├── lib/
│   ├── main.dart
│   ├── app.dart
│   ├── config/
│   │   ├── app_config.dart           # Server URL, timeouts
│   │   └── routes.dart               # Named route definitions
│   ├── models/
│   │   ├── user.dart
│   │   ├── build.dart
│   │   ├── section.dart
│   │   └── audit_event.dart
│   ├── services/
│   │   ├── api_client.dart           # HTTP client wrapper (Dio)
│   │   ├── auth_service.dart         # Login, logout, token storage
│   │   ├── build_service.dart        # Build CRUD API calls
│   │   ├── section_service.dart      # Section upload API calls
│   │   ├── audit_service.dart        # Audit log + verification API calls
│   │   └── crypto_service.dart       # Local crypto operations (FFI bridge)
│   ├── crypto/
│   │   ├── contract_cli_bridge.dart  # FFI/Process bridge to contract-cli
│   │   ├── key_manager.dart          # Local key generation & storage
│   │   ├── encryptor.dart            # AES-256 / RSA encryption
│   │   ├── signer.dart               # SHA256 + ECDSA/RSA signing
│   │   └── hash_utils.dart           # SHA256 helpers
│   ├── providers/
│   │   ├── auth_provider.dart        # Auth state (Riverpod)
│   │   ├── build_provider.dart       # Build list + detail state
│   │   └── theme_provider.dart       # Theme state
│   ├── screens/
│   │   ├── login_screen.dart
│   │   ├── dashboard_screen.dart
│   │   ├── build_list_screen.dart
│   │   ├── build_detail_screen.dart
│   │   ├── workload_submission_screen.dart
│   │   ├── environment_staging_screen.dart
│   │   ├── auditor_screen.dart
│   │   ├── admin/
│   │   │   ├── user_management_screen.dart
│   │   │   └── role_assignment_screen.dart
│   │   └── audit_log_screen.dart
│   └── widgets/
│       ├── build_status_badge.dart
│       ├── file_picker_card.dart
│       ├── hash_display.dart
│       └── signature_status.dart
├── assets/
├── test/
├── pubspec.yaml
└── Makefile
```

---

## 2. Database Schema (PostgreSQL 16)

### 2.1 Enums

```sql
CREATE TYPE build_status AS ENUM (
    'CREATED',
    'WORKLOAD_SUBMITTED',
    'ENVIRONMENT_STAGED',
    'AUDITOR_KEYS_REGISTERED',
    'CONTRACT_ASSEMBLED',
    'FINALIZED',
    'CANCELLED'
);

CREATE TYPE persona_role AS ENUM (
    'SOLUTION_PROVIDER',
    'DATA_OWNER',
    'AUDITOR',
    'ENV_OPERATOR',
    'ADMIN',
    'VIEWER'
);

CREATE TYPE audit_event_type AS ENUM (
    'BUILD_CREATED',
    'WORKLOAD_SUBMITTED',
    'ENVIRONMENT_STAGED',
    'AUDITOR_KEYS_REGISTERED',
    'CONTRACT_ASSEMBLED',
    'BUILD_FINALIZED',
    'BUILD_CANCELLED',
    'USER_CREATED',
    'ROLE_ASSIGNED',
    'TOKEN_CREATED',
    'TOKEN_REVOKED',
    'CONTRACT_DOWNLOADED'
);
```

### 2.2 Users Table

```sql
CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255)    NOT NULL,
    email       VARCHAR(255)    NOT NULL UNIQUE,
    password_hash TEXT          NOT NULL,
    is_active   BOOLEAN         NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email ON users (email);
```

### 2.3 User Roles Table

```sql
CREATE TABLE user_roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        persona_role    NOT NULL,
    assigned_by UUID            NOT NULL REFERENCES users(id),
    assigned_at TIMESTAMPTZ     NOT NULL DEFAULT now(),

    UNIQUE (user_id, role)
);

CREATE INDEX idx_user_roles_user_id ON user_roles (user_id);
```

### 2.4 API Tokens Table

```sql
CREATE TABLE api_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(255)    NOT NULL,
    token_hash  TEXT            NOT NULL UNIQUE,
    last_used_at TIMESTAMPTZ,
    revoked_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_tokens_user_id ON api_tokens (user_id);
CREATE INDEX idx_api_tokens_token_hash ON api_tokens (token_hash);
```

### 2.5 Builds Table

```sql
CREATE TABLE builds (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255)    NOT NULL,
    status          build_status    NOT NULL DEFAULT 'CREATED',
    created_by      UUID            NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    finalized_at    TIMESTAMPTZ,
    contract_hash   TEXT,
    contract_yaml   TEXT,
    is_immutable    BOOLEAN         NOT NULL DEFAULT false
);

CREATE INDEX idx_builds_status ON builds (status);
CREATE INDEX idx_builds_created_by ON builds (created_by);
```

### 2.6 Build Sections Table

```sql
CREATE TABLE build_sections (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    build_id                UUID            NOT NULL REFERENCES builds(id) ON DELETE CASCADE,
    persona_role            persona_role    NOT NULL,
    submitted_by            UUID            NOT NULL REFERENCES users(id),
    encrypted_payload       TEXT            NOT NULL,
    encrypted_symmetric_key TEXT,
    section_hash            TEXT            NOT NULL,
    signature               TEXT            NOT NULL,
    submitted_at            TIMESTAMPTZ     NOT NULL DEFAULT now(),

    UNIQUE (build_id, persona_role)
);

CREATE INDEX idx_build_sections_build_id ON build_sections (build_id);
```

### 2.7 Audit Events Table

```sql
CREATE TABLE audit_events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    build_id            UUID                NOT NULL REFERENCES builds(id) ON DELETE CASCADE,
    sequence_no         INTEGER             NOT NULL,
    event_type          audit_event_type    NOT NULL,
    actor_user_id       UUID                NOT NULL REFERENCES users(id),
    actor_public_key    TEXT,
    ip_address          INET,
    device_metadata     JSONB,
    event_data          JSONB               NOT NULL,
    previous_event_hash TEXT                NOT NULL,
    event_hash          TEXT                NOT NULL,
    signature           TEXT,
    created_at          TIMESTAMPTZ         NOT NULL DEFAULT now(),

    UNIQUE (build_id, sequence_no)
);

CREATE INDEX idx_audit_events_build_id ON audit_events (build_id);
CREATE INDEX idx_audit_events_build_seq ON audit_events (build_id, sequence_no);
```

### 2.8 Entity-Relationship Diagram

```mermaid
erDiagram
    USERS ||--o{ USER_ROLES : has
    USERS ||--o{ API_TOKENS : owns
    USERS ||--o{ BUILDS : creates
    USERS ||--o{ BUILD_SECTIONS : submits
    USERS ||--o{ AUDIT_EVENTS : triggers
    BUILDS ||--o{ BUILD_SECTIONS : contains
    BUILDS ||--o{ AUDIT_EVENTS : tracks
```

---

## 3. Build State Machine

### 3.1 Transition Rules

| Current State | Action | Next State | Required Role | Validations |
|---|---|---|---|---|
| `CREATED` | Submit workload | `WORKLOAD_SUBMITTED` | `SOLUTION_PROVIDER` | Payload non-empty, hash matches payload, valid signature |
| `WORKLOAD_SUBMITTED` | Stage environment | `ENVIRONMENT_STAGED` | `DATA_OWNER` | Payload non-empty, symmetric key present, hash matches, valid signature |
| `ENVIRONMENT_STAGED` | Register attestation keys | `AUDITOR_KEYS_REGISTERED` | `AUDITOR` | Public key + signing cert valid |
| `AUDITOR_KEYS_REGISTERED` | Assemble contract | `CONTRACT_ASSEMBLED` | `AUDITOR` | Contract YAML present, hash matches, valid signature |
| `CONTRACT_ASSEMBLED` | Finalize | `FINALIZED` | `AUDITOR` | Re-verify contract hash + signature, set `is_immutable = true` |
| Any (pre-FINALIZED) | Cancel | `CANCELLED` | `ADMIN` | Build not already FINALIZED |

### 3.2 Implementation (Go)

```go
// internal/model/build.go

type BuildStatus string

const (
    StatusCreated              BuildStatus = "CREATED"
    StatusWorkloadSubmitted    BuildStatus = "WORKLOAD_SUBMITTED"
    StatusEnvironmentStaged    BuildStatus = "ENVIRONMENT_STAGED"
    StatusAuditorKeysRegistered BuildStatus = "AUDITOR_KEYS_REGISTERED"
    StatusContractAssembled    BuildStatus = "CONTRACT_ASSEMBLED"
    StatusFinalized            BuildStatus = "FINALIZED"
    StatusCancelled            BuildStatus = "CANCELLED"
)

// ValidTransitions defines the legal state transitions.
var ValidTransitions = map[BuildStatus]BuildStatus{
    StatusCreated:               StatusWorkloadSubmitted,
    StatusWorkloadSubmitted:     StatusEnvironmentStaged,
    StatusEnvironmentStaged:     StatusAuditorKeysRegistered,
    StatusAuditorKeysRegistered: StatusContractAssembled,
    StatusContractAssembled:     StatusFinalized,
}

func (s BuildStatus) CanTransitionTo(next BuildStatus) bool {
    if next == StatusCancelled {
        return s != StatusFinalized && s != StatusCancelled
    }
    expected, ok := ValidTransitions[s]
    return ok && expected == next
}
```

### 3.3 State Machine Flow Diagram

```mermaid
flowchart TD
    A[CREATED] -->|"POST /builds/{id}/workload<br/>Role: SOLUTION_PROVIDER"| B[WORKLOAD_SUBMITTED]
    B -->|"POST /builds/{id}/environment<br/>Role: DATA_OWNER"| C[ENVIRONMENT_STAGED]
    C -->|"POST /builds/{id}/attestation<br/>Role: AUDITOR"| D[AUDITOR_KEYS_REGISTERED]
    D -->|"POST /builds/{id}/finalize<br/>Role: AUDITOR"| E[CONTRACT_ASSEMBLED]
    E -->|"Automatic on verification<br/>Role: AUDITOR"| F[FINALIZED]

    A -->|"DELETE /builds/{id}<br/>Role: ADMIN"| G[CANCELLED]
    B --> G
    C --> G
    D --> G
    E --> G

    style F fill:#2d6a4f,color:#fff
    style G fill:#d00000,color:#fff
```

---

## 4. API Contracts (Detailed)

### 4.1 Authentication

#### `POST /auth/login`

**Request:**
```json
{
    "email": "user@example.com",
    "password": "plaintext-password"
}
```

**Response (200):**
```json
{
    "token": "bearer-token-value",
    "user": {
        "id": "uuid",
        "name": "Jane Doe",
        "email": "user@example.com",
        "roles": ["SOLUTION_PROVIDER"],
        "is_active": true
    }
}
```

**Errors:** `401 Unauthorized` (invalid credentials), `423 Locked` (user deactivated)

#### `POST /auth/logout`

**Headers:** `Authorization: Bearer <token>`  
**Response:** `204 No Content`  
**Backend:** Marks token as revoked.

---

### 4.2 User Management

#### `GET /users`

**Headers:** `Authorization: Bearer <token>`  
**Required Role:** `ADMIN`

**Response (200):**
```json
{
    "users": [
        {
            "id": "uuid",
            "name": "Jane Doe",
            "email": "user@example.com",
            "roles": ["SOLUTION_PROVIDER"],
            "is_active": true,
            "created_at": "2026-01-15T10:00:00Z"
        }
    ]
}
```

#### `POST /users`

**Required Role:** `ADMIN`

**Request:**
```json
{
    "name": "John Smith",
    "email": "john@example.com",
    "password": "initial-password",
    "roles": ["DATA_OWNER"]
}
```

**Response (201):** Created user object.  
**Errors:** `409 Conflict` (email exists), `400 Bad Request` (invalid role)

#### `PATCH /users/{id}/roles`

**Required Role:** `ADMIN`

**Request:**
```json
{
    "roles": ["AUDITOR", "VIEWER"]
}
```

**Response (200):** Updated user object with new roles.

#### `GET /users/{id}/tokens`

**Required Role:** `ADMIN` or own user  

**Response (200):**
```json
{
    "tokens": [
        {
            "id": "uuid",
            "name": "ci-pipeline",
            "last_used_at": "2026-02-20T14:30:00Z",
            "revoked_at": null,
            "created_at": "2026-01-10T09:00:00Z"
        }
    ]
}
```

#### `POST /users/{id}/tokens`

**Required Role:** `ADMIN` or own user

**Request:**
```json
{
    "name": "ci-pipeline"
}
```

**Response (201):**
```json
{
    "id": "uuid",
    "name": "ci-pipeline",
    "token": "raw-token-value-shown-once-only"
}
```

> [!CAUTION]
> The raw token is returned **only once** at creation time. The backend stores only the SHA256 hash.

#### `DELETE /users/{id}/tokens/{token_id}`

**Required Role:** `ADMIN` or own user  
**Response:** `204 No Content`  
**Backend:** Sets `revoked_at = now()`.

---

### 4.3 Builds

#### `POST /builds`

**Required Role:** Any authenticated user

**Request:**
```json
{
    "name": "production-deploy-v2.1"
}
```

**Response (201):**
```json
{
    "id": "uuid",
    "name": "production-deploy-v2.1",
    "status": "CREATED",
    "created_by": "user-uuid",
    "created_at": "2026-03-03T10:00:00Z",
    "is_immutable": false
}
```

#### `GET /builds`

**Query Parameters:** `?status=CREATED&page=1&per_page=20`

**Response (200):**
```json
{
    "builds": [ ... ],
    "pagination": {
        "page": 1,
        "per_page": 20,
        "total": 42
    }
}
```

#### `GET /builds/{id}`

**Response (200):** Full build object with sections summary (no encrypted payloads).

#### `DELETE /builds/{id}`

**Required Role:** `ADMIN`  
**Constraint:** Build must not be `FINALIZED`.  
**Response:** `204 No Content`  
**Backend:** Sets status to `CANCELLED`, emits audit event.

---

### 4.4 Section Submissions

#### `POST /builds/{id}/workload`

**Required Role:** `SOLUTION_PROVIDER`  
**Required Build Status:** `CREATED`  
**Content-Type:** `application/json`

**Request:**
```json
{
    "encrypted_payload": "base64-encoded-encrypted-workload",
    "section_hash": "sha256-hex-of-encrypted-payload",
    "signature": "base64-encoded-signature-of-section-hash",
    "public_key": "PEM-encoded-public-key"
}
```

**Response (200):**
```json
{
    "build_id": "uuid",
    "status": "WORKLOAD_SUBMITTED",
    "section": {
        "id": "uuid",
        "persona_role": "SOLUTION_PROVIDER",
        "section_hash": "sha256-hex",
        "submitted_at": "2026-03-03T10:05:00Z"
    }
}
```

**Backend Validations:**
1. Build exists and is in `CREATED` state.
2. User has `SOLUTION_PROVIDER` role.
3. `section_hash == SHA256(encrypted_payload)`.
4. Signature is valid against provided public key.
5. Transition build to `WORKLOAD_SUBMITTED`.
6. Emit audit event.

---

#### `POST /builds/{id}/environment`

**Required Role:** `DATA_OWNER`  
**Required Build Status:** `WORKLOAD_SUBMITTED`  
**Content-Type:** `application/json`

**Request:**
```json
{
    "encrypted_payload": "base64-encoded-encrypted-environment",
    "encrypted_symmetric_key": "base64-encoded-encrypted-symmetric-key",
    "section_hash": "sha256-hex-of-encrypted-payload",
    "signature": "base64-encoded-signature-of-section-hash",
    "public_key": "PEM-encoded-public-key"
}
```

**Response (200):** Build status updated to `ENVIRONMENT_STAGED`.

**Backend Validations:**
1. Build is in `WORKLOAD_SUBMITTED` state.
2. User has `DATA_OWNER` role.
3. Hash verification + signature verification.
4. Store both `encrypted_payload` and `encrypted_symmetric_key`.
5. Transition to `ENVIRONMENT_STAGED`.
6. Emit audit event.

---

#### `POST /builds/{id}/attestation`

**Required Role:** `AUDITOR`  
**Required Build Status:** `ENVIRONMENT_STAGED`

**Request:**
```json
{
    "attestation_public_key": "PEM-encoded-public-key",
    "signing_certificate": "PEM-encoded-certificate"
}
```

**Response (200):** Build status updated to `AUDITOR_KEYS_REGISTERED`.

**Backend Validations:**
1. Build is in `ENVIRONMENT_STAGED` state.
2. User has `AUDITOR` role.
3. Public key and certificate are valid PEM format.
4. Store attestation key + signing cert.
5. Transition to `AUDITOR_KEYS_REGISTERED`.
6. Emit audit event.

---

#### `POST /builds/{id}/finalize`

**Required Role:** `AUDITOR`  
**Required Build Status:** `AUDITOR_KEYS_REGISTERED`  
**Content-Type:** `application/json`

**Request:**
```json
{
    "contract_yaml": "base64-encoded-final-contract-yaml",
    "contract_hash": "sha256-hex-of-contract-yaml",
    "signature": "base64-encoded-signature-of-contract-hash"
}
```

**Response (200):**
```json
{
    "build_id": "uuid",
    "status": "FINALIZED",
    "contract_hash": "sha256-hex",
    "finalized_at": "2026-03-03T11:00:00Z",
    "is_immutable": true
}
```

**Backend Validations:**
1. Build is in `AUDITOR_KEYS_REGISTERED` state.
2. User has `AUDITOR` role.
3. `contract_hash == SHA256(contract_yaml)`.
4. Signature is valid against auditor's registered signing cert.
5. Store `contract_yaml` and `contract_hash`.
6. Set `is_immutable = true`, `finalized_at = now()`.
7. Transition through `CONTRACT_ASSEMBLED` → `FINALIZED`.
8. Emit audit events for both transitions.

---

### 4.5 Audit & Export

#### `GET /builds/{id}/audit`

**Response (200):**
```json
{
    "build_id": "uuid",
    "events": [
        {
            "sequence_no": 0,
            "event_type": "BUILD_CREATED",
            "actor_user_id": "uuid",
            "event_data": { ... },
            "event_hash": "sha256-hex",
            "previous_event_hash": "sha256-hex",
            "signature": "base64-signature",
            "created_at": "2026-03-03T10:00:00Z"
        }
    ]
}
```

#### `GET /builds/{id}/verify`

**Response (200):**
```json
{
    "build_id": "uuid",
    "chain_valid": true,
    "signatures_valid": true,
    "contract_hash_valid": true,
    "events_verified": 6,
    "errors": []
}
```

**Response (200 with errors):**
```json
{
    "build_id": "uuid",
    "chain_valid": false,
    "signatures_valid": false,
    "contract_hash_valid": true,
    "events_verified": 6,
    "errors": [
        "Event #3: hash mismatch (expected abc..., got def...)",
        "Event #4: invalid signature"
    ]
}
```

#### `GET /builds/{id}/export`

**Required Build Status:** `FINALIZED`  
**Response:** `200 OK` with `Content-Type: application/x-yaml`  
Returns the raw `contract.yaml` file.

#### `GET /builds/{id}/userdata`

**Required Build Status:** `FINALIZED`  
**Response:** `200 OK` with `Content-Disposition: attachment; filename="userdata.yaml"`  
Returns the contract as a downloadable file for deploying to HPCR.

---

## 5. Audit Hash Chain Implementation

### 5.1 Event Data Canonical Form

```go
// internal/service/audit_service.go

type AuditEventData struct {
    BuildID    string `json:"build_id"`
    EventType  string `json:"event_type"`
    ActorID    string `json:"actor_id"`
    Timestamp  string `json:"timestamp"`      // RFC3339
    Details    any    `json:"details"`         // Event-specific payload
}

// CanonicalJSON produces deterministic JSON output.
// Keys are sorted alphabetically, no extra whitespace.
func CanonicalJSON(data AuditEventData) ([]byte, error) {
    return json.Marshal(data) // Go's json.Marshal sorts map keys
}
```

### 5.2 Hash Chain Computation

```go
func ComputeGenesisHash(buildID string) string {
    seed := fmt.Sprintf("IBM_CC:%s", buildID)
    hash := sha256.Sum256([]byte(seed))
    return hex.EncodeToString(hash[:])
}

func ComputeEventHash(eventDataJSON []byte, previousHash string) string {
    payload := append(eventDataJSON, []byte(previousHash)...)
    hash := sha256.Sum256(payload)
    return hex.EncodeToString(hash[:])
}
```

### 5.3 Chain Verification

```go
func (s *VerificationService) VerifyBuildChain(ctx context.Context, buildID uuid.UUID) (*VerificationResult, error) {
    events, err := s.repo.GetAuditEventsByBuild(ctx, buildID)
    if err != nil {
        return nil, err
    }

    result := &VerificationResult{BuildID: buildID, EventsVerified: len(events)}
    expectedPrevHash := ComputeGenesisHash(buildID.String())

    for i, event := range events {
        // 1. Verify chain linkage
        if event.PreviousEventHash != expectedPrevHash {
            result.Errors = append(result.Errors,
                fmt.Sprintf("Event #%d: previous_hash mismatch", i))
            result.ChainValid = false
        }

        // 2. Recompute and verify event hash
        recomputed := ComputeEventHash(event.EventData, event.PreviousEventHash)
        if recomputed != event.EventHash {
            result.Errors = append(result.Errors,
                fmt.Sprintf("Event #%d: event_hash mismatch", i))
            result.ChainValid = false
        }

        // 3. Verify signature (if present)
        if event.Signature != "" {
            if err := VerifySignature(event.ActorPublicKey, event.EventHash, event.Signature); err != nil {
                result.Errors = append(result.Errors,
                    fmt.Sprintf("Event #%d: invalid signature", i))
                result.SignaturesValid = false
            }
        }

        expectedPrevHash = event.EventHash
    }

    if len(result.Errors) == 0 {
        result.ChainValid = true
        result.SignaturesValid = true
    }

    return result, nil
}
```

---

## 6. Authentication & Authorization

### 6.1 Auth Middleware Flow

```mermaid
flowchart LR
    A[Request] --> B{Has Bearer Token?}
    B -->|No| C[401 Unauthorized]
    B -->|Yes| D[SHA256 hash token]
    D --> E{Token exists in DB?}
    E -->|No| C
    E -->|Yes| F{Token revoked?}
    F -->|Yes| C
    F -->|No| G[Load user + roles]
    G --> H{User active?}
    H -->|No| C
    H -->|Yes| I[Set user in context]
    I --> J[Next handler]
```

### 6.2 Token Hashing

```go
// Tokens are hashed before storage (one-way).
// Raw token is shown to the user ONCE at creation.
func HashToken(rawToken string) string {
    hash := sha256.Sum256([]byte(rawToken))
    return hex.EncodeToString(hash[:])
}

func GenerateToken() (raw string, hashed string) {
    b := make([]byte, 32)
    crypto_rand.Read(b)
    raw = base64.URLEncoding.EncodeToString(b)
    hashed = HashToken(raw)
    return
}
```

### 6.3 RBAC Matrix

| Endpoint | ADMIN | SOLUTION_PROVIDER | DATA_OWNER | AUDITOR | ENV_OPERATOR | VIEWER |
|---|---|---|---|---|---|---|
| `GET /users` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `POST /users` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `PATCH /users/{id}/roles` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `GET /users/{id}/tokens` | ✅¹ | ✅¹ | ✅¹ | ✅¹ | ✅¹ | ✅¹ |
| `POST /users/{id}/tokens` | ✅¹ | ✅¹ | ✅¹ | ✅¹ | ✅¹ | ✅¹ |
| `DELETE /users/{id}/tokens/{tid}` | ✅¹ | ✅¹ | ✅¹ | ✅¹ | ✅¹ | ✅¹ |
| `GET /builds` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `POST /builds` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `GET /builds/{id}` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `DELETE /builds/{id}` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `POST .../workload` | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `POST .../environment` | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| `POST .../attestation` | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `POST .../finalize` | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `GET .../audit` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET .../verify` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET .../export` | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ |
| `GET .../userdata` | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |

> ¹ ADMIN can access any user's tokens; other roles can only access their own (`user_id` must match authenticated user).

---

## 7. Error Handling

### 7.1 Standard Error Response

```json
{
    "error": {
        "code": "INVALID_STATE_TRANSITION",
        "message": "Build is in CREATED state; expected WORKLOAD_SUBMITTED for environment submission.",
        "details": {
            "current_status": "CREATED",
            "expected_status": "WORKLOAD_SUBMITTED"
        }
    }
}
```

### 7.2 Error Codes

| HTTP Status | Error Code | Description |
|---|---|---|
| `400` | `INVALID_REQUEST` | Malformed request body or missing fields |
| `400` | `HASH_MISMATCH` | Computed hash does not match submitted hash |
| `400` | `INVALID_SIGNATURE` | Signature verification failed |
| `400` | `INVALID_CERTIFICATE` | PEM certificate is malformed or expired |
| `401` | `UNAUTHORIZED` | Missing or invalid bearer token |
| `403` | `FORBIDDEN` | User lacks the required role |
| `404` | `BUILD_NOT_FOUND` | Build ID does not exist |
| `404` | `USER_NOT_FOUND` | User ID does not exist |
| `409` | `DUPLICATE_EMAIL` | Email already registered |
| `409` | `DUPLICATE_SECTION` | Section already submitted for this persona |
| `422` | `INVALID_STATE_TRANSITION` | Build is not in the required state for this action |
| `422` | `BUILD_IMMUTABLE` | Cannot modify a finalized build |
| `500` | `INTERNAL_ERROR` | Unexpected server error |

---

## 8. Configuration

### 8.1 Environment Variables

```go
// internal/config/config.go

type Config struct {
    // Server
    ServerHost  string `env:"SERVER_HOST"  default:"0.0.0.0"`
    ServerPort  int    `env:"SERVER_PORT"  default:"8080"`

    // Database
    DatabaseURL string `env:"DATABASE_URL" required:"true"`
    // e.g. "postgres://user:pass@localhost:5432/hpcr_builder?sslmode=require"

    // Auth
    TokenExpiry   time.Duration `env:"TOKEN_EXPIRY"    default:"24h"`
    BcryptCost    int           `env:"BCRYPT_COST"     default:"12"`

    // Logging
    LogLevel  string `env:"LOG_LEVEL"  default:"info"`    // debug, info, warn, error
    LogFormat string `env:"LOG_FORMAT" default:"json"`    // json, text

    // Limits
    MaxPayloadSize int64 `env:"MAX_PAYLOAD_SIZE" default:"52428800"` // 50MB
}
```

### 8.2 nginx Configuration (Reference)

```nginx
server {
    listen 443 ssl http2;
    server_name hpcr-builder.example.com;

    ssl_certificate     /etc/ssl/certs/server.crt;
    ssl_certificate_key /etc/ssl/private/server.key;
    ssl_protocols       TLSv1.3;

    client_max_body_size 50M;

    # Security headers
    add_header X-Content-Type-Options    nosniff;
    add_header X-Frame-Options           DENY;
    add_header X-XSS-Protection          "1; mode=block";
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains";

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=30r/m;

    location /api/ {
        limit_req zone=api burst=10 nodelay;
        proxy_pass http://127.0.0.1:8080/;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 9. Flutter Desktop — Crypto Operations Detail

### 9.1 contract-cli Integration

The Flutter app invokes `contract-cli` (built from `contract-go`) as a subprocess:

```dart
// lib/crypto/contract_cli_bridge.dart

class ContractCliBridge {
  final String cliPath;

  ContractCliBridge({required this.cliPath});

  /// Encrypt workload section using contract-cli.
  Future<File> encryptWorkload({
    required File workloadFile,
    required File encryptionCert,
  }) async {
    final result = await Process.run(cliPath, [
      'encrypt',
      '--input', workloadFile.path,
      '--cert', encryptionCert.path,
      '--output', '${workloadFile.path}.enc',
    ]);

    if (result.exitCode != 0) {
      throw CryptoException('contract-cli encrypt failed: ${result.stderr}');
    }

    return File('${workloadFile.path}.enc');
  }

  /// Encrypt environment section using contract-cli (final encryption by auditor).
  Future<File> encryptEnvironment({
    required File envFile,
    required File encryptionCert,
    required File signingKey,
  }) async {
    final result = await Process.run(cliPath, [
      'encrypt',
      '--input', envFile.path,
      '--cert', encryptionCert.path,
      '--signing-key', signingKey.path,
      '--output', '${envFile.path}.enc',
    ]);

    if (result.exitCode != 0) {
      throw CryptoException('contract-cli env encrypt failed: ${result.stderr}');
    }

    return File('${envFile.path}.enc');
  }
}
```

### 9.2 Local Key & Encryption Operations

```dart
// lib/crypto/key_manager.dart

class KeyManager {
  /// Generate RSA 4096-bit key pair for signing.
  Future<KeyPair> generateSigningKeyPair() async { ... }

  /// Generate RSA 4096-bit key pair for attestation.
  Future<KeyPair> generateAttestationKeyPair() async { ... }

  /// Generate AES-256 symmetric key for environment staging.
  Uint8List generateSymmetricKey() {
    final random = Random.secure();
    return Uint8List.fromList(
      List.generate(32, (_) => random.nextInt(256)),
    );
  }

  /// Store key securely using OS keychain.
  Future<void> storeKey(String label, Uint8List key) async { ... }
}
```

```dart
// lib/crypto/encryptor.dart

class Encryptor {
  /// AES-256-GCM encrypt data with given symmetric key.
  Uint8List encryptWithSymmetricKey(Uint8List data, Uint8List key) { ... }

  /// RSA-OAEP encrypt symmetric key with public key.
  Uint8List encryptSymmetricKey(Uint8List symmetricKey, RSAPublicKey publicKey) { ... }

  /// AES-256-GCM decrypt data with given symmetric key.
  Uint8List decryptWithSymmetricKey(Uint8List encrypted, Uint8List key) { ... }

  /// RSA-OAEP decrypt symmetric key with private key.
  Uint8List decryptSymmetricKey(Uint8List encryptedKey, RSAPrivateKey privateKey) { ... }
}
```

### 9.3 Signing & Hashing

```dart
// lib/crypto/signer.dart

class Signer {
  /// Compute SHA256 hash of file contents.
  Future<String> hashFile(File file) async {
    final bytes = await file.readAsBytes();
    final digest = sha256.convert(bytes);
    return digest.toString();
  }

  /// Sign a hash using RSA-PSS with SHA-256.
  String sign(String hash, RSAPrivateKey privateKey) { ... }

  /// Verify a signature against a hash and public key.
  bool verify(String hash, String signature, RSAPublicKey publicKey) { ... }
}
```

### 9.4 Persona Workflow (Client-Side)

```mermaid
sequenceDiagram
    participant SP as Solution Provider (Desktop)
    participant DO as Data Owner (Desktop)
    participant AU as Auditor (Desktop)
    participant EO as Env Operator (Desktop)
    participant BE as Go Backend

    Note over SP: Generate/load encryption cert
    SP->>SP: Encrypt workload via contract-cli
    SP->>SP: SHA256(workload.enc) → hash
    SP->>SP: Sign(hash, private_key) → signature
    SP->>BE: POST /builds/{id}/workload

    Note over DO: Generate AES-256 symmetric key
    DO->>DO: AES encrypt env section
    DO->>DO: RSA encrypt symmetric key
    DO->>DO: SHA256(encrypted_env) → hash
    DO->>DO: Sign(hash, private_key) → signature
    DO->>BE: POST /builds/{id}/environment

    Note over AU: Generate attestation + signing keys
    AU->>BE: POST /builds/{id}/attestation (public keys)
    AU->>BE: GET sections (download encrypted artifacts)
    AU->>AU: RSA decrypt symmetric key
    AU->>AU: AES decrypt env section
    AU->>AU: Final encrypt via contract-cli
    AU->>AU: Assemble contract.yaml
    AU->>AU: SHA256(contract.yaml) → hash
    AU->>AU: Sign(hash, private_key) → signature
    AU->>BE: POST /builds/{id}/finalize

    EO->>BE: GET /builds/{id}/userdata
    Note over EO: Deploy to HPCR instance
```

---

## 10. Deployment

### 10.1 Docker Compose

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: hpcr_builder
      POSTGRES_USER: hpcr
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U hpcr"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgres://hpcr:${DB_PASSWORD}@postgres:5432/hpcr_builder?sslmode=disable
      SERVER_PORT: "8080"
      LOG_LEVEL: info
    ports:
      - "8080:8080"
    depends_on:
      postgres:
        condition: service_healthy

  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./nginx/certs:/etc/ssl:ro
    depends_on:
      - backend

volumes:
  pgdata:
```

### 10.2 Backend Dockerfile

```dockerfile
FROM golang:1.22-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /server ./cmd/server

FROM alpine:3.19
RUN apk add --no-cache ca-certificates
COPY --from=builder /server /server

EXPOSE 8080
ENTRYPOINT ["/server"]
```

### 10.3 Database Migrations

Migrations are managed via [golang-migrate](https://github.com/golang-migrate/migrate):

```bash
# Run migrations up
migrate -path ./migrations -database "$DATABASE_URL" up

# Rollback last migration
migrate -path ./migrations -database "$DATABASE_URL" down 1
```

---

## 11. Testing Strategy

| Layer | Tool | Coverage Target |
|---|---|---|
| Unit (services) | Go `testing` + `testify` | State machine, hash chain, validation logic |
| Unit (handlers) | `httptest` | Request parsing, response codes, error handling |
| Integration | `testcontainers-go` (PostgreSQL) | Full DB round-trip, migration tests |
| API (E2E) | `httptest` + test fixtures | Complete build lifecycle flow |
| Flutter unit | `flutter_test` | Crypto operations, model serialization |
| Flutter integration | `integration_test` | Full persona workflow (mock backend) |

### Key Test Scenarios

1. **Happy path:** Full build lifecycle from `CREATED` → `FINALIZED`.
2. **Invalid transitions:** Attempt to skip a state (e.g., `CREATED` → `FINALIZED`).
3. **Role enforcement:** Wrong persona attempts a section submission.
4. **Hash mismatch:** Submit a section with an incorrect hash.
5. **Signature failure:** Submit with an invalid signature.
6. **Immutability:** Attempt to modify a `FINALIZED` build.
7. **Audit chain integrity:** Verify a tampered event is detected.
8. **Token lifecycle:** Create, use, revoke, attempt to reuse revoked token.
9. **Cancellation:** Admin cancels at each pre-finalized state.

---

> *End of HPCR Contract Builder LLD v0.1*
