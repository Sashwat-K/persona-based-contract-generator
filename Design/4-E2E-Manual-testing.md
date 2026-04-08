# IBM Confidential Computing Contract Generator — End-to-End Manual Testing Guide

This guide walks you through manually testing the entire backend API workflow using `curl`, matching the High-Level Design (HLD) and Low-Level Design (LLD) specifications with all the latest security features.

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

### Create Environment Operator ("Dave")
```bash
DAVE_ID=$(curl -s -X POST $API_URL/users \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"Dave (Environment Operator)",-
    "email":"dave@example.com",
    "password":"password123",
    "roles":["ENV_OPERATOR"]
  }' | jq -r .user.id)

DAVE_TOKEN=$(curl -s -X POST $API_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dave@example.com","password":"password123"}' | jq -r .token)
```

---

## 3. Public Key Management (NEW)

Each user must register their RSA-4096 public key for cryptographic signing.

### Generate RSA Key Pair (Example)
```bash
# Generate private key
openssl genrsa -out alice_private.pem 4096

# Extract public key
openssl rsa -in alice_private.pem -pubout -out alice_public.pem

# Read public key
ALICE_PUBLIC_KEY=$(cat alice_public.pem | tr -d '\n')
```

### Register Alice's Public Key
```bash
curl -s -X PUT $API_URL/users/$ALICE_ID/public-key \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"public_key\": \"$ALICE_PUBLIC_KEY\"
  }" | jq .
```

### Get Public Key Information
```bash
curl -s -X GET $API_URL/users/$ALICE_ID/public-key \
  -H "Authorization: Bearer $ALICE_TOKEN" | jq .
```

**Expected Response:**
```json
{
  "public_key": "-----BEGIN PUBLIC KEY-----\n...",
  "fingerprint": "sha256:abc123...",
  "registered_at": "2024-01-15T10:30:00Z",
  "expires_at": "2024-04-15T10:30:00Z"
}
```

---

## 4. The Build Lifecycle (State Machine)

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

### Step B: Admin Assigns Users to Build (NEW)
```bash
# Assign Alice (Solution Provider)
curl -s -X POST $API_URL/builds/$BUILD_ID/assignments \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"user_id\": \"$ALICE_ID\",
    \"persona_role\": \"SOLUTION_PROVIDER\"
  }" | jq .

# Assign Bob (Data Owner)
curl -s -X POST $API_URL/builds/$BUILD_ID/assignments \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"user_id\": \"$BOB_ID\",
    \"persona_role\": \"DATA_OWNER\"
  }" | jq .

# Assign Charlie (Auditor)
curl -s -X POST $API_URL/builds/$BUILD_ID/assignments \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"user_id\": \"$CHARLIE_ID\",
    \"persona_role\": \"AUDITOR\"
  }" | jq .

# Assign Dave (Environment Operator)
curl -s -X POST $API_URL/builds/$BUILD_ID/assignments \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"user_id\": \"$DAVE_ID\",
    \"persona_role\": \"ENV_OPERATOR\"
  }" | jq .
```

### View Build Assignments
```bash
curl -s -X GET $API_URL/builds/$BUILD_ID/assignments \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

### Step C: Solution Provider Submits Workload
Alice pushes encrypted workload configurations (Zero-Knowledge) with cryptographic signature.

```bash
# Generate signature (example - in production, sign with private key)
WORKLOAD_PAYLOAD='{"type":"workload","data":"encrypted_workload_data"}'
WORKLOAD_HASH=$(echo -n "$WORKLOAD_PAYLOAD" | sha256sum | cut -d' ' -f1)

# Sign the hash with Alice's private key
ALICE_SIGNATURE=$(echo -n "$WORKLOAD_HASH" | openssl dgst -sha256 -sign alice_private.pem | base64 -w0)

curl -s -X POST $API_URL/builds/$BUILD_ID/sections \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"persona_role\": \"SOLUTION_PROVIDER\",
    \"encrypted_payload\": \"hyper-protect-basic.U2FsdGVkX1+MockEncryptedWorkloadData...\",
    \"section_hash\": \"$WORKLOAD_HASH\",
    \"signature\": \"$ALICE_SIGNATURE\"
  }" | jq .

