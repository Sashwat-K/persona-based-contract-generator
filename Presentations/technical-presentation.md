# IBM Confidential Computing Contract Generator
## Technical Presentation

**Audience:** Engineering, Security, Architecture, DevOps  
**Duration:** 30-40 minutes  
**Date:** April 23, 2026

---

## Slide 1: Scope
- Current implementation architecture and trust boundaries.
- Security control model across backend and desktop app.
- Build workflow, authorization, and verification behavior (including post-finalization attestation evidence).
- Deployment topology and production hardening baseline.
- Outstanding hardening opportunities.

---

## Slide 2: End-to-End Architecture
- Electron desktop app handles persona UX, local identity-key signing, and orchestration.
- Go backend enforces auth, setup restrictions, RBAC + assignment checks, workflow state transitions, and contract-go operations.
- PostgreSQL stores encrypted section artifacts, workflow metadata, and audit chain events.
- HashiCorp Vault governs build-scoped signing/attestation keys for backend HPCR operations.
- nginx reverse proxy fronts backend and handles TLS termination in production.

---

## Slide 3: Trust Boundaries
- User identity private keys remain client-side and are never sent to backend.
- Build signing/attestation private keys are Vault-governed and retrieved by backend only just-in-time for HPCR operations.
- Backend validates signatures using registered public keys only.
- Backend performs contract assembly/signing and attestation decrypt/verify in controlled runtime memory.
- Network trust boundary is at reverse proxy ingress.

---

## Slide 4: Build Lifecycle (Current)
- `CREATED -> SIGNING_KEY_REGISTERED -> WORKLOAD_SUBMITTED -> ENVIRONMENT_STAGED -> ATTESTATION_KEY_REGISTERED -> FINALIZED -> CONTRACT_DOWNLOADED`
- `CANCELLED` allowed only from non-terminal pre-finalized states.
- `CONTRACT_DOWNLOADED` is set only via acknowledge-download endpoint.
- Download acknowledgment is one-time; re-download is blocked.
- Post-finalization attestation lifecycle (separate state): `PENDING_UPLOAD -> UPLOADED -> VERIFIED | REJECTED`.

---

## Slide 5: Authorization Model (Implemented)
- Layer 1: global RBAC (`ADMIN`, `SOLUTION_PROVIDER`, `DATA_OWNER`, `AUDITOR`, `ENV_OPERATOR`, `VIEWER`).
- Layer 2: explicit build assignment by role.
- `GET /builds`: admin gets all builds; non-admin gets assignment-filtered list.
- `/builds/{id}/...`: guarded by build-access middleware (admin or assigned user).
- Attestation evidence roles:
  - upload: assigned `DATA_OWNER` or assigned `ENV_OPERATOR`
  - verify: assigned `AUDITOR`

---

## Slide 6: Request Signing Pipeline
- Mutating authenticated APIs require `X-Signature`, `X-Signature-Hash`, `X-Timestamp` (+ optional `X-Key-Fingerprint`).
- Canonical hash payload: method + path + JSON body + timestamp.
- Signature timestamp tolerance is +/-5 minutes.
- Verification is against authenticated user registered public key.
- Exemptions: logout, own password change, own public-key registration.

---

## Slide 7: Setup Guard and Credential Controls
- Setup-incomplete users are restricted to setup-safe endpoints only.
- Setup pending triggers:
  - forced password change
  - missing/expired public key
- Rotation policy in implementation: 90-day password/key checks.
- Setup guard returns explicit `ACCOUNT_SETUP_REQUIRED` details.

---

## Slide 8: Stage Data Flow
- Solution Provider submits plaintext workload + HPCR cert to backend v2 section endpoint.
- Data Owner submits plaintext environment + HPCR cert to backend v2 section endpoint.
- Backend performs section encryption (`contract-go`) and persists encrypted artifacts.
- Auditor stage registers signing/attestation keys and finalizes via backend v2 finalize endpoint.
- Env Operator performs export + signed download acknowledgment.

---

