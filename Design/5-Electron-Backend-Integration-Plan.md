# 🔗 Electron App - Backend API Integration Plan

**Document Version:** 1.0  
**Last Updated:** 2026-04-07  
**Status:** Planning Phase  
**Estimated Effort:** 6 weeks (1 senior developer)

---

## 📋 Executive Summary

This document outlines the comprehensive integration plan for connecting the Electron + React + IBM Carbon UI application with the newly implemented backend REST APIs. The integration will add **7 new service modules**, update **4 existing services**, enhance **4 stores**, and create **6 new UI components** to support all backend security features including cryptographic signing, public key management, build assignments, contract export, and credential rotation monitoring.

### **Key Deliverables**
- 11 service modules (7 new, 4 updated)
- 6 state management stores (2 new, 4 enhanced)
- 6 new UI components using IBM Carbon
- 5 updated views
- Comprehensive test suite
- Updated documentation

---

## 🎯 Integration Goals

| Goal | Description | Priority |
|------|-------------|----------|
| **API Coverage** | Connect all 40+ backend REST endpoints | HIGH |
| **Cryptographic Signing** | Implement RSA-4096 signing for all mutating requests | HIGH |
| **Public Key Management** | Add UI and workflows for key registration and rotation | HIGH |
| **Build Assignments** | Integrate two-layer access control system | HIGH |
| **Contract Export** | Add export and verification features | MEDIUM |
| **Credential Rotation** | Implement monitoring and alerting | MEDIUM |
| **API Token Management** | Add token CRUD operations | MEDIUM |
| **Audit Visualization** | Enhanced audit trail display with hash chain | MEDIUM |

---

## 📊 Current State Analysis

### **Existing Architecture** ✅

```
app/
├── main/                          # Electron Main Process
│   ├── index.js                   # Main entry point
│   ├── preload.js                 # IPC bridge
│   └── crypto/                    # Crypto operations
│       ├── contractCli.js         # Contract assembly
│       ├── encryptor.js           # AES-256 encryption
│       ├── keyManager.js          # Key generation
│       ├── keyStorage.js          # Secure storage
│       └── signer.js              # RSA-PSS signing
├── src/                           # React Renderer Process
│   ├── services/                  # API services
│   │   ├── apiClient.js           # ✅ HTTP client
│   │   ├── authService.js         # ⚠️ Needs updates
│   │   ├── buildService.js        # ⚠️ Needs major updates
│   │   └── cryptoService.js       # ✅ Complete
│   ├── store/                     # Zustand stores
│   │   ├── authStore.js           # ⚠️ Needs enhancement
│   │   ├── buildStore.js          # ⚠️ Needs enhancement
│   │   ├── configStore.js         # ✅ Complete
│   │   ├── themeStore.js          # ✅ Complete
│   │   └── uiStore.js             # ✅ Complete
│   ├── components/                # React components
│   │   ├── AppShell.jsx           # ✅ Complete
│   │   └── HyperProtectIcon.jsx   # ✅ Complete
│   └── views/                     # Page views
│       ├── Login.jsx              # ✅ Complete
│       ├── Home.jsx               # ✅ Complete
│       ├── BuildManagement.jsx    # ⚠️ Needs updates
│       ├── BuildDetails.jsx       # ⚠️ Needs updates
│       ├── UserManagement.jsx     # ⚠️ Needs updates
│       ├── AccountSettings.jsx    # ⚠️ Needs updates
│       └── AdminAnalytics.jsx     # ⚠️ Needs updates
```

### **Gaps Identified** ⚠️

| Category | Missing Components | Impact |
|----------|-------------------|--------|
| **Services** | userService, assignmentService, exportService, verificationService, rotationService, tokenService, sectionService | Cannot access new backend features |
| **Stores** | userStore, rotationStore | No state management for new features |
| **Components** | PublicKeyManager, BuildAssignments, ContractExport, AuditViewer, CredentialRotation, APITokenManager | No UI for new features |
| **Middleware** | Signature generation for API requests | Cannot authenticate requests cryptographically |
| **Error Handling** | Assignment errors, signature errors, key expiry errors | Poor UX for new error scenarios |

---

## 🏗️ Integration Architecture

### **System Architecture Diagram**