# Alice transitions the state
curl -s -X PATCH $API_URL/builds/$BUILD_ID/status \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"WORKLOAD_SUBMITTED"}' | jq .
```
*Current State: `WORKLOAD_SUBMITTED`*

### Step D: Data Owner Stages Environment
Bob pushes encrypted environment/hypervisor configs with signature.

```bash
ENV_PAYLOAD='{"type":"environment","data":"encrypted_env_data"}'
ENV_HASH=$(echo -n "$ENV_PAYLOAD" | sha256sum | cut -d' ' -f1)
BOB_SIGNATURE=$(echo -n "$ENV_HASH" | openssl dgst -sha256 -sign bob_private.pem | base64 -w0)

curl -s -X POST $API_URL/builds/$BUILD_ID/sections \
  -H "Authorization: Bearer $BOB_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"persona_role\": \"DATA_OWNER\",
    \"encrypted_payload\": \"hyper-protect-basic.U2FsdGVkX1+MockEncryptedEnvironmentData...\",
    \"section_hash\": \"$ENV_HASH\",
    \"signature\": \"$BOB_SIGNATURE\"
  }" | jq .

# Bob transitions the state
curl -s -X PATCH $API_URL/builds/$BUILD_ID/status \
  -H "Authorization: Bearer $BOB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"ENVIRONMENT_STAGED"}' | jq .
```
*Current State: `ENVIRONMENT_STAGED`*

### Step E: Auditor Registers Keys
Charlie pushes allowed auditor public keys with signature.

```bash
KEYS_PAYLOAD='{"type":"auditor_keys","data":"encrypted_keys_data"}'
KEYS_HASH=$(echo -n "$KEYS_PAYLOAD" | sha256sum | cut -d' ' -f1)
CHARLIE_SIGNATURE=$(echo -n "$KEYS_HASH" | openssl dgst -sha256 -sign charlie_private.pem | base64 -w0)

curl -s -X POST $API_URL/builds/$BUILD_ID/sections \
  -H "Authorization: Bearer $CHARLIE_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"persona_role\": \"AUDITOR\",
    \"encrypted_payload\": \"U2FsdGVkX1+MockAuditorKeys...\",
    \"section_hash\": \"$KEYS_HASH\",
    \"signature\": \"$CHARLIE_SIGNATURE\"
  }" | jq .

# Charlie transitions the state
curl -s -X PATCH $API_URL/builds/$BUILD_ID/status \
  -H "Authorization: Bearer $CHARLIE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"AUDITOR_KEYS_REGISTERED"}' | jq .
```
*Current State: `AUDITOR_KEYS_REGISTERED`*

### Step F: Contract Assembly
In a real scenario, the Electron desktop app downloads all sections, assembles the immutable YAML contract locally, and prepares it.

```bash
# Transition to assembled state
curl -s -X PATCH $API_URL/builds/$BUILD_ID/status \
  -H "Authorization: Bearer $CHARLIE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"CONTRACT_ASSEMBLED"}' | jq .
```
*Current State: `CONTRACT_ASSEMBLED`*

### Step G: Finalization (Immutability)
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
  }' | jq .
```
*Current State: `FINALIZED` (Terminal state, cannot be modified or canceled).*

---

## 5. Contract Export & Verification (NEW)

### Export Contract (AUDITOR or ENV_OPERATOR)
```bash
curl -s -X GET $API_URL/builds/$BUILD_ID/export \
  -H "Authorization: Bearer $CHARLIE_TOKEN" | jq .
```

**Expected Response:**
```json
{
  "build_id": "uuid",
  "contract_yaml": "base64_encoded_yaml",
  "contract_hash": "sha256_hash",
  "finalized_at": "2024-01-15T12:00:00Z",
  "finalized_by": "Charlie (Auditor)",
  "signatures": [...]
}
```

### Get User Data for Contract (ENV_OPERATOR)
```bash
curl -s -X GET $API_URL/builds/$BUILD_ID/userdata \
  -H "Authorization: Bearer $DAVE_TOKEN" | jq .
```

