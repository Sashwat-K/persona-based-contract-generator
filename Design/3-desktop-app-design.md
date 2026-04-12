# Desktop App Frontend Design Document

## Document Information

| Field | Value |
| --- | --- |
| Product | IBM CC Contract Builder |
| Repository | persona-based-contract-generator |
| Area | Electron desktop application (`app/`) |
| Audience | Engineering, Security, Product, QA |
| Last Updated | 2026-04-12 |
| Source of Truth | Current implementation in `app/main`, `app/src`, and `app/electron-builder.json` |

---

## 1. Executive Summary

This document describes the current desktop app architecture as implemented in code.

The application is a secure Electron + React + Carbon desktop client for persona-based contract generation with:

- strict process separation (`main` / `preload` / `renderer`)
- multi-role workflow orchestration across build stages
- cryptographic operations isolated behind audited IPC bridges
- role-based UI surfaces for admin and persona operators
- export, verification, and audit-trail validation tooling

The app is now implemented as a production-oriented desktop client, not only a prototype UI shell.

---

## 2. Scope

### In Scope

- Electron runtime and process model
- Renderer architecture (views, components, state, services)
- role-based navigation and stage workflows
- IPC contract between renderer and main process
- security controls already implemented in code
- packaging, build, and platform distribution behavior

### Out of Scope

- backend internal design (covered in backend docs)
- backend schema-level details beyond client integration
- cryptographic policy approvals or compliance sign-off

---

## 3. Current Technology Stack

## 3.1 Runtime and Frameworks

- Electron: `^41.1.1`
- React: `^19.2.4`
- React DOM: `^19.2.4`
- React Router DOM: `^7.1.3`
- Zustand: `^5.0.2`
- Carbon React: `^1.104.1`
- Carbon Charts: `^1.27.3`
- Axios: `^1.7.9`
- Sass: `^1.99.0`

## 3.2 Build Tooling

- Vite: `^8.0.3`
- electron-builder: `^26.8.1`
- concurrently / wait-on for local dev orchestration

## 3.3 Node Toolchain

- `.nvmrc`: `25.9.0`
- `.node-version`: `25.9.0`
- `engines` in `app/package.json`: Node `>=25.9.0`, npm `>=11.12.1`

---

## 4. Application Architecture

## 4.1 Process Model

The desktop app uses a three-layer Electron model:

1. **Main process** (`app/main/index.js`)
   - window creation
   - security policy enforcement
   - IPC request validation
   - privileged operations (file dialogs, shell, cryptography, contract-cli subprocesses)

2. **Preload bridge** (`app/main/preload.js`)
   - exposes a minimal `window.electron` API via `contextBridge`
   - no raw `ipcRenderer` exposure to app code

3. **Renderer process** (`app/src/*`)
   - React SPA UI and workflow orchestration
   - service layer calling backend APIs and preload APIs

## 4.2 Backend Interaction

The renderer calls a Go backend over HTTP/HTTPS.

- base URL is configurable from login flow
- health checks target `/health`
- mutating API requests are signed with local private keys (except explicit exempt endpoints)

---

## 5. Repository Structure (Desktop App)

```text
app/
  main/
    index.js              # main process bootstrap, security, IPC handlers
    preload.js            # renderer-safe API bridge
    crypto/
      keyManager.js
      encryptor.js
      signer.js
      keyStorage.js
      contractCli.js
  src/
    App.jsx
    main.jsx
    index.scss
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
      ...
    views/
      Login.jsx
      Home.jsx
      BuildManagement.jsx
      BuildDetails.jsx
      AdminAnalytics.jsx
      UserManagement.jsx
      AccountSettings.jsx
      SystemLogs.jsx
    services/
      apiClient.js
      authService.js
      buildService.js
      sectionService.js
      assignmentService.js
      exportService.js
      verificationService.js
      signatureMiddleware.js
      ...
    store/
      authStore.js
      buildStore.js
      configStore.js
      ...
  electron-builder.json
  package.json
  BUILD.md
```

---

## 6. Main Process Design (`app/main/index.js`)

## 6.1 Window and Runtime Configuration