```
┌─────────────────────────────────────────────────────────────────┐
│                     Electron Main Process                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Crypto Operations (RSA-4096, AES-256, Signing)         │  │
│  │  - Key Generation & Storage                              │  │
│  │  - Signature Generation (RSA-PSS + SHA-256)             │  │
│  │  - Encryption/Decryption (AES-256-GCM)                  │  │
│  │  - Contract Assembly                                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            ↕ IPC                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                    React Renderer Process                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Services Layer (11 modules)                             │  │
│  │  - Core: apiClient, authService, buildService, crypto   │  │
│  │  - New: user, assignment, section, export, verify,      │  │
│  │         rotation, token services                         │  │
│  │  - Middleware: signatureMiddleware                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  State Management (Zustand Stores)                       │  │
│  │  - authStore, buildStore, userStore, rotationStore      │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  UI Components (IBM Carbon)                              │  │
│  │  - 6 new components for security features               │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↕ HTTPS
┌─────────────────────────────────────────────────────────────────┐
│                      Backend REST API                            │
│  - 40+ Endpoints with 7-Layer Security                          │
│  - Rate Limiting, Auth, RBAC, Signatures, Audit Chain          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📅 6-Week Implementation Timeline

### **Week 1: Foundation Services** (Priority: HIGH)

**Deliverables:**
- ✅ Update `authService.js` with public key management
- ✅ Create `userService.js` for admin operations
- ✅ Create `assignmentService.js` for build assignments
- ✅ Create `signatureMiddleware.js` for request signing
- ✅ Enhance `authStore.js` with new state

**Tasks:**

1. **Update authService.js**
   - Add `registerPublicKey(userId, publicKey)`
   - Add `getPublicKey(userId)`
   - Add `checkKeyExpiry()`
   - Add `changePassword(userId, currentPassword, newPassword)`
   - Add `validateSession()`

2. **Create userService.js**
   - Add `listUsers()`
   - Add `createUser(name, email, password, roles)`
   - Add `updateUserRoles(userId, roles)`
   - Add `deactivateUser(userId)`

3. **Create assignmentService.js**
   - Add `createAssignment(buildId, userId, personaRole)`
   - Add `getBuildAssignments(buildId)`
   - Add `getUserAssignments(userId)`
   - Add `deleteAssignment(buildId, userId, personaRole)`
   - Add `validateUserAssignment(buildId, userId, personaRole)`

4. **Create signatureMiddleware.js**
   - Add `signRequest(method, url, data)`
   - Add `signBuildAction(buildId, action, data)`
   - Integrate with `apiClient.js` request interceptor

5. **Enhance authStore.js**
   - Add public key state (fingerprint, expiry)
   - Add API tokens state
   - Add credential expiry warnings

**Testing:**
- Unit tests for all service methods
- Integration tests for key registration flow
- Test signature generation and verification

---

### **Week 2: Core Features** (Priority: HIGH)

**Deliverables:**
- ✅ Update `buildService.js` with 15+ new methods
- ✅ Create `sectionService.js` for section submission
- ✅ Create `exportService.js` for contract export
- ✅ Create `verificationService.js` for audit verification
- ✅ Enhance `buildStore.js` with new state

**Tasks:**

1. **Update buildService.js**
   - Add assignment methods (create, get, delete)
   - Add section methods (submit, get)
   - Add state transition methods (with signatures)
   - Add export methods (export, userdata, acknowledge)
   - Add verification methods (audit chain, contract integrity)

2. **Create sectionService.js**
   - Add `submitSection(buildId, personaRole, plaintext, certContent)`
   - Add `getSections(buildId)`
   - Add `getMySection(buildId, personaRole)`
   - Add `validateSection(section, publicKey)`

3. **Create exportService.js**
   - Add `exportContract(buildId)`
   - Add `getUserData(buildId)`
   - Add `acknowledgeDownload(buildId, downloadedAt, contractHash, privateKey)`
   - Add `saveContractLocally(buildId, contractYaml)`

4. **Create verificationService.js**
   - Add `verifyAuditChain(buildId)`
   - Add `verifyContractIntegrity(buildId)`
   - Add `verifyHashChain(auditEvents, genesisHash)`
   - Add `validateActorSignatures(auditEvents)`

5. **Enhance buildStore.js**
   - Add assignments state per build
   - Add sections state per build
   - Add export data state
   - Add verification results state
   - Add audit events state

**Testing:**
- Test section submission with encryption and signing
- Test export and download acknowledgment
- Test audit chain verification
- Test hash chain validation

---

### **Week 3: Admin Features** (Priority: MEDIUM)

**Deliverables:**
- ✅ Create `rotationService.js` for credential monitoring
- ✅ Create `tokenService.js` for API token management
- ✅ Create `userStore.js` for user management state
- ✅ Create `rotationStore.js` for rotation monitoring state

**Tasks:**

1. **Create rotationService.js**
   - Add `getExpiredCredentials()` (admin only)
   - Add `forcePasswordChange(userId)` (admin only)
   - Add `revokeExpiredKey(userId)` (admin only)
   - Add `checkMyCredentialStatus()` (all users)
   - Add `getExpiryWarnings()` (all users)

2. **Create tokenService.js**
   - Add `listTokens(userId)`
   - Add `createToken(userId, name, expiresInDays)`
   - Add `revokeToken(userId, tokenId)`
   - Add `validateToken(token)`

3. **Create userStore.js**
   - Add users list state
   - Add selected user state
   - Add user filters state
   - Add CRUD actions

4. **Create rotationStore.js**
   - Add expired credentials state
   - Add my credential status state
   - Add warnings state

**Testing:**
- Test credential expiry detection
- Test force password change
- Test token CRUD operations
- Test admin dashboard data

---

### **Week 4: UI Components (Part 1)** (Priority: HIGH)

**Deliverables:**
- ✅ Create `PublicKeyManager.jsx` component
- ✅ Create `BuildAssignments.jsx` component
- ✅ Create `ContractExport.jsx` component

**Tasks:**

1. **PublicKeyManager.jsx**
   - Display current public key fingerprint and expiry
   - Show key generation wizard
   - Handle key registration flow
   - Display expiry warnings
   - IBM Carbon components: `Modal`, `Button`, `InlineNotification`, `ProgressIndicator`

2. **BuildAssignments.jsx**
   - Display assignment table with user/role mapping
   - Add assignment creation dialog
   - Handle assignment deletion
   - Show validation errors
   - IBM Carbon components: `DataTable`, `Modal`, `ComboBox`, `Button`

3. **ContractExport.jsx**
   - Display export button and status
   - Show contract preview
   - Handle download acknowledgment
   - Display verification results
   - IBM Carbon components: `Button`, `Modal`, `CodeSnippet`, `InlineNotification`

**Testing:**
- Test key generation and registration UI
- Test assignment management UI
- Test export and download flow
- Test error handling and validation

---

### **Week 5: UI Components (Part 2)** (Priority: MEDIUM)

**Deliverables:**
- ✅ Create `AuditViewer.jsx` component
- ✅ Create `CredentialRotation.jsx` component
- ✅ Create `APITokenManager.jsx` component

**Tasks:**

1. **AuditViewer.jsx**
   - Display audit events in timeline format
   - Show actor key fingerprints
   - Display hash chain visualization
   - Show verification status
   - IBM Carbon components: `StructuredList`, `Tag`, `Accordion`, `InlineNotification`

2. **CredentialRotation.jsx**
   - Display credential expiry dashboard (admin)
   - Show my credential status (all users)
   - Handle force password change (admin)
   - Display expiry warnings
   - IBM Carbon components: `DataTable`, `Button`, `InlineNotification`, `ProgressIndicator`

3. **APITokenManager.jsx**
   - Display token list
   - Handle token creation
   - Handle token revocation
   - Show token details
   - IBM Carbon components: `DataTable`, `Modal`, `TextInput`, `Button`

**Testing:**
- Test audit trail visualization
- Test credential rotation UI
- Test token management UI
- Test admin vs user permissions

---

### **Week 6: View Updates & Testing** (Priority: HIGH)

**Deliverables:**
- ✅ Update `AccountSettings.jsx` with PublicKeyManager and APITokenManager
- ✅ Update `BuildDetails.jsx` with BuildAssignments, ContractExport, AuditViewer
- ✅ Update `BuildManagement.jsx` with assignment filters
- ✅ Update `UserManagement.jsx` with public key status
- ✅ Update `AdminAnalytics.jsx` with CredentialRotation
- ✅ Comprehensive test suite
- ✅ Documentation updates

**Tasks:**

1. **Update Views**
   - Integrate new components into existing views
   - Add navigation and routing
   - Handle permissions and role-based rendering
   - Add loading states and error handling

2. **Testing**
   - Unit tests for all services (80%+ coverage)
   - Integration tests for key workflows
   - E2E tests for complete user journeys
   - Performance testing for large datasets

3. **Documentation**
   - Update user guide with new features
   - Create developer documentation
   - Document API integration patterns
   - Create troubleshooting guide

**Testing:**
- Test complete user workflows
- Test admin workflows
- Test error scenarios
- Test performance and scalability

---

## 🔐 Security Considerations

### **1. Private Key Security**

**Storage:**
- Private keys stored in Electron's secure storage (OS keychain)
- Never transmitted over network
- Encrypted at rest with user's master password

**Usage:**
- Keys only accessed in main process
- Signatures generated in main process
- Public keys sent to backend for verification

**Rotation:**
- 90-day expiry enforced
- Warning notifications at 7 days before expiry
- Graceful key rotation workflow

### **2. Request Signing**

**Implementation:**
```javascript
// All mutating requests automatically signed
POST /builds/{id}/sections
Headers:
  X-Signature: <RSA-PSS signature of request hash>
  X-Signature-Hash: <SHA-256 hash of request payload>
  X-Timestamp: <Unix timestamp>
  X-Key-Fingerprint: <Public key fingerprint>