### Acknowledge Download (ENV_OPERATOR)
```bash
curl -s -X POST $API_URL/builds/$BUILD_ID/acknowledge-download \
  -H "Authorization: Bearer $DAVE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "downloaded_at": "2024-01-15T12:05:00Z",
    "signature": "env_operator_signature"
  }' | jq .
```

### Verify Audit Chain
```bash
curl -s -X GET $API_URL/builds/$BUILD_ID/verify \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

**Expected Response:**
```json
{
  "build_id": "uuid",
  "is_valid": true,
  "genesis_hash": "sha256_hash",
  "total_events": 10,
  "verified_events": 10,
  "chain_integrity": "VALID"
}
```

### Verify Contract Integrity
```bash
curl -s -X GET $API_URL/builds/$BUILD_ID/verify-contract \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

---

## 6. Audit Chain Verification

At any point, anyone with an authenticated token can query the tamper-evident chronological audit hash chain to prove the build's integrity.

```bash
curl -s $API_URL/builds/$BUILD_ID/audit-trail \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

**Expected output will include:**
- Array of `audit_events` starting from `sequence_no: 1` (`BUILD_CREATED`)
- Each event contains:
  - `event_hash`: SHA256 hash of event data + previous hash
  - `previous_event_hash`: Links to previous event (or genesis hash for first event)
  - `actor_key_fingerprint`: SHA256 fingerprint of actor's public key (NEW)
  - `signature`: Cryptographic signature of the event
  - `event_type`, `actor_user_id`, `event_data`, `created_at`

*Genesis hash is derived via `SHA256("IBM_CC:<build_id>")` for the first event.*

---

## 7. Credential Rotation Management (NEW - ADMIN Only)

### Check Expired Credentials
```bash
curl -s -X GET $API_URL/rotation/expired \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

**Expected Response:**
```json
{
  "expired_passwords": [
    {
      "user_id": "uuid",
      "user_name": "Alice",
      "user_email": "alice@example.com",
      "password_age": "95d",
      "last_changed": "2023-10-10T10:00:00Z",
      "must_change": false
    }
  ],
  "expired_public_keys": [
    {
      "user_id": "uuid",
      "user_name": "Bob",
      "user_email": "bob@example.com",
      "key_age": "92d",
      "registered_at": "2023-10-12T10:00:00Z",
      "expires_at": "2024-01-10T10:00:00Z",
      "days_overdue": 5
    }
  ],
  "total_expired": 2,
  "checked_at": "2024-01-15T10:00:00Z"
}
```

### Force Password Change
```bash
curl -s -X POST $API_URL/rotation/force-password-change/$ALICE_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

### Revoke Expired Public Key
```bash
curl -s -X POST $API_URL/rotation/revoke-key/$BOB_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

---

## 8. Password Management (NEW)

### Change Password
```bash
curl -s -X PATCH $API_URL/users/$ALICE_ID/password \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "current_password": "password123",
    "new_password": "newSecurePassword456!"
  }' | jq .
```

---

## 9. API Token Management (NEW)

### Create API Token
```bash
TOKEN_ID=$(curl -s -X POST $API_URL/users/$ALICE_ID/tokens \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "CI/CD Pipeline Token",
    "expires_in_days": 90
  }' | jq -r .token_id)

echo "Token ID: $TOKEN_ID"
```

### List User Tokens
```bash
curl -s -X GET $API_URL/users/$ALICE_ID/tokens \
  -H "Authorization: Bearer $ALICE_TOKEN" | jq .
```

### Revoke Token
```bash
curl -s -X DELETE $API_URL/users/$ALICE_ID/tokens/$TOKEN_ID \
  -H "Authorization: Bearer $ALICE_TOKEN" | jq .
```

---

## 10. Rate Limiting Testing (NEW)

The API implements three-tier rate limiting:

### Test Global Rate Limit (10 req/s, burst 20)
```bash
# Send 25 rapid requests
for i in {1..25}; do
  curl -s -X GET $API_URL/health &
done
wait

# Expected: First 20 succeed, remaining 5 get HTTP 429 (Too Many Requests)
```