`BrowserWindow` is created with security-first defaults:

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- `webviewTag: false`
- `webSecurity: true`
- `allowRunningInsecureContent: false`
- custom chrome (`frame: false`, custom title bar)

Mac titlebar buttons are hidden and replaced with custom React controls.

## 6.2 Navigation and External URL Controls

Implemented controls:

- allowlist for in-app navigation
  - dev: only the configured dev origin (`http://localhost:5173` origin)
  - prod: only `file://` URLs under packaged `dist/`
- `setWindowOpenHandler` denies all child windows
- safe external URLs (`https`, `http`, `mailto`) opened via OS shell
- `will-navigate` blocks unexpected in-app navigation
- `will-attach-webview` always blocked

## 6.3 Session and Permission Hardening

Main process configures session security:

- deny all permission requests (`setPermissionRequestHandler`)
- deny permission checks (`setPermissionCheckHandler`)
- deny device permissions (`setDevicePermissionHandler`)
- applies to default and newly created sessions
- session storage/cookies cleared on close and on app shutdown hooks

## 6.4 IPC Trust Boundary

All `ipcMain.handle` registrations use a common `registerIpcHandler` wrapper that:

- resolves sender URL
- verifies sender against allowlisted app origins
- rejects untrusted sender requests with explicit errors

This is the key guardrail preventing arbitrary renderer-origin IPC abuse.

## 6.5 App Lifecycle and Stability

- single-instance lock (`app.requestSingleInstanceLock`)
- second instance focuses existing window
- renderer crash logging (`render-process-gone`)
- `certificate-error` handler rejects invalid certs (`callback(false)`)
- process-level `uncaughtException` and `unhandledRejection` logging

---

## 7. Preload API Surface (`window.electron`)

Preload exposes only explicit functions grouped by capability:

- `electron.shell.openExternal`
- `electron.crypto.*` (keygen, hash, sign/verify, AES/RSA ops, key storage)
- `electron.contractCli.*` (encrypt, stream terminal output, assemble)
- `electron.auditor.*` (auditor key/cert/env/attestation/sign operations)
- `electron.appInfo.getClientToolInfo`
- `electron.file.*` (select/save/read)
- `electron.selectDirectory`
- window controls (`minimizeWindow`, `maximizeWindow`, `closeWindow`)

Renderer code has no direct access to Node built-ins or unrestricted IPC primitives.

---

## 8. IPC Channels (Implemented)

## 8.1 Crypto

- `crypto:generateIdentityKeyPair`
- `crypto:generateAttestationKeyPair`
- `crypto:generateSymmetricKey`
- `crypto:computeFingerprint`
- `crypto:encryptWithSymmetricKey`
- `crypto:decryptWithSymmetricKey`
- `crypto:wrapSymmetricKey`
- `crypto:unwrapSymmetricKey`
- `crypto:hash`
- `crypto:hashFile`
- `crypto:sign`
- `crypto:verify`
- `crypto:storePrivateKey`
- `crypto:getPrivateKey`
- `crypto:deletePrivateKey`
- `crypto:hasPrivateKey`

## 8.2 contract-cli and Auditor

- `contractCli:encryptSection`
- `contractCli:encryptSectionStream`
- `contractCli:assembleContract`
- `auditor:generateSigningKey`
- `auditor:generateSigningCert`
- `auditor:generateAttestationKey`
- `auditor:generateEncryptedEnv`
- `auditor:encryptAttestationPublicKey`
- `auditor:encryptEnvAndAttestation` (compat path)
- `auditor:signContract`

## 8.3 App, Window, File, Shell

- `app:getClientToolInfo`
- `window:minimize`
- `window:maximize`
- `window:close`
- `file:selectFile`
- `file:saveFile`
- `file:readFile`
- `file:selectDirectory`
- `shell:openExternal`

## 8.4 Streaming Event Channels

- `contractCli:terminalLine`
- `auditor:terminalLine`

---

## 9. Renderer Architecture

## 9.1 Root Composition

`main.jsx` renders `App` inside `React.StrictMode`.

`App.jsx` responsibilities:

