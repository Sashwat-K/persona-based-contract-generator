# Desktop App Frontend Design Document

## Document Information
- **Project**:IBM Confidential Computing Contract Generator - Desktop Application
- **Version**: 1.0
- **Date**: April 10, 2026
- **Author**: Senior Software Architect
- **Status**: Implementation Complete

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Technology Stack](#technology-stack)
4. [Application Structure](#application-structure)
5. [Security Architecture](#security-architecture)
6. [State Management](#state-management)
7. [Component Design](#component-design)
8. [Cryptographic Operations](#cryptographic-operations)
9. [API Integration](#api-integration)
10. [User Interface Design](#user-interface-design)
11. [Implementation Details](#implementation-details)
12. [Testing Strategy](#testing-strategy)
13. [Deployment](#deployment)
14. [Future Enhancements](#future-enhancements)

---

## 1. Executive Summary

TheIBM Confidential Computing Contract Generator Desktop Application is an Electron-based enterprise application designed for secure contract management with cryptographic operations. The application provides role-based access control, comprehensive audit logging, and client-side cryptography for maximum security.

### Key Features
- **Multi-Role Support**: Solution Provider, Data Owner, Auditor, Environment Operator, Admin, Viewer
- **Client-Side Cryptography**: RSA-4096, AES-256-GCM, SHA-256, RSA-PSS
- **Secure Key Management**: Local encrypted key storage with fingerprint verification
- **Build Management**: Complete contract lifecycle from creation to signing
- **User Management**: Full CRUD operations with role assignment
- **Admin Analytics**: Real-time diagnostics and security monitoring
- **Server Configuration**: Dynamic backend URL configuration with connection testing

---

## 2. Architecture Overview

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Desktop App                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Main Process (Node.js)                    │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  Crypto Operations                               │  │  │
│  │  │  - Key Generation (RSA-4096)                     │  │  │
│  │  │  - Encryption (AES-256-GCM, RSA-OAEP)           │  │  │
│  │  │  - Signing (RSA-PSS, SHA-256)                   │  │  │
│  │  │  - Key Storage (Encrypted Local Storage)        │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  File Operations                                 │  │  │
│  │  │  - Contract File Management                      │  │  │
│  │  │  - Export/Import Operations                      │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  Contract CLI Integration                        │  │  │
│  │  │  - Subprocess Management                         │  │  │
│  │  │  - YAML Processing                               │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
│                            ↕ IPC                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │           Renderer Process (React + Vite)             │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  UI Layer (IBM Carbon Design System)            │  │  │
│  │  │  - Login & Authentication                        │  │  │
│  │  │  - Build Management                              │  │  │
│  │  │  - User Management                               │  │  │
│  │  │  - Admin Analytics                               │  │  │
│  │  │  - Account Settings                              │  │  │
│  │  │  - Server Configuration                          │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  State Management (Zustand)                      │  │  │
│  │  │  - authStore: User session & keys               │  │  │
│  │  │  - buildStore: Contract builds                  │  │  │
│  │  │  - configStore: Server configuration            │  │  │
│  │  │  - uiStore: UI state & notifications            │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  Services Layer                                  │  │  │
│  │  │  - API Client (Axios)                           │  │  │
│  │  │  - Auth Service                                 │  │  │
│  │  │  - Build Service                                │  │  │
│  │  │  - Crypto Service (IPC Bridge)                  │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                            ↕ HTTPS
┌─────────────────────────────────────────────────────────────┐
│                    Backend API (Go)                          │
│  - User Management                                           │
│  - Build Management                                          │
│  - Authentication & Authorization                            │
│  - Audit Logging                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Process Separation

**Main Process (Node.js)**
- Runs with full Node.js capabilities
- Handles all cryptographic operations
- Manages file system access
- Executes contract-cli subprocess
- Provides secure IPC handlers

**Renderer Process (React)**
- Sandboxed browser environment
- Context isolation enabled
- No direct Node.js access
- Communicates via IPC bridge
- Handles all UI rendering

---

## 3. Technology Stack

### 3.1 Core Technologies

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| **Runtime** | Electron | 28.x | Desktop application framework |
| **Frontend** | React | 18.x | UI component library |
| **Build Tool** | Vite | 5.x | Fast development and bundling |
| **UI Framework** | IBM Carbon Design System | 11.x | Enterprise UI components |
| **State Management** | Zustand | 4.x | Lightweight state management |
| **HTTP Client** | Axios | 1.x | API communication |
| **Styling** | SCSS | - | Component styling |
| **Cryptography** | Node.js crypto | - | Native crypto operations |

### 3.2 Development Tools

- **ESLint**: Code quality and consistency
- **Prettier**: Code formatting
- **Electron Builder**: Application packaging
- **React Router**: Client-side routing

---

## 4. Application Structure

### 4.1 Directory Structure

```
app/
├── main/                          # Main Process (Node.js)
│   ├── index.js                   # Main entry point, window management
│   ├── preload.js                 # IPC bridge, context isolation
│   └── crypto/                    # Cryptographic operations
│       ├── keyManager.js          # Key generation, fingerprints
│       ├── encryptor.js           # Encryption operations
│       ├── signer.js              # Signing operations
│       ├── keyStorage.js          # Secure key storage
│       └── contractCli.js         # Contract CLI integration
│
├── src/                           # Renderer Process (React)
│   ├── main.jsx                   # React entry point
│   ├── App.jsx                    # Root component, routing
│   ├── index.scss                 # Global styles
│   │
│   ├── assets/                    # Static assets
│   │   └── CloudHyperProtect.svg  # IBM Cloud Hyper Protect logo
│   │
│   ├── components/                # Reusable components
│   │   ├── AppShell.jsx           # Main layout with navigation
│   │   └── HyperProtectIcon.jsx   # Custom IBM Hyper Protect icon
│   │
│   ├── views/                     # Page components
│   │   ├── Login.jsx              # Authentication with split-screen design
│   │   ├── Home.jsx               # Dashboard with account & build overview
│   │   ├── BuildManagement.jsx    # Contract builds listing
│   │   ├── BuildDetails.jsx       # Build details & signing
│   │   ├── UserManagement.jsx     # User CRUD operations
│   │   ├── AdminAnalytics.jsx     # Admin diagnostics
│   │   ├── AccountSettings.jsx    # User settings & keys
│   │   ├── SystemLogs.jsx         # System audit logs
│   │   └── NotFound.jsx           # 404 error page
│   │
│   ├── store/                     # State management (Zustand)
│   │   ├── authStore.js           # Authentication state
│   │   ├── buildStore.js          # Build state
│   │   ├── configStore.js         # Configuration state
│   │   ├── uiStore.js             # UI state
│   │   ├── themeStore.js          # Theme preferences
│   │   └── mockData.js            # Test data
│   │
│   ├── services/                  # API & business logic
│   │   ├── apiClient.js           # Axios configuration
│   │   ├── authService.js         # Auth operations
│   │   ├── buildService.js        # Build operations
│   │   └── cryptoService.js       # Crypto IPC bridge
│   │
│   ├── styles/                    # Styling
│   │   └── modern-theme.scss      # Custom theme overrides
│   │
│   └── utils/                     # Utility functions
│       ├── constants.js           # App constants
│       ├── formatters.js          # Data formatting
│       ├── validators.js          # Input validation
│       └── cryptoMock.js          # Mock crypto for testing
│
├── index.html                     # HTML template
├── package.json                   # Dependencies & scripts
├── vite.config.js                 # Vite configuration
└── DUMMY_CREDENTIALS.md           # Test credentials
```

### 4.2 Key Files Overview

#### Main Process Files

**`main/index.js`** (450+ lines)
- Window creation and lifecycle management
- 30+ IPC handlers for crypto, file, and contract operations
- Security configuration (CSP, context isolation)
- Menu bar setup

**`main/preload.js`** (150+ lines)
- Secure IPC bridge with contextBridge
- Exposes crypto APIs to renderer
- Type-safe API definitions

**`main/crypto/keyManager.js`** (200+ lines)
- RSA-4096 key pair generation
- SHA-256 fingerprint computation
- PEM format handling
- Key validation

**`main/crypto/encryptor.js`** (180+ lines)
- AES-256-GCM symmetric encryption
- RSA-OAEP key wrapping
- Secure random IV generation
- Base64 encoding

**`main/crypto/signer.js`** (150+ lines)
- SHA-256 hashing
- RSA-PSS signature generation
- Signature verification
- Multi-file signing support

**`main/crypto/keyStorage.js`** (120+ lines)
- Encrypted local key storage
- User-specific key directories
- Secure file permissions
- Key backup and recovery

**`main/crypto/contractCli.js`** (100+ lines)
- Contract CLI subprocess management
- YAML file processing
- Error handling and logging

#### Renderer Process Files

**`src/views/Login.jsx`** (300+ lines)
- Multi-persona login
- Password validation
- Key expiry warnings
- Session initialization

**`src/views/BuildManagement.jsx`** (500+ lines)
- Build list with filtering and sorting
- Create build modal
- Status tracking and updates
- Role-based action buttons

**`src/views/BuildDetails.jsx`** (600+ lines)
- Tabbed workflow per build
- Section submission and status progression
- Assignments management and refresh
- Audit viewer and verification
- Contract export and download acknowledgment

**`src/views/UserManagement.jsx`** (550+ lines)
- User CRUD operations
- Role assignment
- Key and password status tracking
- Force password reset and key rotation

**`src/views/AdminAnalytics.jsx`** (400+ lines)
- System diagnostics cards
- Expired passwords and keys alerts
- Build statistics
- Security monitoring

**`src/views/AccountSettings.jsx`** (450+ lines)
- Profile management
- Password change
- Key generation and registration
- Key rotation workflow

**Build Detail Components (Current)**
- `src/components/SectionSubmit.jsx`
- `src/components/AuditorSection.jsx` (Sign & Add Attestation)
- `src/components/FinaliseContract.jsx`
- `src/components/BuildAssignments.jsx`
- `src/components/AuditViewer.jsx`
- `src/components/ContractExport.jsx`

**`src/views/ServerConfigSettings.jsx`** (350+ lines)
- Server URL configuration
- Connection testing
- HTTPS validation
- Persistent storage

**Service Layer (Current)**
- `apiClient.js` (auth, retries, forced logout on 401)
- `signatureMiddleware.js` (mutating request signing headers)
- `authService.js`, `buildService.js`, `assignmentService.js`, `sectionService.js`
- `verificationService.js`, `exportService.js`, `roleService.js`

---

## 5. Security Architecture

### 5.1 Security Principles

1. **Defense in Depth**: Multiple layers of security controls
2. **Least Privilege**: Minimal permissions for each component
3. **Secure by Default**: Security features enabled by default
4. **Zero Trust**: Verify all operations and inputs

### 5.2 Process Isolation

```
┌─────────────────────────────────────────────────────────┐
│                  Main Process                            │
│  - Full Node.js access                                   │
│  - Crypto operations                                     │
│  - File system access                                    │
│  - Subprocess execution                                  │
└─────────────────────────────────────────────────────────┘
                        ↕ IPC (Secure Channel)
┌─────────────────────────────────────────────────────────┐
│                Renderer Process                          │
│  - Sandboxed environment                                 │
│  - Context isolation enabled                             │
│  - No direct Node.js access                              │
│  - Content Security Policy enforced                      │
└─────────────────────────────────────────────────────────┘
```

### 5.3 Content Security Policy

```javascript
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://localhost:* https://*"
].join('; ');
```

### 5.4 IPC Security

**Secure Communication Pattern**:
```javascript
// Renderer Process (via preload)
const result = await window.electronAPI.crypto.generateKeyPair();

// Preload Bridge (contextBridge)
contextBridge.exposeInMainWorld('electronAPI', {
  crypto: {
    generateKeyPair: () => ipcRenderer.invoke('crypto:generate-keypair')
  }
});

// Main Process Handler
ipcMain.handle('crypto:generate-keypair', async () => {
  // Validate, sanitize, execute
  return await keyManager.generateKeyPair();
});
```

### 5.5 Key Storage Security

**Storage Location**: `~/.hpcr-contract-builder/keys/{userId}/`

**Security Measures**:
- File permissions: 0600 (owner read/write only)
- Encrypted at rest using system keychain
- Separate directories per user
- Automatic backup on rotation

---

## 6. State Management

### 6.1 Zustand Stores

#### authStore
```javascript
{
  // State
  user: {
    id: string,
    email: string,
    name: string,
    roles: Array<{name: string}>,
    public_key_fingerprint: string,
    public_key_expires_at: Date,
    must_change_password: boolean
  },
  token: string,
  roles: Array<{name: string}>,
  isAuthenticated: boolean,
  mustChangePassword: boolean,
  publicKeyExpiry: Date,
  publicKeyFingerprint: string,
  
  // Actions
  setAuth: (user, token) => void,
  clearAuth: () => void,
  updateUser: (updates) => void,
  updatePublicKey: (fingerprint, expiresAt) => void,
  setMustChangePassword: (value) => void,
  
  // Computed
  hasRole: (roleName) => boolean,
  isKeyExpired: () => boolean,
  daysUntilKeyExpiry: () => number
}
```

#### buildStore
```javascript
{
  builds: Build[],
  currentBuild: Build | null,
  filters: {
    status: string[],
    search: string,
    sortBy: string
  },
  
  // Actions
  fetchBuilds: () => Promise<void>,
  createBuild: (data) => Promise<Build>,
  updateBuild: (id, updates) => Promise<void>,
  deleteBuild: (id) => Promise<void>,
  signSection: (buildId, sectionId) => Promise<void>
}
```

#### configStore
```javascript
{
  serverUrl: string,
  theme: 'g100',
  language: 'en',
  
  // Actions
  setServerUrl: (url) => void,
  testConnection: () => Promise<boolean>,
  resetToDefaults: () => void
}
```

#### themeStore
```javascript
{
  theme: 'g100' | 'white',  // 'g100' for dark mode, 'white' for light mode
  
  // Actions
  toggleTheme: () => void,
  setTheme: (theme) => void,
  
  // Computed
  isDarkMode: () => boolean
}
```

#### uiStore
```javascript
{
  notifications: Notification[],
  modals: {
    [key: string]: boolean
  },
  loading: {
    [key: string]: boolean
  },
  
  // Actions
  showNotification: (notification) => void,
  openModal: (key) => void,
  closeModal: (key) => void,
  setLoading: (key, state) => void
}
```

### 6.2 State Persistence

**authStore**: Persisted to localStorage (token and user only)
**configStore**: Persisted to localStorage
**themeStore**: Persisted to localStorage
**buildStore**: Session-only (cleared on logout)
**uiStore**: Session-only

---

## 7. Component Design

### 7.1 Component Hierarchy

```
App (with Boot Screen)
├── Login (Unauthenticated)
│   ├── CustomTitleBar (Window Controls)
│   ├── LoginCard
│   │   ├── HyperProtectIcon
│   │   ├── LoginForm
│   │   └── ServerConfigCard
│   └── InfoPanel
│       ├── Features
│       ├── Links
│       └── VersionInfo
│
└── AppShell (Authenticated)
    ├── CustomTitleBar (Window Controls)
    ├── Header
    │   ├── HyperProtectIcon
    │   ├── HeaderMenuButton
    │   ├── HeaderName
    │   └── HeaderGlobalBar
    │       └── UserInfo (with role icon)
    ├── SideNav (Role-based)
    │   ├── Home (except VIEWER)
    │   ├── Build Management
    │   ├── Admin Operations (conditional)
    │   │   ├── Diagnostics & Analytics
    │   │   ├── User Management
    │   │   └── System Logs
    │   └── Account Menu
    │       ├── Settings
    │       └── Logout
    ├── Content
    │   ├── Home
    │   │   ├── Account Overview
    │   │   │   ├── Account Status
    │   │   │   └── Account & System Alerts
    │   │   └── Build Overview
    │   │       ├── My Builds
    │   │       └── Build Actions Required
    │   ├── BuildManagement
    │   │   ├── BuildList
    │   │   ├── BuildCard
    │   │   ├── CreateBuildModal
    │   │   └── FilterPanel
    │   ├── BuildDetails
    │   │   ├── BuildHeader
    │   │   ├── SectionList
    │   │   ├── SectionCard
    │   │   └── SigningModal
    │   ├── UserManagement
    │   │   ├── UserTable
    │   │   ├── CreateUserModal
    │   │   ├── EditUserModal
    │   │   └── DeleteConfirmModal
    │   ├── AdminAnalytics
    │   │   ├── DiagnosticsCards
    │   │   ├── BuildStatistics
    │   │   └── SecurityAlerts
    │   ├── SystemLogs
    │   │   ├── LogTable
    │   │   ├── SearchFilter
    │   │   └── ExportButton
    │   ├── AccountSettings
    │   │   ├── ProfileSection
    │   │   ├── PasswordSection
    │   │   └── KeyManagementSection
    │   └── NotFound
    │       └── ErrorMessage
    └── Footer
```

### 7.2 Design Patterns

**Container/Presenter Pattern**:
- Views handle data fetching and state
- Components handle presentation only

**Composition over Inheritance**:
- Small, reusable components
- Props for customization

**Controlled Components**:
- Form inputs controlled by React state
- Validation on change and submit

---

## 8. Cryptographic Operations

### 8.1 Key Generation

**Algorithm**: RSA-4096
**Format**: PEM (PKCS#8 for private, SPKI for public)
**Fingerprint**: SHA-256 hash of public key

```javascript
const { publicKey, privateKey } = await crypto.generateKeyPair('rsa', {
  modulusLength: 4096,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

const fingerprint = crypto
  .createHash('sha256')
  .update(publicKey)
  .digest('hex');
```

### 8.2 Encryption

**Symmetric**: AES-256-GCM
**Key Wrapping**: RSA-OAEP with SHA-256

```javascript
// Generate random AES key
const aesKey = crypto.randomBytes(32);
const iv = crypto.randomBytes(16);

// Encrypt data with AES
const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
const encrypted = Buffer.concat([
  cipher.update(data, 'utf8'),
  cipher.final()
]);
const authTag = cipher.getAuthTag();

// Wrap AES key with RSA
const wrappedKey = crypto.publicEncrypt(
  { key: publicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING },
  aesKey
);
```

### 8.3 Signing

**Hash**: SHA-256
**Signature**: RSA-PSS with SHA-256

```javascript
const hashHex = crypto.createHash('sha256').update(data).digest('hex');
const signer = crypto.createSign('RSA-SHA256');
signer.update(hashHex);
signer.end();
const signature = signer.sign({
  key: privateKey,
  padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
  saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST
});
```

### 8.4 Verification

```javascript
const verifier = crypto.createVerify('RSA-SHA256');
verifier.update(hashHex);
verifier.end();
const isValid = verifier.verify(
  { key: publicKey, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST },
  signature
);
```

---

## 9. API Integration

### 9.1 API Client Configuration

```javascript
const apiClient = axios.create({
  baseURL: configStore.getState().serverUrl,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor
apiClient.interceptors.request.use((config) => {
  const token = authStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      authStore.getState().logout();
    }
    return Promise.reject(error);
  }
);
```

### 9.2 API Endpoints

#### Authentication
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout

#### Users
- `GET /users`, `POST /users`, `PATCH /users/{id}`, `PATCH /users/{id}/roles`
- `PUT /users/{id}/public-key`, `GET /users/{id}/public-key`
- `PATCH /users/{id}/password`, `PATCH /users/{id}/reset-password`
- `GET /users/{id}/tokens`, `POST /users/{id}/tokens`, `DELETE /users/{id}/tokens/{token_id}`
- `GET /users/{id}/assignments`

#### Builds & Sections
- `GET /builds`, `POST /builds`, `GET /builds/{id}`
- `PATCH /builds/{id}/status`, `POST /builds/{id}/attestation`, `POST /builds/{id}/finalize`, `POST /builds/{id}/cancel`
- `GET /builds/{id}/assignments`, `POST /builds/{id}/assignments`
- `POST /builds/{id}/sections`, `GET /builds/{id}/sections`

#### Audit / Verification / Export
- `GET /builds/{id}/audit`
- `GET /builds/{id}/verify`, `GET /builds/{id}/verify-contract`
- `GET /builds/{id}/export`, `GET /builds/{id}/userdata`, `POST /builds/{id}/acknowledge-download`

#### Rotation / Logs
- `GET /rotation/expired`, `POST /rotation/force-password-change/{user_id}`, `POST /rotation/revoke-key/{user_id}`
- `GET /system-logs`

---

## 10. User Interface Design

### 10.1 Design System

**IBM Carbon Design System g100 (Dark Theme)**
- Professional enterprise appearance
- Accessibility compliant (WCAG 2.1 AA)
- Consistent component library
- Responsive grid system

### 10.2 Color Palette

```scss
// Primary colors
$primary: #0f62fe;        // IBM Blue 60
$primary-hover: #0353e9;  // IBM Blue 70

// Status colors
$success: #24a148;        // Green 50
$warning: #f1c21b;        // Yellow 30
$error: #da1e28;          // Red 60
$info: #4589ff;           // Blue 50

// Background colors
$background: #161616;     // Gray 100
$surface: #262626;        // Gray 90
$overlay: #393939;        // Gray 80

// Text colors
$text-primary: #f4f4f4;   // Gray 10
$text-secondary: #c6c6c6; // Gray 30
$text-disabled: #8d8d8d;  // Gray 50
```

### 10.3 Typography

```scss
// IBM Plex Sans font family
$font-family: 'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif;

// Type scale
$heading-01: 14px / 18px (600)
$heading-02: 16px / 22px (600)
$heading-03: 20px / 26px (400)
$heading-04: 28px / 36px (400)
$heading-05: 32px / 40px (300)

$body-short-01: 14px / 18px (400)
$body-short-02: 16px / 22px (400)
$body-long-01: 14px / 20px (400)
$body-long-02: 16px / 24px (400)
```

### 10.4 Layout Grid

**16-column grid system**
- Gutter: 32px
- Margin: 16px (mobile), 32px (desktop)
- Breakpoints:
  - Small: 320px - 671px
  - Medium: 672px - 1055px
  - Large: 1056px - 1311px
  - X-Large: 1312px - 1583px
  - Max: 1584px+

### 10.5 Key UI Components

#### Login Screen
- Split-screen layout (login form + feature showcase)
- Email and password inputs
- Remember email checkbox (persisted to localStorage)
- Server configuration inline
- External link handling (opens in system default browser)
- Key expiry warnings
- Password expiry alerts
- Progressive loading animation

#### Build Management
- Data table with sorting and filtering
- Status tags (Draft, In Progress, Completed, etc.)
- Action buttons (View, Edit, Delete)
- Create build modal with user assignment
- Search and filter panel

#### Build Details
- Tabbed interface (Overview, Sections, Signatures, Audit)
- Section cards with status indicators
- Sign button with crypto workflow
- Approval tracking
- Export functionality

#### User Management
- Data table with user information
- Status tags for keys and passwords
- Overflow menu with actions
- Create/Edit user modals
- Role assignment dropdown
- Force password reset and key rotation

#### Admin Analytics
- Grid of diagnostic cards
- Expired passwords alert (red if > 0)
- Expired keys alert
- Build statistics
- Security monitoring

#### Account Settings
- Profile information section
- Password change form
- Key management section
- Key generation and registration
- Key rotation workflow

#### Server Configuration
- URL input with validation
- Connection test button
- HTTPS enforcement
- Save and reset buttons

---

## 11. Implementation Details

### 11.1 Implemented Features

#### ✅ Core Features
1. **Authentication System**
   - Multi-persona login with 6 roles (Admin, Solution Provider, Data Owner, Auditor, Environment Operator, Viewer)
   - Backend-issued bearer token management (localStorage + auth store)
   - Session persistence with session ID tracking
   - Auto-logout on token expiry
   - Forced logout on backend `401` responses
   - Role-based access control
   - Welcome modal on fresh login

2. **Home Dashboard** (NEW)
   - Account Overview section
     - Password status display
     - Public key status with expiry tracking
     - Quick access to account settings
   - Account & System Alerts
     - Critical alerts for expired passwords/keys
     - Warning alerts for expiring keys (< 30 days)
     - Action buttons for immediate remediation
   - Build Overview section
     - My Builds counter and list
     - Build Actions Required with role-specific tasks
     - Quick navigation to specific builds
   - Role-specific default navigation (VIEWER → Builds, others → Home)

3. **Build Management**
   - Create, read, and cancel builds
   - User assignment for all roles (SP, DO, Auditor, EO)
   - Status tracking and updates
   - Section submission workflow via `/builds/{id}/sections`
   - Export/download acknowledgment flow for ENV_OPERATOR
   - Build filtering and search

4. **User Management**
   - Full CRUD operations
   - Role assignment
   - Key status tracking
   - Password status tracking
   - Force password reset
   - Force key rotation (always enabled)

5. **Admin Analytics**
   - System diagnostics
   - Expired passwords card (red alert if > 0)
   - Expired keys card
   - Build statistics
   - Security monitoring

6. **System Logs** (NEW)
   - Comprehensive audit trail
   - System-wide activity logging
   - User authentication events
   - Key management operations
   - Administrative actions
   - Search and filter capabilities
   - CSV export functionality
   - Status-based color coding (SUCCESS/FAILED/WARNING)

7. **Account Settings**
   - Profile management
   - Password change
   - Key generation
   - Key registration
   - Key rotation
   - Key expiry tracking

8. **Server Configuration**
   - Dynamic URL configuration
   - Connection testing
   - HTTPS validation
   - Persistent storage
   - Inline configuration in login screen

#### ✅ UI/UX Features
1. **Custom Window Controls**
   - Frameless window design
   - Custom title bar with IBM branding
   - Minimize, maximize, close buttons
   - Draggable title bar region
   - macOS-style window controls

2. **Boot Screen**
   - Progressive loading animation
   - IBM Confidential Computing branding
   - Smooth transition to login

3. **Login Screen**
   - Split-screen design
   - Left: Login form with server config
   - Right: Feature showcase with links
   - Remember email functionality (localStorage persistence)
   - External link handling (opens in system default browser)
   - HyperProtect icon integration
   - GitHub repository links
   - Documentation links
   - Version information display

4. **Navigation**
   - Role-based side navigation
   - Collapsible menu
   - Active state indicators
   - Icon-based navigation items
   - Account menu at bottom
   - Logout confirmation modal

5. **Theme System**
   - Dark mode (g100) as default
   - Carbon Design System integration
   - Consistent color palette
   - Custom theme overrides

#### ✅ Security Features
1. **Client-Side Cryptography**
   - RSA-4096 key generation (identity & attestation)
   - AES-256-GCM encryption
   - SHA-256 hashing
   - RSA-PSS signing
   - Secure key storage in main process
   - Key wrapping/unwrapping with RSA-OAEP

2. **Process Isolation**
   - Main/Renderer separation
   - Context isolation enabled
   - Sandbox mode enabled
   - IPC security via preload script
   - Content Security Policy

3. **Key Management**
   - Fingerprint computation (SHA-256)
   - Expiry tracking
   - Rotation workflow
   - Secure storage per user ID
   - Key existence checking

4. **Session Management**
   - Session ID tracking
   - Storage cleanup on window close
   - Storage cleanup on app quit
   - Automatic session invalidation

5. **contract-cli Integration**
   - Section encryption with HPCR certificates
   - Contract assembly
   - Temporary file handling with cleanup

#### ✅ Developer Experience
1. **Mock Data System**
   - 10 test users with different roles
   - Complete user profiles
   - Key and password status
   - Build assignments
   - Realistic test scenarios

2. **Utility Functions**
   - Constants management
   - Data formatters
   - Input validators
   - Mock crypto operations

3. **Error Handling**
   - Comprehensive error messages
   - User-friendly notifications
   - IPC error propagation
   - Logging and debugging

4. **File Operations**
   - File selection dialogs
   - Directory selection
   - File save dialogs
   - File reading capabilities

### 11.2 File Statistics

| Category | Files | Lines of Code |
|----------|-------|---------------|
| Main Process | 7 | ~1,500 |
| Views | 9 | ~3,800 |
| Components | 2 | ~450 |
| Stores | 6 | ~950 |
| Services | 4 | ~600 |
| Utils | 4 | ~900 |
| Styles | 2 | ~200 |
| **Total** | **34** | **~8,400** |

### 11.3 Test Credentials

Valid test credentials for development:

**Primary Roles**:
- Admin: `admin@hpcr.local` / `Admin@123456`
- Solution Provider: `solution.provider@hpcr.local` / `SolProv@123456`
- Data Owner: `data.owner@hpcr.local` / `DataOwn@123456`
- Auditor: `auditor@hpcr.local` / `Auditor@123456`
- Environment Operator: `env.operator@hpcr.local` / `EnvOper@123456`
- Viewer: `viewer@hpcr.local` / `Viewer@123456`

**Secondary Users**:
- Solution Provider 2: `sp2@hpcr.local` / `SolProv2@123456`
- Data Owner 2: `do2@hpcr.local` / `DataOwn2@123456`
- Auditor 2: `auditor2@hpcr.local` / `Auditor2@123456`
- Environment Operator 2: `eo2@hpcr.local` / `EnvOper2@123456`

---

## 12. Testing Strategy

### 12.1 Unit Testing

**Framework**: Jest + React Testing Library

**Coverage Areas**:
- Utility functions (validators, formatters)
- Store actions and state updates
- Service layer functions
- Crypto operations

**Example**:
```javascript
describe('validators', () => {
  test('validateEmail accepts valid emails', () => {
    expect(validateEmail('user@example.com')).toBe(true);
  });
  
  test('validateEmail rejects invalid emails', () => {
    expect(validateEmail('invalid')).toBe(false);
  });
});
```

### 12.2 Integration Testing

**Framework**: Playwright

**Coverage Areas**:
- Login flow
- Build creation and management
- User CRUD operations
- Key generation and registration
- Signing workflow

**Example**:
```javascript
test('user can create a build', async ({ page }) => {
  await page.goto('/');
  await page.fill('[name="email"]', 'sp@hpcr.com');
  await page.fill('[name="password"]', 'ServiceProvider@123');
  await page.click('button[type="submit"]');
  
  await page.click('text=Create New Build');
  await page.fill('[name="name"]', 'Test Build');
  await page.click('button:has-text("Create")');
  
  await expect(page.locator('text=Test Build')).toBeVisible();
});
```

### 12.3 E2E Testing

**Manual Testing Checklist**: See `Design/E2E_MANUAL_TESTING.md`

**Automated E2E Tests**:
- Complete user workflows
- Multi-role scenarios
- Error handling
- Security validations

### 12.4 Security Testing

**Areas**:
- IPC communication security
- Crypto operation correctness
- Key storage security
- Input validation
- XSS prevention
- CSRF protection

---

## 13. Deployment

### 13.1 Build Process

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Build for production
npm run build

# Package for distribution
npm run package
```

### 13.2 Distribution

**Electron Builder Configuration**:
```json
{
  "appId": "com.hpcr.contract-builder",
  "productName": "IBM Confidential Computing Contract Generator",
  "directories": {
    "output": "dist"
  },
  "files": [
    "dist-electron/**/*",
    "dist/**/*"
  ],
  "mac": {
    "category": "public.app-category.business",
    "target": ["dmg", "zip"]
  },
  "win": {
    "target": ["nsis", "portable"]
  },
  "linux": {
    "target": ["AppImage", "deb", "rpm"],
    "category": "Office"
  }
}
```

### 13.3 Auto-Update

**Strategy**: Electron's built-in auto-updater

**Update Flow**:
1. Check for updates on app start
2. Download update in background
3. Notify user when ready
4. Install on next restart

---

## 14. Future Enhancements

### 14.1 Planned Features

1. **Offline Mode**
   - Local database (SQLite)
   - Sync when online
   - Conflict resolution

2. **Advanced Search**
   - Full-text search
   - Filters and facets
   - Saved searches

3. **Collaboration**
   - Real-time updates
   - Comments and annotations
   - Activity feed

4. **Reporting**
   - Custom reports
   - Export to PDF/Excel
   - Scheduled reports

5. **Internationalization**
   - Multi-language support
   - Locale-specific formatting
   - RTL support

### 14.2 Performance Optimizations

1. **Code Splitting**
   - Route-based splitting
   - Component lazy loading
   - Dynamic imports

2. **Caching**
   - API response caching
   - Asset caching
   - Service worker

3. **Virtual Scrolling**
   - Large lists
   - Table virtualization
   - Infinite scroll

### 14.3 Accessibility Improvements

1. **Keyboard Navigation**
   - Complete keyboard support
   - Focus management
   - Skip links

2. **Screen Reader Support**
   - ARIA labels
   - Live regions
   - Semantic HTML

3. **High Contrast Mode**
   - Theme variants
   - Color adjustments
   - Icon alternatives

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **HPCR** | Hyper Protect Container Runtime |
| **Build** | A contract instance with sections and signatures |
| **Section** | A part of a contract that requires approval |
| **Persona** | A user role (SP, DO, Auditor, EO, Admin) |
| **Fingerprint** | SHA-256 hash of a public key |
| **Key Rotation** | Process of generating and registering a new key pair |
| **IPC** | Inter-Process Communication between main and renderer |
| **CSP** | Content Security Policy for web security |

---

## Appendix B: References

1. [Electron Documentation](https://www.electronjs.org/docs)
2. [React Documentation](https://react.dev/)
3. [IBM Carbon Design System](https://carbondesignsystem.com/)
4. [Zustand Documentation](https://docs.pmnd.rs/zustand)
5. [Node.js Crypto Module](https://nodejs.org/api/crypto.html)
6. [OWASP Security Guidelines](https://owasp.org/)

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-04-06 | Senior Software Architect | Initial implementation complete |

---

**End of Document**
