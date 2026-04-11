# IBM Confidential Computing Contract Generator
## Technical Presentation

**Audience:** Engineering, Security, Architecture, DevOps  
**Duration:** 30-40 minutes  
**Date:** April 10, 2026

---

## Slide 1: Scope
- Architecture and trust boundaries.
- Persona workflow and state machine.
- Cryptographic controls and verification model.
- API and frontend integration behavior.
- Open technical hardening items.

---

## Slide 2: System Architecture
- Electron desktop app (renderer + main process) performs local crypto.
- Go backend enforces authn/authz, state transitions, assignment checks, audit chain.
- PostgreSQL stores encrypted artifacts, metadata, and audit events.
- Backend never handles private keys or plaintext confidential payloads.

---

## Slide 3: Trust Boundaries
- Private keys remain on client device.
- Backend trusts only registered public keys.
- Mutating API calls require signed request headers.
- Final contract integrity is validated via hash + signature checks.

---

## Slide 4: State Machine (Current)
- `CREATED -> WORKLOAD_SUBMITTED -> ENVIRONMENT_STAGED -> AUDITOR_KEYS_REGISTERED -> CONTRACT_ASSEMBLED -> FINALIZED`
- `CANCELLED` allowed from any pre-finalized state.
- `POST /builds/{id}/attestation` is idempotent for already-registered/progressed builds.

---

## Slide 5: Access Control Model
- Layer 1: RBAC (`SOLUTION_PROVIDER`, `DATA_OWNER`, `AUDITOR`, `ENV_OPERATOR`, `ADMIN`, `VIEWER`).
- Layer 2: explicit per-build assignment.
- Build actions require both role and assignment alignment.

---

## Slide 6: Request Signing (Mutating APIs)
- Required headers: `X-Signature`, `X-Signature-Hash`, `X-Timestamp` (+ optional `X-Key-Fingerprint`).
- Hash payload includes method/path/body/timestamp.
- Backend recomputes and verifies hash + signature against authenticated user key.
- Exemptions: logout, own password change, own public-key registration.

---

## Slide 7: Section Submission Contract
- Endpoint: `POST /builds/{id}/sections`.
- Uses `role_id` (preferred) with `persona_role` backward-compatible fallback.
- Data Owner must submit `encrypted_symmetric_key`.
- Persisted/returned field is `wrapped_symmetric_key`.
- Section fields include `section_hash` + `signature`.

---

## Slide 8: Auditor Flow (Sign & Add Attestation)
- Step 1: Generate signing key/cert locally.
- Step 2: Generate attestation key locally.
- Step 3: Generate encrypted environment preview.
- Step 4: Encrypt attestation public key and confirm attestation state.
- Finalization tab assembles contract, computes hash, signs hash, submits finalize request.

---

## Slide 9: Finalization & Export
- Finalize request carries `contract_yaml`, `contract_hash`, `signature`, `public_key`.
- Backend stores contract and marks immutable.
- Export/userdata supports raw YAML and legacy base64 compatibility.
- Env operator acknowledgment endpoint: `POST /builds/{id}/acknowledge-download`.

---

## Slide 10: Audit Chain Semantics
- Genesis hash: `SHA256("IBM_CC:" + build_id)`.
- Event hash: `SHA256(canonicalized_event_data + previous_hash)`.
- Canonicalization currently via JSON normalize (unmarshal+marshal).
- Signature-required events: `BUILD_FINALIZED`, `CONTRACT_DOWNLOADED`.
- Additional signed events when request signatures are captured: `BUILD_CREATED`, `ROLE_ASSIGNED`.

---

## Slide 11: Verification Endpoints
- `GET /builds/{id}/verify`: audit-chain integrity + signature checks.
- `GET /builds/{id}/verify-contract`: finalized contract integrity checks.
- Signature hash target varies by event type (`contract_hash`, `request_signature_hash`, or `event_hash`).

---

## Slide 12: Frontend Integration Notes
- Zustand stores for auth/build/config/UI.
- `apiClient` handles auth headers, error normalization, 401 forced logout.
- `signatureMiddleware` auto-signs mutating requests.
- Audit UI merges verify + verify-contract outcomes for operator clarity.

---

## Slide 13: Hardening Priorities
- Expand backend tests around request-signature edge cases.
- Add explicit regression tests for idempotent attestation and retry races.
- Strengthen release checks for desktop/backend version alignment.
- Optional: adopt strict RFC 8785 library for canonicalization.

---

## Slide 14: Operational Runbook Essentials
- Startup order: DB -> backend -> desktop app.
- If schema/flow changed: create new test build for clean validation.
- Verify first-login setup completion before workflow actions.
- Use audit + verify endpoints as go/no-go signal before deployment.

---

## Slide 15: Q&A / Deep-Dive Topics
- Signature model and compatibility path.
- Event-level verification semantics.
- Deployment packaging and environment promotion strategy.