- boot screen and progress
- auth bootstrap from localStorage/sessionStorage
- role restoration and role switching
- global routing by `activeNav`
- build list preload for authenticated users
- global shell composition with `AppShell`

## 9.2 App Shell and Navigation

`AppShell.jsx` provides:

- top app header
- role-aware side navigation
- user chip with avatar/name/role selector
- logout confirmation modal
- account menu pinned at side-nav bottom

Current nav model:

- Home (all roles)
- Build Management (all roles)
- Diagnostics & Analytics (admin)
- User Management (admin)
- System Logs (admin, auditor)
- Account Settings (all roles)

Role switch menu uses server-provided `user_roles`; current role only can be selected from available assigned roles.

## 9.3 Desktop Title Bar

`DesktopTitleBar.jsx` provides:

- centered branding/title button
- about dialog on title click
- custom minimize/maximize/close controls
- live backend connection status indicator
- measured latency display (ms)
- connection watcher with polling (`15s`) and timeout (`5s`)
- disconnect modal with actions: Retry or Close App

About dialog fetches local client runtime/tool metadata:

- app version + Electron/Chromium/Node/platform
- `contract-cli` install/version
- `OpenSSL` install/version

---

## 10. Role-Based Build Detail Tabs

`BuildDetails.jsx` uses role-driven tab keys.

| Role | Visible Tabs |
| --- | --- |
| ADMIN | Assignments, Audit Trail |
| SOLUTION_PROVIDER | Assignments, Add Workload, Audit Trail |
| DATA_OWNER | Assignments, Add Environment, Audit Trail |
| AUDITOR | Assignments, Sign & Add Attestation, Finalise Contract, Audit Trail |
| ENV_OPERATOR | Assignments, Export Contract, Audit Trail |
| VIEWER | Assignments, Audit Trail |

This ensures each persona only sees relevant stage surfaces while preserving audit visibility.

---

## 11. Build Lifecycle and Stage UX

Current build states:

1. `CREATED`
2. `WORKLOAD_SUBMITTED`
3. `ENVIRONMENT_STAGED`
4. `AUDITOR_KEYS_REGISTERED`
5. `CONTRACT_ASSEMBLED`
6. `FINALIZED`
7. `CONTRACT_DOWNLOADED`
8. `CANCELLED`

Downloaded and cancelled builds are treated as terminal/completed in list and home summaries.

## 11.1 Build Management View

`BuildManagement.jsx`:

- active and completed tables split by terminal status
- pagination on both tables
- admin-only create build modal with mandatory role assignment
- assignment dropdowns are role-driven (users appear when they hold the target workflow role)
- multi-role users can be assigned to multiple workflow personas in the same build
- readiness filtering for assignees (active + setup complete + key registered)

## 11.2 Assignments Tab

`BuildAssignments.jsx`:

- role-sorted assignment table
- assigned timestamps with full date-time formatting (24h)
- status tags per role/stage completion
- admin-only cancel build action (disabled for terminal statuses)

## 11.3 Solution Provider and Data Owner Stage Submission

`SectionSubmit.jsx`:

- file upload for YAML
- editable preview modal with:
  - line numbers
  - tab indentation support
  - scroll-sync line gutter
- builtin or custom HPCR cert support when required
- terminal-style streamed logs for encryption steps

Flow differences:

- **Solution Provider**: contract-cli encryption with HPCR cert
- **Data Owner**: local AES-256-GCM encryption + RSA-OAEP key wrapping using assigned auditor public key

Both flows hash and sign payload before backend submit.

## 11.4 Auditor Stage

`AuditorSection.jsx` is a 4-step guided flow:

1. generate signing key/certificate
2. generate attestation key
3. generate encrypted environment preview
4. confirm sign + add attestation (backend transition)

It supports built-in/custom cert selection and streams command-style output in-terminal.

Session-scoped context is stored in `sessionStorage` and reused by finalization.

## 11.5 Finalize Contract Stage

`FinaliseContract.jsx`:

- assembles workload + environment
- signs via `contract-cli sign-contract`
- injects `attestationPublicKey`
- computes contract hash
- signs hash with auditor identity key
- submits finalize payload to backend
- updates status to `FINALIZED`