### Test Auth Rate Limit (5 req/min, burst 3)
```bash
# Send 5 rapid login attempts
for i in {1..5}; do
  curl -s -X POST $API_URL/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}' &
done
wait

# Expected: First 3 attempts processed, remaining 2 get HTTP 429
```

---

## 11. Error Testing

You can verify the RBAC rules and State Machine restrictions by intentionally doing things out of order:

### Test RBAC Violations
```bash
# Try finalizing with Alice's (SOLUTION_PROVIDER) token instead of Charlie's
curl -s -X POST $API_URL/builds/$BUILD_ID/finalize \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"contract_hash":"test","contract_yaml":"test","signature":"test","public_key":"test"}'
# Expected: 403 Forbidden
```

### Test State Machine Violations
```bash
# Try skipping WORKLOAD_SUBMITTED directly to ENVIRONMENT_STAGED
curl -s -X PATCH $API_URL/builds/$BUILD_ID/status \
  -H "Authorization: Bearer $BOB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"ENVIRONMENT_STAGED"}'
# Expected: 400 Bad Request (Invalid State Transition)
```

### Test Assignment Violations (NEW)
```bash
# Try submitting section without being assigned to build
curl -s -X POST $API_URL/builds/$BUILD_ID/sections \
  -H "Authorization: Bearer $UNASSIGNED_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"persona_role":"SOLUTION_PROVIDER","encrypted_payload":"test","section_hash":"test","signature":"test"}'
# Expected: 403 Forbidden (User not assigned to this build)
```

### Test Duplicate Section Submission
```bash
# Try submitting a section twice for SOLUTION_PROVIDER
curl -s -X POST $API_URL/builds/$BUILD_ID/sections \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"persona_role":"SOLUTION_PROVIDER","encrypted_payload":"test2","section_hash":"test2","signature":"test2"}'
# Expected: 400 Bad Request (Section already submitted)
```

---

## 12. Security Features Summary

### Implemented Security Layers
1. **Rate Limiting**: DDoS protection with token bucket algorithm
2. **Authentication**: JWT tokens + API tokens with expiry
3. **Authorization**: Role-based + assignment-based access control
4. **Cryptographic Signatures**: RSA-4096 with RSA-PSS for non-repudiation
5. **Audit Hash Chain**: Tamper-evident logging with genesis hash
6. **Credential Rotation**: 90-day expiry monitoring for passwords and keys
7. **Public Key Management**: Identity-bound signatures with fingerprints

### Key Security Properties
- **Non-Repudiation**: Every action signed with user's private key
- **Tamper Detection**: Hash chain breaks if any event is modified
- **Access Control**: Two-layer (role + assignment) prevents unauthorized access
- **Credential Hygiene**: Automated detection of stale credentials
- **Brute Force Protection**: Strict rate limiting on auth endpoints
- **Audit Trail**: Complete chronological record of all actions

---

## Notes

- All timestamps are in ISO 8601 UTC format
- All hashes are SHA-256 (64 hex characters)
- All signatures are RSA-PSS with SHA-256
- Public keys are RSA-4096 in PEM format
- Rate limits are per-IP address with automatic cleanup
- Credential rotation monitor runs every 24 hours in background
- Genesis hash format: `SHA256("IBM_CC:" + build_id)`

---

## Troubleshooting

### Common Issues

1. **429 Too Many Requests**: Wait a few seconds and retry
2. **403 Forbidden**: Check user role and build assignment
3. **400 Invalid State Transition**: Follow the correct state machine order
4. **401 Unauthorized**: Token expired, login again
5. **Public Key Expired**: Register a new public key

### Debug Commands

```bash
# Check server logs
docker logs hpcr-backend

# Check database state
docker exec -it hpcr-postgres psql -U hpcr -d hpcr_builder -c "SELECT * FROM builds;"

# Verify migrations
docker exec -it hpcr-postgres psql -U hpcr -d hpcr_builder -c "SELECT version FROM schema_migrations;"
```

---

**End of E2E Manual Testing Guide**