## Slide 9: Attestation Evidence (Post-Finalization)
- Upload endpoint supports signed JSON (desktop-preferred) and multipart payloads.
- Desktop unlock for upload is at `CONTRACT_DOWNLOADED`.
- Upload allowed when attestation state is `PENDING_UPLOAD` or `REJECTED`.
- Verify allowed when build is finalized/downloaded, state is `UPLOADED`, and evidence exists.
- Auditor can supply optional `attestation_key_passphrase` for encrypted key material.
- Rejected verdicts include contract-go error reason for diagnosis.

---

## Slide 10: Audit Chain and Signature Semantics
- Genesis hash: `SHA256("IBM_CC:" + build_id)`.
- Each event hash links to previous event hash.
- Verification expects signatures on:
  - `BUILD_CREATED`
  - `SIGNING_KEY_CREATED`
  - `WORKLOAD_SUBMITTED`
  - `ENVIRONMENT_STAGED`
  - `ATTESTATION_KEY_REGISTERED`
  - `BUILD_FINALIZED`
  - `CONTRACT_DOWNLOADED`
  - `ATTESTATION_EVIDENCE_UPLOADED`
  - `ATTESTATION_VERIFIED`
- Request-signature metadata is captured for signed mutating operations like build creation and role assignment.

---

## Slide 11: Verification API Surface
- `GET /builds/{id}/verify` validates audit hash-chain continuity and required signatures.
- `GET /builds/{id}/verify-contract` validates finalized contract integrity/signature semantics.
- `POST /builds/{id}/attestation/evidence/{evidence_id}/verify` runs
  `HpcrGetAttestationRecords(...)` + `HpcrVerifySignatureAttestationRecords(...)`.
- `GET /builds/{id}/attestation/status` exposes attestation state/verdict/evidence summary.
- Frontend audit UI provides manual verification guidance and stage-specific verification help by persona.

---

## Slide 12: Backend Runtime Hardening
- Middleware chain: recoverer, request-id, security headers, logging, CORS, body-limit, timeout, rate-limit.
- Authenticated chain adds: auth, setup guard, request-signature enforcement.
- Rate limiting:
  - global: 10 req/sec, burst 20
  - login: 5 req/min, burst 3
- Security headers include `nosniff`, `DENY` framing, permissions policy, and HSTS on TLS requests.

---

## Slide 13: Desktop Security and UX Reliability
- Electron renderer isolation: `contextIsolation=true`, `sandbox=true`, `nodeIntegration=false`.
- `webSecurity=true`, `allowRunningInsecureContent=false`, `webviewTag=false`.
- IPC calls are sender-validated via trusted-origin checks.
- Navigation/webview abuse blocked (`setWindowOpenHandler`, `will-navigate`, `will-attach-webview`).
- Session storage cleanup on close/quit and certificate-error rejection enabled.
- Login server version discovery now checks `/health`, then `/about` fallback; version row is shown only when resolved.
- Build Management icon alignment fix is scoped to toolbar-specific classes (no global Carbon override).
- Password strength meter uses custom progress fill and strict 5-criteria validation in account/user flows.

---

## Slide 14: Deployment Topology and Operations
- Compose services: reverse proxy, backend, postgres, migrate.
- Segmented networks with internal DB network.
- Container hardening includes read-only fs, dropped caps, `no-new-privileges`, resource limits.
- TLS deployment via prod overlay + `tls.conf` + mounted cert/key.

---

## Slide 15: Documentation Alignment Status
- Design docs synchronized to current implementation:
  - `1-high-level-design.md`
  - `2-low-level-design.md`
  - `3-desktop-app-design.md`
  - `4-api-documentation.md`
- `5-security-design.md`
- `6-deployment-guide.md`
- Legacy UI/UX phase planning docs were removed from `Design/` to reduce stale guidance.

---

## Slide 16: Technical Next Steps
- Expand automated negative-path tests for signature/replay/access edge cases.
- Add staged release gates for desktop/backend version compatibility.
- Add production operations validation pipeline (health, verify, verify-contract checks).
- Evaluate stronger client private-key protection (OS keychain/HSM integration path).
