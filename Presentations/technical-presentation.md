# IBM Confidential Computing Contract Generator
## Technical Presentation

**Audience:** Engineering, Security, Architecture, DevOps  
**Duration:** 30-40 minutes  
**Date:** April 12, 2026

---

## Slide 1: Scope
- Current implementation architecture and trust boundaries.
- Security control model across backend and desktop app.
- Build workflow, authorization, and verification behavior.
- Deployment topology and production hardening baseline.
- Outstanding hardening opportunities.

---

## Slide 2: End-to-End Architecture
- Electron desktop app performs client-side cryptographic operations.
- Go backend enforces auth, setup restrictions, RBAC + assignment checks, and workflow state transitions.
- PostgreSQL stores encrypted section artifacts, workflow metadata, and audit chain events.
- nginx reverse proxy fronts backend and handles TLS termination in production.

---

## Slide 3: Trust Boundaries
- Private keys are generated and retained on user devices.
- Backend validates signatures using registered public keys only.
- Backend does not assemble contracts or hold decrypted environment secrets.
- Network trust boundary is at reverse proxy ingress.

---

## Slide 4: Build Lifecycle (Current)
- `CREATED -> WORKLOAD_SUBMITTED -> ENVIRONMENT_STAGED -> AUDITOR_KEYS_REGISTERED -> CONTRACT_ASSEMBLED -> FINALIZED -> CONTRACT_DOWNLOADED`
- `CANCELLED` allowed only from non-terminal pre-finalized states.
- `CONTRACT_DOWNLOADED` is set only via acknowledge-download endpoint.
- Download acknowledgment is one-time; re-download is blocked.

---

## Slide 5: Authorization Model (Implemented)
- Layer 1: global RBAC (`ADMIN`, `SOLUTION_PROVIDER`, `DATA_OWNER`, `AUDITOR`, `ENV_OPERATOR`, `VIEWER`).
- Layer 2: explicit build assignment by role.
- `GET /builds`: admin gets all builds; non-admin gets assignment-filtered list.
- `/builds/{id}/...`: guarded by build-access middleware (admin or assigned user).

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
- Solution Provider submits workload section + section signature.
- Data Owner submits encrypted environment + wrapped symmetric key.
- Auditor stage includes attestation registration and contract assembly/finalization.
- Env Operator performs export + signed download acknowledgment.

---

## Slide 9: Audit Chain and Signature Semantics
- Genesis hash: `SHA256("IBM_CC:" + build_id)`.
- Each event hash links to previous event hash.
- Verification expects signatures on:
  - `WORKLOAD_SUBMITTED`
  - `ENVIRONMENT_STAGED`
  - `AUDITOR_KEYS_REGISTERED`
  - `CONTRACT_ASSEMBLED`
  - `BUILD_FINALIZED`
  - `CONTRACT_DOWNLOADED`
- Request-signature metadata is captured for signed mutating operations like build creation and role assignment.

---

## Slide 10: Verification API Surface
- `GET /builds/{id}/verify` validates audit hash-chain continuity and required signatures.
- `GET /builds/{id}/verify-contract` validates finalized contract integrity/signature semantics.
- Frontend audit UI provides manual verification guidance and stage-specific verification help by persona.

---

## Slide 11: Backend Runtime Hardening
- Middleware chain: recoverer, request-id, security headers, logging, CORS, body-limit, timeout, rate-limit.
- Authenticated chain adds: auth, setup guard, request-signature enforcement.
- Rate limiting:
  - global: 10 req/sec, burst 20
  - login: 5 req/min, burst 3
- Security headers include `nosniff`, `DENY` framing, permissions policy, and HSTS on TLS requests.

---

## Slide 12: Desktop Security Hardening
- Electron renderer isolation: `contextIsolation=true`, `sandbox=true`, `nodeIntegration=false`.
- `webSecurity=true`, `allowRunningInsecureContent=false`, `webviewTag=false`.
- IPC calls are sender-validated via trusted-origin checks.
- Navigation/webview abuse blocked (`setWindowOpenHandler`, `will-navigate`, `will-attach-webview`).
- Session storage cleanup on close/quit and certificate-error rejection enabled.

---

## Slide 13: Deployment Topology and Operations
- Compose services: reverse proxy, backend, postgres, migrate.
- Segmented networks with internal DB network.
- Container hardening includes read-only fs, dropped caps, `no-new-privileges`, resource limits.
- TLS deployment via prod overlay + `tls.conf` + mounted cert/key.

---

## Slide 14: New Documentation Deliverables
- Security architecture reference: `Design/5-security-design.md`.
- Deployment runbook: `Design/6-deployment-guide.md`.
- Existing docs synchronized with implementation:
  - `1-high-level-design.md`
  - `2-low-level-design.md`
  - `3-desktop-app-design.md`
  - `4-api-documentation.md`

---

## Slide 15: Technical Next Steps
- Expand automated negative-path tests for signature/replay/access edge cases.
- Add staged release gates for desktop/backend version compatibility.
- Add production operations validation pipeline (health, verify, verify-contract checks).
- Evaluate stronger client private-key protection (OS keychain/HSM integration path).
