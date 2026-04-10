# IBM Confidential Computing Contract Generator - API Documentation

> **Version:** 1.0  
> **Date:** 2026-04-10  
> **Status:** Production Ready  
> **Backend Version:** Go 1.21+  
> **Database:** PostgreSQL 16

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [API Overview](#2-api-overview)
3. [Authentication & Authorization](#3-authentication--authorization)
4. [Common Patterns](#4-common-patterns)
5. [API Endpoints](#5-api-endpoints)
6. [Error Handling](#6-error-handling)
7. [Security Considerations](#7-security-considerations)
8. [Rate Limiting](#8-rate-limiting)
9. [Appendix](#9-appendix)

---

## 1. Introduction

The IBM Confidential Computing Contract Generator provides a RESTful API for collaborative construction, signing, and finalization of encrypted userdata contracts for HPCR, HPCR4RHVS, and HPCC deployments.

### Key Features

- **Cryptographic Identity Binding**: All users register RSA-4096 public keys; signatures verified against registered keys
- **Multi-Persona Workflow**: Strict linear state progression with separation of duties
- **Two-Layer Access Control**: Role-based + explicit build assignments
- **Tamper-Evident Audit Chain**: Hash-linked audit events with cryptographic signatures
- **Client-Side Cryptography**: All encryption, signing, and key generation performed locally
- **Zero-Knowledge Backend**: Backend never has access to private keys or unencrypted data

### Architecture Principles

- Backend orchestrates workflow and verifies signatures
- All cryptographic operations execute in Electron desktop app
- Private keys never leave user's machine
- Backend stores only encrypted artifacts and hashed data
- Immutable contracts after finalization

---

## 2. API Overview

### Base URL

```
https://<your-domain>
```

### Content Type

All requests and responses use `Content-Type: application/json` unless otherwise specified.

### Authentication

All endpoints except `POST /auth/login` require authentication via Bearer token:

```
Authorization: Bearer <token>
```

### API Versioning

Current deployment is unversioned (no `/api/v1` prefix). Versioned routing can be introduced later.

### Supported HTTP Methods

- `GET` - Retrieve resources
- `POST` - Create resources
- `PUT` - Replace resources (idempotent)
- `PATCH` - Partial update resources
- `DELETE` - Remove resources

---

## 3. Authentication & Authorization

### Authentication Flow

1. **Login**: User provides email and password to `POST /auth/login`
2. **Token Issuance**: Backend returns opaque bearer token with expiry
3. **Token Usage**: Client includes token in `Authorization` header for all subsequent requests
4. **Token Validation**: Backend validates token on each request
5. **Logout**: Client calls `POST /auth/logout` to revoke token

### First-Login Setup Flow

New users (including seeded admin) must complete setup on first login:

1. **Change Password**: Replace admin-assigned initial password
2. **Generate Key Pair**: Create RSA-4096 key pair locally (Electron app)
3. **Register Public Key**: Upload public key to backend

Until setup is complete, token is restricted to:
- `PATCH /users/{id}/password`
- `PUT /users/{id}/public-key`
- `POST /auth/logout`

All other endpoints return `403 ACCOUNT_SETUP_REQUIRED`.

### Role-Based Access Control (RBAC)

| Role | Description | Permissions |
|------|-------------|-------------|
| `SOLUTION_PROVIDER` | Provides workload section payload | Submit workload section |
| `DATA_OWNER` | Provides environment configuration | Submit environment section |
| `AUDITOR` | Performs sign + attestation flow and finalization | Register attestation state, finalize contract |
| `ENV_OPERATOR` | Downloads and deploys finalized contracts | Download contract, acknowledge receipt |
| `ADMIN` | System administration | Create users, manage roles, create builds, cancel builds |
| `VIEWER` | Read-only access | View builds and audit logs |

### Build Assignment Access Control

Having the correct role is **necessary but not sufficient**. Users must be explicitly assigned to a build to perform actions on it.

---

## 4. Common Patterns

### Request Signing

All mutating requests (POST, PUT, PATCH, DELETE) require cryptographic signatures:

**Headers:**
```
X-Signature: <base64-encoded-RSA-PSS-signature>
X-Signature-Hash: <sha256-hex-of-request-payload>
X-Timestamp: <unix-timestamp-milliseconds>
X-Key-Fingerprint: <sha256-hex-of-public-key-der>
```

**Signing Process (current implementation):**
1. Build payload as JSON: `{"method","path","data","timestamp"}`
2. Compute `SHA256(payload_json_string)` => `X-Signature-Hash`
3. Sign that hash with RSA-PSS (RSA-SHA256 semantics) using local private key
4. Base64-encode signature => `X-Signature`

**Backend Verification:**
1. Retrieve authenticated user's registered public key
2. Verify signature against registered key
3. Check timestamp for replay attack prevention (±5 minutes tolerance)
4. Validate hash matches request payload

**Signature Header Exemptions:**
- `POST /auth/logout`
- `PATCH /users/{id}/password`
- `PUT /users/{id}/public-key`

### Pagination

List endpoints support limit/offset pagination:

```
GET /builds?limit=50&offset=0
```

**Response:**
```json
{
  "builds": [...],
  "limit": 50,
  "offset": 0
}
```

### Filtering & Sorting

```
GET /builds?status=CREATED&sort=created_at&order=desc
```

---

## 5. API Endpoints

### 5.1 Roles

#### GET /roles

Retrieve all available persona roles.

**Auth:** Required | **Role:** Any

**Response (200):**
```json
{
  "roles": [
    {
      "id": "uuid",
      "name": "SOLUTION_PROVIDER",
      "description": "Provides workload definition and HPCR encryption certificate"
    }
  ]
}
```

---

### 5.2 Authentication

#### POST /auth/login

Authenticate and receive bearer token.

**Auth:** Not required

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGc...",
  "expires_at": "2026-04-09T09:13:52Z",
  "requires_setup": false,
  "setup_pending": [],
  "user": {
    "id": "uuid",
    "name": "Jane Doe",
    "email": "user@example.com",
    "roles": [{"role_id": "uuid", "role_name": "SOLUTION_PROVIDER"}],
    "has_public_key": true,
    "public_key_expired": false
  }
}
```

**Errors:** `401` Invalid credentials, `423` Account locked

---

#### POST /auth/logout

Revoke current token.

**Auth:** Required | **Role:** Any

**Response:** `204 No Content`

---

### 5.3 User Management

#### POST /users

Create new user.

**Auth:** Required | **Role:** ADMIN

**Request:**
```json
{
  "name": "John Smith",
  "email": "john@example.com",
  "password": "initial-password",
  "roles": ["role-uuid"]
}
```

**Response (201):** Created user object

**Errors:** `409` Email exists, `400` Invalid role

---

#### GET /users

List all users.

**Auth:** Required | **Role:** ADMIN

**Query:** `?page=1&per_page=20&role=ADMIN&is_active=true`

**Response (200):**
```json
{
  "users": [{
    "id": "uuid",
    "name": "Jane Doe",
    "email": "user@example.com",
    "roles": [{"role_id": "uuid", "role_name": "SOLUTION_PROVIDER"}],
    "has_public_key": true,
    "public_key_fingerprint": "sha256-hex",
    "is_active": true
  }],
  "pagination": {"page": 1, "per_page": 20, "total": 5}
}
```

---

#### PATCH /users/{id}

Update user profile details (name and email).

**Auth:** Required | **Role:** ADMIN

**Request:**
```json
{
  "name": "Jane Doe Updated",
  "email": "jane_updated@example.com"
}
```

**Response (200):** Updated user object

---

#### PATCH /users/{id}/roles

Update user roles.

**Auth:** Required | **Role:** ADMIN

**Request:**
```json
{
  "role_ids": ["uuid1", "uuid2"]
}
```

**Response (200):** Updated user object

---

#### PUT /users/{id}/public-key

Register/update public key.

**Auth:** Required | **Role:** ADMIN or own user

**Request:**
```json
{
  "public_key": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
}
```

**Response (200):**
```json
{
  "public_key_fingerprint": "sha256-hex",
  "registered_at": "2026-04-08T09:13:52Z",
  "expires_at": "2026-07-07T09:13:52Z"
}
```

**⚠️ Warning:** Updating key invalidates prior signatures.

---

#### GET /users/{id}/public-key

Retrieve user's public key.

**Auth:** Required | **Role:** Any

**Response (200):**
```json
{
  "public_key": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----",
  "public_key_fingerprint": "sha256-hex",
  "registered_at": "2026-04-08T09:13:52Z",
  "expires_at": "2026-07-07T09:13:52Z",
  "is_expired": false
}
```

---

#### PATCH /users/{id}/password

Change password.

**Auth:** Required | **Role:** ADMIN or own user

**Request (Own User):**
```json
{
  "current_password": "old",
  "new_password": "new"
}
```

**Request (Admin Reset):**
```json
{
  "new_password": "new"
}
```

**Response:** `204 No Content`

---

#### GET /users/{id}/tokens

List API tokens.

**Auth:** Required | **Role:** ADMIN or own user

**Response (200):**
```json
{
  "tokens": [{
    "id": "uuid",
    "name": "ci-pipeline",
    "expires_at": "2026-07-10T09:00:00Z",
    "last_used_at": "2026-02-20T14:30:00Z",
    "revoked_at": null
  }]
}
```

---

#### POST /users/{id}/tokens

Create API token.

**Auth:** Required | **Role:** ADMIN or own user

**Request:**
```json
{
  "name": "ci-pipeline",
  "expires_in": "720h"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "name": "ci-pipeline",
  "token": "raw-token-shown-once",
  "expires_at": "2026-05-05T10:00:00Z"
}
```

**⚠️ Warning:** Token shown only once. Backend stores SHA256 hash.

---

#### DELETE /users/{id}/tokens/{token_id}

Revoke API token.

**Auth:** Required | **Role:** ADMIN or own user

**Response:** `204 No Content`

---

### 5.4 Builds

#### POST /builds

Create build.

**Auth:** Required | **Role:** ADMIN

**Request:**
```json
{
  "name": "production-v2.1"
}
```

**Response (201):**
```json
{
  "id": "build-uuid",
  "name": "production-v2.1",
  "status": "CREATED",
  "created_by": "admin-uuid",
  "is_immutable": false
}
```

Assignment creation is handled via `POST /builds/{id}/assignments`.

---

#### GET /builds

List builds.

**Auth:** Required | **Role:** Any

**Query:** `?status=CREATED&limit=50&offset=0`

**Response (200):**
```json
{
  "builds": [{
    "id": "uuid",
    "name": "production-v2.1",
    "status": "CREATED",
    "created_at": "2026-04-08T09:13:52Z",
    "is_immutable": false
  }],
  "limit": 50,
  "offset": 0
}
```

---

#### GET /builds/{id}

Get build details.

**Auth:** Required | **Role:** Any

**Response (200):** Full build object with assignments and sections

---

#### POST /builds/{id}/cancel

Cancel build (pre-finalization only).

**Auth:** Required | **Role:** ADMIN

**Response:** `200 OK`

```json
{
  "status": "CANCELLED"
}
```

**Error:** `400` Build is finalized (immutable)

---

### 5.5 Build Assignments

#### GET /builds/{id}/assignments

Get build assignments.

**Auth:** Required | **Role:** Any

**Response (200):** Array of assignment rows.

```json
[
  {
    "role_id": "role-uuid",
    "role_name": "AUDITOR",
    "user_id": "user-uuid",
    "user_name": "Charlie",
    "user_email": "charlie@example.com",
    "assigned_at": "2026-04-08T09:13:52Z"
  }
]
```

**Use Case:** Data Owner resolves assigned Auditor `user_id`, then retrieves the key via `GET /users/{id}/public-key`.

---

#### POST /builds/{id}/assignments

Create assignment for a build.

**Auth:** Required | **Role:** ADMIN

**Request:**
```json
{
  "role_id": "role-uuid",
  "user_id": "user-uuid"
}
```

**Response (201):** Created assignment row.

---

### 5.6 Section Submissions

#### POST /builds/{id}/sections

Submit role-specific section payload.

**Auth:** Required | **Role:** Assigned role for the build  
**Build Status:** Depends on role (`SOLUTION_PROVIDER` -> `CREATED`, `DATA_OWNER` -> `WORKLOAD_SUBMITTED`, `AUDITOR` -> `ENVIRONMENT_STAGED`)

**Request:**
```json
{
  "role_id": "role-uuid",
  "encrypted_payload": "base64-encrypted-section",
  "encrypted_symmetric_key": "base64-RSA-OAEP-wrapped-key",
  "section_hash": "sha256-hex",
  "signature": "base64-signature"
}
```

**Notes:**
- `encrypted_symmetric_key` is required for `DATA_OWNER` submissions.
- `persona_role` is still accepted as backward-compatible fallback when `role_id` is absent.

**Response (201):** Created section row.

---

#### POST /builds/{id}/attestation

Register attestation keys (Auditor).

**Auth:** Required | **Role:** AUDITOR (assigned)  
**Build Status:** ENVIRONMENT_STAGED

**Request:** Empty body

**Response (200):**
```json
{
  "status": "AUDITOR_KEYS_REGISTERED",
  "already_registered": false
}
```

**Note:** State transition only. Keys generated locally. Endpoint is idempotent when already registered/progressed.

---

#### POST /builds/{id}/finalize

Finalize contract (Auditor).

**Auth:** Required | **Role:** AUDITOR (assigned)  
**Build Status:** `CONTRACT_ASSEMBLED` (frontend transitions via `PATCH /builds/{id}/status`)

**Request:**
```json
{
  "contract_yaml": "final-contract-yaml-string",
  "contract_hash": "sha256-hex",
  "signature": "base64-signature",
  "public_key": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
}
```

**Response (200):**
```json
{
  "status": "FINALIZED"
}
```

---

#### GET /builds/{id}/sections

Get all sections.

**Auth:** Required | **Role:** Any

**Response (200):**
```json
{
  "sections": [
    {
      "persona_role": "SOLUTION_PROVIDER",
      "encrypted_payload": "base64-encrypted-workload",
      "section_hash": "sha256-hex"
    },
    {
      "persona_role": "DATA_OWNER",
      "encrypted_payload": "base64-AES-encrypted-env",
      "wrapped_symmetric_key": "base64-RSA-OAEP-wrapped-key",
      "section_hash": "sha256-hex"
    }
  ]
}
```

`wrapped_symmetric_key` is the persisted/response field name for submitted `encrypted_symmetric_key`.

---

### 5.7 Audit & Verification

#### GET /builds/{id}/audit

Get audit trail.

**Auth:** Required | **Role:** Any

**Response (200):**
```json
{
  "audit_events": [{
    "sequence_no": 0,
    "event_type": "BUILD_CREATED",
    "actor_user_name": "Admin",
    "actor_key_fingerprint": "sha256-hex",
    "event_data": {},
    "previous_event_hash": "genesis-hash",
    "event_hash": "sha256-hex",
    "signature": "base64-signature",
    "created_at": "2026-04-08T09:13:52Z"
  }]
}
```

---

#### GET /builds/{id}/verify

Verify audit chain integrity.

**Auth:** Required | **Role:** Any

**Response (200 - Valid):**
```json
{
  "is_valid": true,
  "total_events": 5,
  "verified_events": 5,
  "chain_intact": true,
  "genesis_hash": "sha256-hex",
  "signatures_valid": true,
  "failed_events": []
}
```

**Response (200 - Invalid):**
```json
{
  "is_valid": false,
  "chain_intact": false,
  "signatures_valid": false,
  "failed_events": [
    {
      "sequence_no": 3,
      "failure_type": "hash_mismatch",
      "details": "computed hash does not match stored hash"
    }
  ]
}
```

---

#### GET /builds/{id}/verify-contract

Verify finalized contract integrity.

**Auth:** Required | **Role:** Any

**Response (200):**
```json
{
  "build_id": "uuid",
  "is_valid": true,
  "is_finalized": true,
  "is_immutable": true,
  "contract_hash": "sha256-hex",
  "computed_hash": "sha256-hex",
  "hash_matches": true,
  "signature_valid": true,
  "details": "contract integrity verified"
}
```

---

### 5.8 Export & Download

#### GET /builds/{id}/export

Export finalized contract.

**Auth:** Required | **Role:** ENV_OPERATOR (assigned)  
**Build Status:** FINALIZED

**Response (200):**
```json
{
  "build_id": "uuid",
  "contract_yaml": "raw-yaml-or-legacy-base64",
  "contract_hash": "sha256-hex",
  "finalized_at": "2026-04-08T09:30:00Z"
}
```

---

#### GET /builds/{id}/userdata

Download for HPCR deployment.

**Auth:** Required | **Role:** ENV_OPERATOR (assigned)  
**Build Status:** FINALIZED

**Response (200):**
```json
{
  "build_id": "uuid",
  "contract_yaml": "raw-yaml",
  "contract_hash": "sha256-hex"
}
```

---

#### POST /builds/{id}/acknowledge-download

Acknowledge download (Env Operator).

**Auth:** Required | **Role:** ENV_OPERATOR (assigned)  
**Build Status:** FINALIZED

**Request:**
```json
{
  "contract_hash": "sha256-hex",
  "signature": "base64-signature"
}
```

**Response:** `204 No Content`

**Purpose:** Cryptographic proof-of-receipt in audit chain.

---

### 5.9 Credential Rotation

#### GET /rotation/expired

Get expired credentials (Admin).

**Auth:** Required | **Role:** ADMIN

**Response (200):**
```json
{
  "expired_passwords": [{
    "user_id": "uuid",
    "user_name": "John Doe",
    "days_expired": 30
  }],
  "expired_keys": [{
    "user_id": "uuid",
    "user_name": "Jane Smith",
    "days_expired": 90
  }]
}
```

---

#### POST /rotation/force-password-change/{user_id}

Force password change (Admin).

**Auth:** Required | **Role:** ADMIN

**Response:** `204 No Content`

---

#### POST /rotation/revoke-key/{user_id}

Revoke expired key (Admin).

**Auth:** Required | **Role:** ADMIN

**Response:** `204 No Content`

---

### 5.10 API Tokens

See [User Management](#53-user-management) section for token endpoints:
- `GET /users/{id}/tokens`
- `POST /users/{id}/tokens`
- `DELETE /users/{id}/tokens/{token_id}`

---

## 6. Error Handling

### Standard Error Response

```json
{
  "error": {
    "code": "INVALID_STATE_TRANSITION",
    "message": "Build must be in CREATED state",
    "details": {
      "current_state": "WORKLOAD_SUBMITTED",
      "required_state": "CREATED"
    }
  }
}
```

### HTTP Status Codes

| Code | Meaning | Usage |
|------|---------|-------|
| `200` | OK | Successful GET/POST/PATCH |
| `201` | Created | Successful resource creation |
| `204` | No Content | Successful no-body operation |
| `400` | Bad Request | Invalid input, validation error |
| `401` | Unauthorized | Missing/invalid token |
| `403` | Forbidden | Insufficient permissions |
| `404` | Not Found | Resource doesn't exist |
| `409` | Conflict | Resource conflict (e.g., email exists) |
| `423` | Locked | Account deactivated |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Server error |

### Error Codes

| Code | Description |
|------|-------------|
| `ACCOUNT_SETUP_REQUIRED` | Must complete password change and key registration |
| `INVALID_CREDENTIALS` | Email or password incorrect |
| `INVALID_STATE_TRANSITION` | Build not in required state |
| `NOT_ASSIGNED` | User not assigned to this build |
| `INVALID_SIGNATURE` | Signature verification failed |
| `INVALID_SIGNATURE_HEADERS` | Missing/invalid signature headers |
| `KEY_EXPIRED` | Public key has expired |
| `HASH_MISMATCH` | Computed hash doesn't match provided hash |
| `BUILD_IMMUTABLE` | Cannot modify finalized build |

---

## 7. Security Considerations

### Transport Security

- **TLS 1.3** mandatory via nginx reverse proxy
- Backend never directly exposed to internet
- Certificate pinning recommended for Electron app

### Cryptographic Standards

| Operation | Standard |
|-----------|----------|
| Asymmetric Keys | RSA-4096 |
| Signing | RSA-PSS with SHA-256 |
| Symmetric Encryption | AES-256-GCM |
| Key Wrapping | RSA-OAEP with SHA-256 |
| Hashing | SHA-256 |
| Encoding | Base64 (standard, with padding) |
| Canonical JSON | RFC 8785 |

### Key Management

- **Private keys**: Generated and stored locally (Electron secure storage)
- **Public keys**: Registered with backend, expire after 90 days (configurable)
- **Key rotation**: Enforced via expiry, warnings at 7 days before expiry
- **Key fingerprint**: SHA256 of DER-encoded public key

### Audit Chain Integrity

- **Genesis hash**: `SHA256("IBM_CC:" + build_id)`
- **Event hash**: `SHA256(canonical_json(event_data) + previous_event_hash)`
- **Signatures**: Required for `BUILD_FINALIZED` and `CONTRACT_DOWNLOADED`; request-signature metadata may be captured for `BUILD_CREATED` and `ROLE_ASSIGNED`
- **Verification**: Backend verifies signatures against registered public keys

### Data Protection

- **At rest**: Only encrypted payloads stored; disk encryption recommended
- **In transit**: TLS 1.3 for all API communication
- **In memory**: Sensitive data cleared after use
- **Symmetric keys**: Wrapped with Auditor's RSA public key; backend never has access

---

## 8. Rate Limiting

### Default Limits

| Endpoint Category | Limit | Window |
|-------------------|-------|--------|
| Authentication | 5 requests | 15 minutes |
| User Management | 100 requests | 1 hour |
| Build Operations | 50 requests | 1 hour |
| Section Submissions | 10 requests | 1 hour |
| Audit/Export | 200 requests | 1 hour |

### Rate Limit Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1712566432
```

### Rate Limit Exceeded Response

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests",
    "details": {
      "retry_after": 3600
    }
  }
}
```

---

## 9. Appendix

### A. Build State Machine

```
CREATED → WORKLOAD_SUBMITTED → ENVIRONMENT_STAGED →
AUDITOR_KEYS_REGISTERED → CONTRACT_ASSEMBLED → FINALIZED

Any pre-FINALIZED state → CANCELLED (Admin only)
```

### B. Persona Workflow Summary

| Persona | Action | Endpoint | Cryptographic Operation |
|---------|--------|----------|------------------------|
| Admin | Create build | `POST /builds` | Sign mutating request (`X-Signature*`) |
| Admin | Assign role | `POST /builds/{id}/assignments` | Sign mutating request (`X-Signature*`) |
| Solution Provider | Submit workload | `POST /builds/{id}/sections` | Encrypt workload, provide section hash/signature |
| Data Owner | Submit environment | `POST /builds/{id}/sections` | Encrypt with AES, wrap key with Auditor's RSA key, provide section hash/signature |
| Auditor | Confirm attestation step | `POST /builds/{id}/attestation` | Local key generation (not uploaded) |
| Auditor | Finalize contract | `PATCH /builds/{id}/status` + `POST /builds/{id}/finalize` | Assemble contract, sign contract hash |
| Env Operator | Download contract | `GET /builds/{id}/userdata` | Verify hash |
| Env Operator | Acknowledge | `POST /builds/{id}/acknowledge-download` | Sign contract hash |

### C. Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | Backend server port |
| `DATABASE_URL` | - | PostgreSQL connection string |
| `BCRYPT_COST` | `12` | Password hash work factor |
| `PASSWORD_ROTATION_DAYS` | `90` | Password expiry interval |
| `PUBLIC_KEY_EXPIRY_DAYS` | `90` | Public key expiry interval |
| `TOKEN_EXPIRY_HOURS` | `24` | Bearer token expiry |
| `RATE_LIMIT_ENABLED` | `true` | Enable rate limiting |

### D. Useful Links

- [High-Level Design](./1-high-level-design.md)
- [Low-Level Design](./2-low-level-design.md)
- [Desktop App Design](./3-desktop-app-design.md)

---

**Document Version:** 1.0  
**Last Updated:** 2026-04-08  
**Maintained By:** IBM Confidential Computing Team