## 11.6 Export Contract Stage

`ContractExport.jsx`:

- export and preview final contract
- integrity verification via backend verify endpoint
- "How Verify Works" info modal
- download + acknowledgement path
- once downloaded, re-download is disabled and stage is locked

## 11.7 Audit Trail Stage

`AuditViewer.jsx` includes:

- event timeline and detailed per-event payload/crypto blocks
- hash chain visualization
- backend verify action combining audit + contract checks
- manual verification guide with copyable command snippets
- persona-specific stage verification guide cards

Expected signed event stages include workload, environment, auditor registration, contract assembly, finalization, and download acknowledgment.

---

## 12. Home and Dashboard Behavior

`Home.jsx` provides:

- account overview (password and key status/expiry)
- alert stack (expired password/key, key expiring soon)
- build overview counts:
  - in-progress
  - downloaded
  - cancelled
- role-driven "Build Actions Required" cards from state/action rules
- refresh action for latest build state

Viewer role keeps Home access but without persona action cards.

---

## 13. State Management

## 13.1 Stores

- `authStore`
  - auth token/user/session
  - setup-required model (`password_change`, `public_key_registration`)
  - key/password expiry helpers
- `buildStore`
  - build list + selected build
  - per-build assignments/sections/audit/export/verification caches
- `configStore`
  - server URL and connection metadata
- `rotationStore` and other specialized stores for admin tooling

## 13.2 Persistence

- auth and config store partial persistence via Zustand middleware
- role/session bootstrapping also uses localStorage/sessionStorage in app shell flows

---

## 14. Service Layer Design

## 14.1 API Client

`apiClient.js` centralizes:

- axios instance
- auth header injection
- mutating-request signing via `signatureMiddleware`
- retry behavior for non-mutating requests
- normalized error model
- force logout on non-login `401`

## 14.2 Request Signing

`signatureMiddleware.js` adds:

- `X-Signature`
- `X-Signature-Hash`
- `X-Timestamp`
- `X-Key-Fingerprint`

for mutating API calls except explicit exempt endpoints (`/auth/logout`, password update, public-key registration).

## 14.3 Domain Services

- `authService`: login/logout/password/public key
- `buildService`: build lifecycle and orchestration helpers
- `sectionService`: submission and section validation
- `assignmentService`: role assignment access checks
- `verificationService`: verify endpoints + local verification utilities
- `exportService`: export/save/acknowledge workflow
- `systemLogService`: global system logs

---

## 15. Security Architecture (Current)

## 15.1 Renderer Security

- no Node integration in renderer
- sandboxed renderer with context isolation
- preload allowlist API only

## 15.2 IPC Security

- trusted sender URL verification for every IPC channel
- blocked untrusted sender invocation

## 15.3 Navigation Security

- strict internal URL allowlisting
- blocked window.open/webview abuse vectors
- controlled external link opening through shell allowlist

## 15.4 Session and Permission Security

- global deny for media/device/permission requests
- explicit cert error rejection
- storage cleanup on close/quit hooks

## 15.5 CSP

`index.html` defines CSP through meta tag with:

- `default-src 'self'`
- `object-src 'none'`
- controlled `script-src`, `style-src`, `font-src`, `img-src`, `connect-src`

Note: `frame-ancestors` is intentionally not included in meta CSP because browsers ignore it in meta-delivered CSP.

## 15.6 Key Material Storage

Private keys are encrypted and stored under app user data path.

Current implementation note:

- `keyStorage.js` uses a local machine-derived key strategy
- code comments explicitly note OS keychain integration is preferable for stronger production hardening

---

## 16. UI, Styling, and Consistency Model

## 16.1 Design System

- Carbon components and tokens
- dark theme baseline (`Theme theme="g100"`)
- shared page-shell utility classes in `index.scss`

## 16.2 Global Layout Contracts

- fixed custom desktop title bar (`40px`)
- Carbon header below title bar
- side nav and content offsets calculated from both bars
- consistent `app-page` width and spacing primitives

## 16.3 Timestamp Convention

App formatters force `hour12: false`, resulting in 24-hour timestamps across major views and modals.

