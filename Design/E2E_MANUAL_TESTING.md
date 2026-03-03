# HPCR Contract Builder — End-to-End Manual Testing Guide

This guide walks you through manually testing the entire backend API workflow using `curl`, matching the High-Level Design (HLD) and Low-Level Design (LLD) specifications.

## Prerequisites

1.  **PostgreSQL Running:**
    ```bash
    docker run -d --name hpcr-postgres -e POSTGRES_DB=hpcr_builder -e POSTGRES_USER=hpcr -e POSTGRES_PASSWORD=devpass -p 5432:5432 postgres:16-alpine
    ```
2.  **Apply Migrations:**
    ```bash
    cat migrations/*.up.sql | docker exec -i hpcr-postgres psql -U hpcr -d hpcr_builder
    ```
3.  **Start the Backend Server:**
    ```bash
    DATABASE_URL="postgres://hpcr:devpass@localhost:5432/hpcr_builder?sslmode=disable" go run ./cmd/server/
    ```

---

## 1. Authentication & Admin Setup

By default, the backend seeds an initial `ADMIN` user. Set up some helper variables for your terminal:

```bash
export API_URL="http://localhost:8080"
```

**Login as Admin:**
```bash
ADMIN_TOKEN=$(curl -s -X POST $API_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hpcr-builder.local","password":"admin123"}' | jq -r .token)

echo "Admin Token: $ADMIN_TOKEN"
```
*(Note: If you don't have `jq` installed, you can use `grep` and `cut` as shown earlier, but `jq` is highly recommended).*

---

## 2. Persona Creation (RBAC)

The HPCR workflow requires distinct personas to submit sections sequentially. The Admin creates these users and assigns roles.

### Create Solution Provider ("Alice")
```bash
ALICE_ID=$(curl -s -X POST $API_URL/users \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"Alice (Solution Provider)",
    "email":"alice@example.com",
    "password":"password123",
    "roles":["SOLUTION_PROVIDER"]
  }' | jq -r .user.id)

ALICE_TOKEN=$(curl -s -X POST $API_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"password123"}' | jq -r .token)
```

### Create Data Owner ("Bob")
```bash
BOB_ID=$(curl -s -X POST $API_URL/users \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"Bob (Data Owner)",
    "email":"bob@example.com",
    "password":"password123",
    "roles":["DATA_OWNER"]
  }' | jq -r .user.id)

BOB_TOKEN=$(curl -s -X POST $API_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"bob@example.com","password":"password123"}' | jq -r .token)
```

### Create Auditor ("Charlie")
```bash
CHARLIE_ID=$(curl -s -X POST $API_URL/users \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"Charlie (Auditor)",
    "email":"charlie@example.com",
    "password":"password123",
    "roles":["AUDITOR"]
  }' | jq -r .user.id)

CHARLIE_TOKEN=$(curl -s -X POST $API_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"charlie@example.com","password":"password123"}' | jq -r .token)
```

---

## 3. The Build Lifecycle (State Machine)

The state machine enforces a strict linear progression.

### Step A: Admin Creates the Build
```bash
BUILD_ID=$(curl -s -X POST $API_URL/builds \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"AI Inference Workload V1"}' | jq -r .id)

echo "Build ID: $BUILD_ID"
```
*Current State: `CREATED`*

### Step B: Solution Provider Submits Workload
Alice pushes encrypted workload configurations (Zero-Knowledge).
```bash
curl -s -X POST $API_URL/builds/$BUILD_ID/sections \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "persona_role": "SOLUTION_PROVIDER",
    "encrypted_payload": "hyper-protect-basic.U2FsdGVkX1+MockEncryptedWorkl.oadData...",
    "section_hash": "mock_workload_hash_256",
    "signature": "mock_alice_signature_base64"
  }'

# Alice transitions the state
curl -s -X PATCH $API_URL/builds/$BUILD_ID/status \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"WORKLOAD_SUBMITTED"}'
```
*Current State: `WORKLOAD_SUBMITTED`*

### Step C: Data Owner  Stages Environment
Bob pushes encrypted environment/hypervisor configs.
```bash
curl -s -X POST $API_URL/builds/$BUILD_ID/sections \
  -H "Authorization: Bearer $BOB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "persona_role": "DATA_OWNER",
    "encrypted_payload": "hyper-protect-basic.U2FsdGVkX1+MockEncryptedEnvironmentData...",
    "section_hash": "mock_environment_hash_256",
    "signature": "mock_bob_signature_base64"
  }'

# Bob transitions the state
curl -s -X PATCH $API_URL/builds/$BUILD_ID/status \
  -H "Authorization: Bearer $BOB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"ENVIRONMENT_STAGED"}'
```
*Current State: `ENVIRONMENT_STAGED`*

### Step D: Auditor Registers Keys
Charlie pushes allowed auditor public keys.
```bash
curl -s -X POST $API_URL/builds/$BUILD_ID/sections \
  -H "Authorization: Bearer $CHARLIE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "persona_role": "AUDITOR",
    "encrypted_payload": "U2FsdGVkX1+MockAuditorKeys...",
    "section_hash": "mock_keys_hash_256",
    "signature": "mock_charlie_signature_base64"
  }'

# Charlie transitions the state
curl -s -X PATCH $API_URL/builds/$BUILD_ID/status \
  -H "Authorization: Bearer $CHARLIE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"AUDITOR_KEYS_REGISTERED"}'
```
*Current State: `AUDITOR_KEYS_REGISTERED`*

### Step E: Contract Assembly
In a real scenario, the Flutter desktop app downloads all sections, assembles the immutable YAML contract locally, and prepares it. 
```bash
# Transition to assembled state
curl -s -X PATCH $API_URL/builds/$BUILD_ID/status \
  -H "Authorization: Bearer $CHARLIE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"CONTRACT_ASSEMBLED"}'
```
*Current State: `CONTRACT_ASSEMBLED`*

### Step F: Finalization (Immutability)
Charlie finalizes the assembled contract on the backend, appending the finalized YAML.

```bash
curl -s -X POST $API_URL/builds/$BUILD_ID/finalize \
  -H "Authorization: Bearer $CHARLIE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "contract_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "contract_yaml": "version: 1.0\nworkload: ...\n",
    "signature": "mock_final_signature",
    "public_key": "mock_charlie_pub_key"
  }'
```
*Current State: `FINALIZED` (Terminal state, cannot be modified or canceled).*

---

## 4. Audit Chain Verification

At any point, anyone with an authenticated token can query the tamper-evident chronological audit hash chain to prove the build's integrity.

```bash
curl -s $API_URL/builds/$BUILD_ID/audit-trail \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

*Expected output will be an array of `audit_events` starting from `sequence_no: 1` (`BUILD_CREATED`), with `previous_event_hash` mapped linearly upward to `sequence_no: 6` (`BUILD_FINALIZED`).* Default genesis hash is derived via `SHA256("IBM_CC:<build_id>")` natively in the backend.

## Error Testing (Optional)

You can verify the RBAC rules and State Machine restrictions by intentionally doing things out of order:
- Try `FINALIZING` a build with Alice's (`SOLUTION_PROVIDER`) token instead of Charlie's. -> Expect `403 Forbidden`.
- Try skipping `WORKLOAD_SUBMITTED` directly to `ENVIRONMENT_STAGED`. -> Expect `400 Bad Request (Invalid State Transition)`.
- Try submitting a section twice for `SOLUTION_PROVIDER`. -> Expect `400 Bad Request`.