```

**Verification:**
- Backend verifies signature using stored public key
- Timestamp checked for replay attack prevention
- Fingerprint matched against user's registered key

### **3. Two-Layer Access Control**

**Layer 1: Role-Based Access Control (RBAC)**
- Admin, Architect, Workload Owner roles
- Enforced at API level

**Layer 2: Build Assignments**
- Explicit user-to-build-to-role mapping
- Required for section submission
- Validated before any build operation

### **4. Audit Trail Integrity**

**Hash Chain:**
- Each event linked to previous via hash
- Genesis hash: `SHA256("IBM_CC:" + buildID)`
- Tamper detection via chain verification

**Actor Attribution:**
- Every event includes actor's public key fingerprint
- Signatures provide non-repudiation
- Complete audit trail of who did what

---

## 🧪 Testing Strategy

### **Unit Tests** (Target: 80%+ coverage)

**Services:**
```javascript
// Example: authService.test.js
describe('AuthService', () => {
  test('registerPublicKey should update store', async () => {
    const result = await authService.registerPublicKey(userId, publicKey);
    expect(result.fingerprint).toBeDefined();
    expect(useAuthStore.getState().publicKeyFingerprint).toBe(result.fingerprint);
  });
  
  test('checkKeyExpiry should detect expired keys', async () => {
    const result = await authService.checkKeyExpiry();
    expect(result.isExpired).toBe(true);
    expect(result.daysUntilExpiry).toBeLessThan(0);
  });
});
```

**Stores:**
```javascript
// Example: authStore.test.js
describe('AuthStore', () => {
  test('setAuth should update authentication state', () => {
    const { setAuth } = useAuthStore.getState();
    setAuth(mockUser, mockToken);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });
});
```

### **Integration Tests**

**Key Workflows:**
```javascript
// Example: keyRegistration.integration.test.js
describe('Key Registration Flow', () => {
  test('complete key registration workflow', async () => {
    // 1. Generate key pair
    const keyPair = await cryptoService.generateIdentityKeyPair();
    
    // 2. Register public key
    const result = await authService.registerPublicKey(userId, keyPair.publicKey);
    
    // 3. Verify fingerprint
    expect(result.fingerprint).toBe(keyPair.fingerprint);
    
    // 4. Check backend storage
    const storedKey = await authService.getPublicKey(userId);
    expect(storedKey.public_key).toBe(keyPair.publicKey);
  });
});
```

### **E2E Tests**

**User Journeys:**
```javascript
// Example: sectionSubmission.e2e.test.js
describe('Section Submission Journey', () => {
  test('user submits section with signature', async () => {
    // 1. Login
    await login(email, password);
    
    // 2. Navigate to build
    await navigateToBuild(buildId);
    
    // 3. Check assignment
    const isAssigned = await assignmentService.validateUserAssignment(
      buildId, userId, 'workload_owner'
    );
    expect(isAssigned).toBe(true);
    
    // 4. Submit section
    await sectionService.submitSection(
      buildId, 'workload_owner', plaintext, certContent
    );
    
    // 5. Verify submission
    const sections = await sectionService.getSections(buildId);
    expect(sections).toHaveLength(1);
    expect(sections[0].persona_role).toBe('workload_owner');
  });
});
```

---

## 📊 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **API Coverage** | 100% of 40+ endpoints | All endpoints integrated |
| **Test Coverage** | 80%+ | Jest coverage report |
| **Performance** | < 200ms API response | Average response time |
| **Error Rate** | < 1% | Error tracking |
| **User Adoption** | 90%+ use new features | Usage analytics |
| **Security** | 0 critical vulnerabilities | Security audit |

---

## 🚨 Risk Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Key Loss** | HIGH | LOW | Backup/recovery workflow, clear documentation |
| **Signature Failures** | MEDIUM | MEDIUM | Comprehensive error handling, retry logic |
| **Performance Issues** | MEDIUM | LOW | Caching, pagination, lazy loading |
| **Breaking Changes** | HIGH | LOW | API versioning, backward compatibility |
| **User Confusion** | MEDIUM | MEDIUM | Clear UI/UX, tooltips, help documentation |

---

## 📚 Implementation Examples

### **Example 1: Section Submission with Signature**

```javascript
// In BuildDetails.jsx
const handleSectionSubmit = async (personaRole, plaintext, certContent) => {
  try {
    setLoading(true);
    
    // 1. Validate assignment
    const user = useAuthStore.getState().user;
    const isAssigned = await assignmentService.validateUserAssignment(
      buildId, user.id, personaRole
    );
    
    if (!isAssigned) {
      throw new Error('You are not assigned to this role');
    }
    
    // 2. Submit section (encryption and signing handled internally)
    const result = await sectionService.submitSection(
      buildId, personaRole, plaintext, certContent
    );
    
    // 3. Show success notification
    showNotification({
      kind: 'success',
      title: 'Section Submitted',
      subtitle: `Section for ${personaRole} submitted successfully`
    });
    
    // 4. Refresh sections
    await buildService.getSections(buildId);
    
  } catch (error) {
    showNotification({
      kind: 'error',
      title: 'Submission Failed',
      subtitle: error.message
    });
  } finally {
    setLoading(false);
  }
};
```

### **Example 2: Public Key Registration**

```javascript
// In PublicKeyManager.jsx
const handleKeyRegistration = async () => {
  try {
    setLoading(true);
    
    // 1. Generate key pair in main process
    const keyPair = await cryptoService.generateIdentityKeyPair();
    
    // 2. Register public key with backend
    const result = await authService.registerPublicKey(
      user.id, keyPair.publicKey
    );
    
    // 3. Update UI
    setKeyFingerprint(result.fingerprint);
    setKeyExpiry(result.expiresAt);
    
    // 4. Show success
    showNotification({
      kind: 'success',
      title: 'Key Registered',
      subtitle: `Fingerprint: ${result.fingerprint.substring(0, 16)}...`
    });
    
  } catch (error) {
    showNotification({
      kind: 'error',
      title: 'Registration Failed',
      subtitle: error.message
    });
  } finally {
    setLoading(false);
  }
};
```

### **Example 3: Audit Chain Verification**

```javascript
// In AuditViewer.jsx
const handleVerifyChain = async () => {
  try {
    setVerifying(true);
    
    // 1. Get audit events
    const events = await buildService.getAuditTrail(buildId);
    
    // 2. Get genesis hash
    const build = useBuildStore.getState().builds[buildId];
    const genesisHash = await cryptoService.hash(`IBM_CC:${buildId}`);
    
    // 3. Verify hash chain
    const chainResult = await verificationService.verifyHashChain(
      events, genesisHash
    );
    
    // 4. Verify signatures
    const signatureResults = await verificationService.validateActorSignatures(events);
    
    // 5. Display results
    setVerificationResult({
      chainValid: chainResult.valid,
      chainErrors: chainResult.errors,
      signatureResults
    });
    
  } catch (error) {
    showNotification({
      kind: 'error',
      title: 'Verification Failed',
      subtitle: error.message
    });
  } finally {
    setVerifying(false);
  }
};
```

---

## 🔄 Deployment Strategy

### **Phase 1: Internal Testing** (Week 1-2)
- Deploy to development environment
- Internal team testing
- Bug fixes and refinements

### **Phase 2: Beta Testing** (Week 3-4)
- Deploy to staging environment
- Selected user beta testing
- Gather feedback and iterate

### **Phase 3: Production Rollout** (Week 5-6)
- Deploy to production
- Monitor metrics and errors
- Provide user support

### **Rollback Plan**
- Feature flags for new functionality
- Database migration rollback scripts
- Quick revert to previous version if needed

---

## 📖 Documentation Updates

### **User Documentation**
1. **Getting Started Guide**
   - Key registration workflow
   - First-time setup

2. **Feature Guides**
   - Build assignments
   - Section submission
   - Contract export
   - Audit verification

3. **Troubleshooting**
   - Common errors
   - Key recovery
   - Signature failures

### **Developer Documentation**
1. **API Integration Guide**
   - Service layer architecture
   - Signature middleware
   - Error handling patterns

2. **Testing Guide**
   - Unit test examples
   - Integration test patterns
   - E2E test scenarios

3. **Security Guide**
   - Key management best practices
   - Signature verification
   - Audit trail integrity

---

## ✅ Acceptance Criteria

### **Functional Requirements**
- ✅ All 40+ backend endpoints integrated
- ✅ Cryptographic signing for all mutating requests
- ✅ Public key registration and rotation
- ✅ Build assignment management
- ✅ Section submission with encryption and signing
- ✅ Contract export and download acknowledgment
- ✅ Audit chain verification
- ✅ Credential rotation monitoring
- ✅ API token management

### **Non-Functional Requirements**
- ✅ 80%+ test coverage
- ✅ < 200ms average API response time
- ✅ < 1% error rate
- ✅ Responsive UI (< 100ms interaction feedback)
- ✅ Accessible (WCAG 2.1 AA compliance)
- ✅ Secure (no critical vulnerabilities)

### **User Experience**
- ✅ Clear error messages
- ✅ Loading states for async operations
- ✅ Success notifications
- ✅ Intuitive navigation
- ✅ Consistent IBM Carbon design

---

## 🎓 Training Plan

### **Developer Training** (2 days)
1. **Day 1: Architecture & Services**
   - Service layer overview
   - Signature middleware
   - Store management
   - Testing patterns

2. **Day 2: UI Components & Integration**
   - IBM Carbon components
   - View integration
   - Error handling
   - Debugging techniques

### **User Training** (1 day)
1. **Morning: Core Features**
   - Key registration
   - Build assignments
   - Section submission

2. **Afternoon: Advanced Features**
   - Contract export
   - Audit verification
   - Credential management

---

## 📞 Support Plan

### **Development Support**
- Dedicated Slack channel
- Weekly sync meetings
- Code review process
- Pair programming sessions

### **User Support**
- Help documentation
- Video tutorials
- Email support
- In-app help tooltips

---

## 🎯 Conclusion

This integration plan provides a comprehensive roadmap for connecting the Electron app to all backend APIs. The phased approach ensures:

1. **Security First**: Cryptographic signing and key management from day one
2. **Incremental Delivery**: Each phase delivers working features
3. **Testability**: Clear testing strategy at each phase
4. **Maintainability**: Clean service layer and state management
5. **User Experience**: IBM Carbon UI components for consistency

**Estimated Timeline:** 6 weeks  
**Risk Level:** Medium (well-defined APIs, existing crypto infrastructure)  
**Dependencies:** Backend APIs (✅ Complete), Electron crypto (✅ Complete)

---

## 📋 Appendix

### **A. API Endpoint Mapping**

| Category | Endpoints | Service | Priority |
|----------|-----------|---------|----------|
| **Auth** | POST /auth/login, POST /auth/logout | authService | HIGH |
| **Users** | GET /users, POST /users, PATCH /users/{id}/roles | userService | HIGH |
| **Public Keys** | PUT /users/{id}/public-key, GET /users/{id}/public-key | authService | HIGH |
| **Assignments** | POST /builds/{id}/assignments, GET /builds/{id}/assignments | assignmentService | HIGH |
| **Sections** | POST /builds/{id}/sections, GET /builds/{id}/sections | sectionService | HIGH |
| **Export** | GET /builds/{id}/export, POST /builds/{id}/acknowledge-download | exportService | MEDIUM |
| **Verification** | GET /builds/{id}/verify, GET /builds/{id}/verify-contract | verificationService | MEDIUM |
| **Rotation** | GET /rotation/expired, POST /rotation/force-password-change/{id} | rotationService | MEDIUM |
| **Tokens** | GET /users/{id}/tokens, POST /users/{id}/tokens | tokenService | MEDIUM |

### **B. Component Hierarchy**

```
AccountSettings.jsx
├── PublicKeyManager.jsx
└── APITokenManager.jsx

BuildDetails.jsx
├── BuildAssignments.jsx
├── ContractExport.jsx
└── AuditViewer.jsx

AdminAnalytics.jsx
└── CredentialRotation.jsx
```

### **C. Store Dependencies**

```
authStore
├── Used by: authService, userService, tokenService
└── Depends on: cryptoService

buildStore
├── Used by: buildService, assignmentService, sectionService
└── Depends on: authStore

userStore
├── Used by: userService
└── Depends on: authStore

rotationStore
├── Used by: rotationService
└── Depends on: authStore, userStore
```

---

**Document End**