## 16.4 Interaction Consistency

- refresh button uses consistent tertiary visual pattern across pages
- destructive actions gated by modals
- role-dependent actions disabled/hidden based on current stage and persona

---

## 17. Login and Server Configuration UX

`Login.jsx` includes:

- credentials form with remember-email option
- server status card
- server config modal
- test connection action with terminal-like log output
- save gated on successful test for the same URL

Server health checks use `/health` with timeout and inline status/tag feedback.

---

## 18. Analytics, User, and Logs Admin Surfaces

## 18.1 Admin Diagnostics & Analytics

- KPI tiles for users/builds/security health
- donut and grouped bar chart analytics
- credential rotation tab integration
- scoped refresh action in overview panel

## 18.2 User Management

- create/edit/deactivate/reactivate users
- multi-role assignment with checkboxes
- overflow action menu for password/key administrative operations
- active/inactive user partitioning

## 18.3 System Logs

- searchable, paginated event table
- status tags
- CSV export
- refresh control

---

## 19. Packaging and Distribution

## 19.1 electron-builder Configuration

- appId: `com.ibm.hpcr.contract-builder`
- `asar: true`
- output: `dist-electron/`
- includes: `dist/**/*`, `main/**/*`, `package.json`

Targets:

- macOS: `dmg`, `zip` (`x64`, `arm64`)
- Windows: `nsis`, `portable`
- Linux: `AppImage`, `deb`, `rpm`

## 19.2 macOS Hardening

- `hardenedRuntime: true`
- entitlements file: `build/entitlements.mac.plist`

Current entitlements include JIT/unsigned-executable-memory/library-validation toggles needed for current runtime profile.

## 19.3 Vite Build Behavior

`vite.config.js` sets `base: './'` to support packaged file-based resource resolution.

---

## 20. Operational Telemetry and Diagnostics

Current diagnostics available in app:

- system logs page (backend-driven)
- stage terminal logs in submission/finalize/auditor flows
- about dialog runtime/tool detection
- live connection health and latency in title bar
- renderer and process-level crash/error logging in main process

---

## 21. Known Gaps and Hardening Backlog

These are code-observed opportunities, not implemented guarantees:

1. Private key storage currently uses app-local encrypted file strategy; migrating to native OS keychain would improve local secret protection.
2. CSP currently allows `'unsafe-inline'` for styles for compatibility; evaluate stricter style policy if feasible.
3. `connect-src` is broad (`http: https: ws: wss:`); production policy can be tightened to configured backend domains.
4. Some legacy/auxiliary service and component code paths exist (for example token manager) that are not central in current screen flow and may need cleanup or explicit productization.

---

## 22. QA and Validation Strategy (Current + Recommended)

## 22.1 Current In-App Validation Patterns

- explicit stage/status guards before action enablement
- terminal logs for long-running cryptographic operations
- modal confirmations for destructive actions
- backend verification endpoints exposed in UI

## 22.2 Recommended Regression Coverage

1. role-switching and nav-visibility matrix
2. full build happy path per persona
3. downloaded-contract lockout behavior
4. session/signature behavior after key rotation
5. disconnected backend behavior from title bar watcher and retry flow
6. package smoke test on macOS/Windows/Linux targets

---

## 23. Appendix: Key Files

- Main process: `app/main/index.js`
- Preload bridge: `app/main/preload.js`
- Root app shell: `app/src/App.jsx`
- Shell and nav: `app/src/components/AppShell.jsx`
- Desktop title bar: `app/src/components/DesktopTitleBar.jsx`
- Build lifecycle views/components: `app/src/views/BuildManagement.jsx`, `app/src/views/BuildDetails.jsx`, `app/src/components/SectionSubmit.jsx`, `app/src/components/AuditorSection.jsx`, `app/src/components/FinaliseContract.jsx`, `app/src/components/ContractExport.jsx`, `app/src/components/AuditViewer.jsx`
- API client/signing: `app/src/services/apiClient.js`, `app/src/services/signatureMiddleware.js`
- Build/package config: `app/package.json`, `app/electron-builder.json`, `app/BUILD.md`
