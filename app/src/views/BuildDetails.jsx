import React, { useState } from 'react';
import {
  ProgressIndicator,
  ProgressStep,
  Button,
  Grid,
  Column,
  Tile,
  CodeSnippet,
  FileUploader,
  TextInput,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  DataTable,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  Tag,
  Tooltip,
  RadioButtonGroup,
  RadioButton,
  Select,
  SelectItem,
  Modal,
  CopyButton
} from '@carbon/react';
import { Checkmark, FolderOpen, ArrowLeft } from '@carbon/icons-react';
import { PERSONAS, BUILD_STATES } from '../store/mockData';
import { mockCryptoAction } from '../utils/cryptoMock';

// Mock build-specific audit trail - dynamically generated based on build status
const getBuildAuditTrail = (buildId, buildName, buildStatus) => {
  const allEvents = [
    {
      id: '1',
      sequenceNo: 1,
      timestamp: '2024-04-06 10:30:15',
      eventType: 'BUILD_CREATED',
      actorUser: 'admin@hpcr.com',
      actorKeyFingerprint: 'a1b2c3d4...ef56',
      fullFingerprint: 'SHA256:a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6ef56',
      eventHash: '5f4dcc3b5aa765d61d8327deb882cf99',
      previousEventHash: '0000000000000000000000000000000000000000',
      verified: true,
      details: 'Build created with role assignments',
      requiredStatus: 'CREATED'
    },
    {
      id: '2',
      sequenceNo: 2,
      timestamp: '2024-04-06 10:35:42',
      eventType: 'WORKLOAD_SUBMITTED',
      actorUser: 'sp@hpcr.com',
      actorKeyFingerprint: 'b2c3d4e5...fg67',
      fullFingerprint: 'SHA256:b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8fg67',
      eventHash: '098f6bcd4621d373cade4e832627b4f6',
      previousEventHash: '5f4dcc3b5aa765d61d8327deb882cf99',
      verified: true,
      details: 'Workload definition submitted: compose.yaml (2.3 KB), HPCR cert included',
      requiredStatus: 'WORKLOAD_SUBMITTED'
    },
    {
      id: '3',
      sequenceNo: 3,
      timestamp: '2024-04-06 10:40:33',
      eventType: 'ENVIRONMENT_STAGED',
      actorUser: 'do@hpcr.com',
      actorKeyFingerprint: 'c3d4e5f6...gh78',
      fullFingerprint: 'SHA256:c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9gh78',
      eventHash: '5d41402abc4b2a76b9719d911017c592',
      previousEventHash: '098f6bcd4621d373cade4e832627b4f6',
      verified: true,
      details: 'Environment configuration staged: env.yaml (1.8 KB), secrets encrypted',
      requiredStatus: 'ENVIRONMENT_STAGED'
    },
    {
      id: '4',
      sequenceNo: 4,
      timestamp: '2024-04-06 10:45:28',
      eventType: 'AUDITOR_KEYS_REGISTERED',
      actorUser: 'auditor@hpcr.com',
      actorKeyFingerprint: 'd4e5f6g7...hi89',
      fullFingerprint: 'SHA256:d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0hi89',
      eventHash: '7d793037a0760186574b0282f2f435e7',
      previousEventHash: '5d41402abc4b2a76b9719d911017c592',
      verified: true,
      details: 'Auditor public keys registered: RSA-4096 signing and encryption keys',
      requiredStatus: 'AUDITOR_KEYS_REGISTERED'
    },
    {
      id: '5',
      sequenceNo: 5,
      timestamp: '2024-04-06 10:50:15',
      eventType: 'BUILD_FINALIZED',
      actorUser: 'auditor@hpcr.com',
      actorKeyFingerprint: 'd4e5f6g7...hi89',
      fullFingerprint: 'SHA256:d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0hi89',
      eventHash: 'e4d909c290d0fb1ca068ffaddf22cbd0',
      previousEventHash: '7d793037a0760186574b0282f2f435e7',
      verified: true,
      details: 'Contract finalized: Assembled, encrypted (AES-256-GCM), signed (RSA-PSS)',
      requiredStatus: 'FINALIZED'
    }
  ];
  
  // Return only events up to current build status
  const statusOrder = ['CREATED', 'WORKLOAD_SUBMITTED', 'ENVIRONMENT_STAGED', 'AUDITOR_KEYS_REGISTERED', 'FINALIZED'];
  const currentStatusIndex = statusOrder.indexOf(buildStatus);
  
  return allEvents.filter((event, index) => index <= currentStatusIndex);
};

const auditHeaders = [
  { key: 'sequenceNo', header: 'Sequence' },
  { key: 'timestamp', header: 'Timestamp' },
  { key: 'eventType', header: 'Event Type' },
  { key: 'actorUser', header: 'Actor' },
  { key: 'actorKeyFingerprint', header: 'Key Fingerprint' },
  { key: 'verified', header: 'Verified' },
  { key: 'details', header: 'Details' }
];

const getEventTypeTagType = (eventType) => {
  const types = {
    'BUILD_CREATED': 'blue',
    'WORKLOAD_SUBMITTED': 'cyan',
    'ENVIRONMENT_STAGED': 'teal',
    'AUDITOR_KEYS_REGISTERED': 'purple',
    'BUILD_FINALIZED': 'green',
    'BUILD_CANCELLED': 'red',
    'CONTRACT_DOWNLOADED': 'magenta',
    'DOWNLOAD_ACKNOWLEDGED': 'green'
  };
  return types[eventType] || 'gray';
};

const BuildDetails = ({ build, onBack, activePersona, advanceBuildState }) => {
  const [logs, setLogs] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedTab, setSelectedTab] = useState(0);
  const [uploadedWorkload, setUploadedWorkload] = useState(null);
  const [certificateMethod, setCertificateMethod] = useState('upload'); // 'upload' or 'version'
  const [uploadedCertificate, setUploadedCertificate] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedVersion, setSelectedVersion] = useState('');
  const [uploadedEnvFile, setUploadedEnvFile] = useState(null);
  const [showWorkloadTemplateModal, setShowWorkloadTemplateModal] = useState(false);
  const [showEnvTemplateModal, setShowEnvTemplateModal] = useState(false);
  
  // Auditor workflow state
  const [auditorStep, setAuditorStep] = useState(1); // 1: signing key, 2: attestation key, 3: encrypt attestation, 4: finalize
  const [showSigningKeyModal, setShowSigningKeyModal] = useState(false);
  const [showAttestationKeyModal, setShowAttestationKeyModal] = useState(false);
  const [signingKeyGenerated, setSigningKeyGenerated] = useState(false);
  const [attestationKeyGenerated, setAttestationKeyGenerated] = useState(false);
  const [attestationEncrypted, setAttestationEncrypted] = useState(false);
  
  // Signing key/cert form data
  const [signingKeyType, setSigningKeyType] = useState('key'); // 'key' or 'certificate'
  const [signingKeyPath, setSigningKeyPath] = useState('');
  const [signingKeyPassphrase, setSigningKeyPassphrase] = useState('');
  const [certDetails, setCertDetails] = useState({
    country: 'US',
    state: 'California',
    location: 'San Francisco',
    org: 'MyOrg',
    unit: 'Engineering',
    domain: 'example.com',
    mail: 'admin@example.com'
  });
  
  // Attestation key form data
  const [attestationKeyPath, setAttestationKeyPath] = useState('');
  const [attestationKeyPassphrase, setAttestationKeyPassphrase] = useState('');

  // Product versions mapping
  const productVersions = {
    'HPVS': ['2.1.0', '2.1.1', '2.1.2', '2.1.3'],
    'HPCR4RHVS': ['1.3.0', '1.3.1', '1.3.2'],
    'HPCC': ['1.0.0', '1.0.1', '1.1.0']
  };

  const currentStepIndex = BUILD_STATES.indexOf(build.status);
  const buildAuditTrail = getBuildAuditTrail(build.id, build.name, build.status);

  const handleAction = async (actionName, nextState) => {
    setIsProcessing(true);
    setLogs([]);
    await mockCryptoAction(actionName, setLogs);
    advanceBuildState(build.id, nextState);
    setIsProcessing(false);
    setUploadedWorkload(null); // Reset files after submission
    setUploadedCertificate(null);
    setSelectedVersion('');
  };
  
  const isCertificateReady = () => {
    if (certificateMethod === 'upload') {
      return uploadedCertificate !== null;
    } else {
      return selectedProduct !== '' && selectedVersion !== '';
    }
  };

  const handleProductChange = (e) => {
    setSelectedProduct(e.target.value);
    setSelectedVersion(''); // Reset version when product changes
  };
  
  const handleWorkloadChange = (event) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setUploadedWorkload(files[0]);
    }
  };
  
  const handleCertificateChange = (event) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setUploadedCertificate(files[0]);
    }
  };

  const handleEnvFileChange = (event) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setUploadedEnvFile(files[0]);
    }
  };

  const downloadWorkloadTemplate = (type) => {
    const templates = {
      'docker-compose': `version: '3.8'
services:
  app:
    image: your-image:latest
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=production
    volumes:
      - ./data:/app/data`,
      'podman-play': `apiVersion: v1
kind: Pod
metadata:
  name: your-app
spec:
  containers:
  - name: app
    image: your-image:latest
    ports:
    - containerPort: 8080
    env:
    - name: NODE_ENV
      value: production`
    };
    
    const content = templates[type];
    const filename = type === 'docker-compose' ? 'docker-compose.yaml' : 'podman-play.yaml';
    const blob = new Blob([content], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setShowWorkloadTemplateModal(false);
  };

  const downloadEnvTemplate = (type) => {
    const templates = {
      'ibm-cloud-logs': `# IBM Cloud Logs Configuration
LOG_ENDPOINT=https://logs.cloud.ibm.com
LOG_INGESTION_KEY=your-ingestion-key
LOG_LEVEL=info
LOG_FORMAT=json
SERVICE_NAME=your-service`,
      'syslog': `# Syslog Configuration
SYSLOG_HOST=syslog.example.com
SYSLOG_PORT=514
SYSLOG_PROTOCOL=tcp
SYSLOG_FACILITY=local0
LOG_LEVEL=info`
    };
    
    const content = templates[type];
    const filename = type === 'ibm-cloud-logs' ? 'env-ibm-cloud-logs.yaml' : 'env-syslog.yaml';
    const blob = new Blob([content], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setShowEnvTemplateModal(false);
  };

  const handleBrowseDirectory = async (setPathFunction) => {
    try {
      const path = await window.electron.selectDirectory();
      if (path) {
        setPathFunction(path);
      }
    } catch (error) {
      console.error('Directory selection failed:', error);
    }
  };

  const renderPersonaAction = () => {
    if (activePersona === PERSONAS.ADMIN) {
      return (
        <Tile>
          <h4>Admin: Monitoring Build</h4>
          <p style={{ marginTop: '1rem', marginBottom: '1rem', color: 'var(--cds-text-secondary)' }}>
            You have administrative oversight of this build. Monitor progress and intervene if needed.
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--cds-text-secondary)' }}>
            Current status: <strong>{build.status.replace(/_/g, ' ')}</strong>
          </p>
        </Tile>
      );
    }

    if (activePersona === PERSONAS.SOLUTION_PROVIDER) {
      if (build.status === 'CREATED') {
        return (
          <Tile>
            <h4>Solution Provider: Upload Workload & Certificate</h4>
            
            {/* Workload File Upload */}
            <div style={{ marginTop: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>1. Upload Workload File</span>
                <Button
                  size="sm"
                  kind="ghost"
                  onClick={() => setShowWorkloadTemplateModal(true)}
                >
                  Download Template
                </Button>
              </div>
              <FileUploader
                labelTitle=""
                labelDescription="Docker Compose YAML or workload definition (Max 1KB)"
                buttonLabel="Select Workload"
                buttonKind="primary"
                size="md"
                filenameStatus="edit"
                accept={['.yaml', '.yml']}
                onChange={handleWorkloadChange}
              />
              {uploadedWorkload && (
                <p style={{ marginTop: '0.5rem', color: '#42be65', fontSize: '0.875rem' }}>
                  ✓ Selected: {uploadedWorkload.name}
                </p>
              )}
            </div>
            
            {/* Certificate Method Selection */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 600
              }}>
                2. HPCR Encryption Certificate
              </label>
              <RadioButtonGroup
                name="certificate-method"
                valueSelected={certificateMethod}
                onChange={setCertificateMethod}
                orientation="vertical"
              >
                <RadioButton
                  labelText="Upload Certificate File"
                  value="upload"
                  id="cert-upload"
                />
                <RadioButton
                  labelText="Select HPCR Version"
                  value="version"
                  id="cert-version"
                />
              </RadioButtonGroup>
            </div>
            
            {/* Certificate Upload or Version Selection */}
            <div style={{ marginBottom: '1.5rem', marginLeft: '2rem' }}>
              {certificateMethod === 'upload' ? (
                <>
                  <FileUploader
                    labelTitle=""
                    labelDescription="Public encryption certificate from HPCR instance (.crt, .pem, .cert)"
                    buttonLabel="Select Certificate"
                    buttonKind="secondary"
                    size="sm"
                    filenameStatus="edit"
                    accept={['.crt', '.pem', '.cert']}
                    onChange={handleCertificateChange}
                  />
                  {uploadedCertificate && (
                    <p style={{ marginTop: '0.5rem', color: '#42be65', fontSize: '0.875rem' }}>
                      ✓ Selected: {uploadedCertificate.name}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <div style={{ marginBottom: '1rem' }}>
                    <Select
                      id="platform-select"
                      labelText="Select Product"
                      value={selectedProduct}
                      onChange={handleProductChange}
                      helperText="Choose the IBM Confidential Computing platform"
                    >
                      <SelectItem value="" text="Select platform" />
                      <SelectItem value="HPVS" text="HPVS (Hyper Protect Virtual Servers)" />
                      <SelectItem value="HPCR4RHVS" text="HPCR4RHVS (Hyper Protect Container Runtime for Red Hat Virtualization)" />
                      <SelectItem value="HPCC" text="HPCC (Hyper Protect Confidential Computing)" />
                    </Select>
                  </div>
                  
                  {selectedProduct && (
                    <div style={{ marginBottom: '1rem' }}>
                      <Select
                        id="version-select"
                        labelText="Select Version"
                        value={selectedVersion}
                        onChange={(e) => setSelectedVersion(e.target.value)}
                        helperText={`Available versions for ${selectedProduct}`}
                      >
                        <SelectItem value="" text="Select version" />
                        {productVersions[selectedProduct].map(version => (
                          <SelectItem key={version} value={version} text={`Version ${version}`} />
                        ))}
                      </Select>
                    </div>
                  )}
                  
                  {selectedProduct && selectedVersion && (
                    <p style={{ marginTop: '0.5rem', color: '#42be65', fontSize: '0.875rem' }}>
                      ✓ Using default certificate for {selectedProduct} v{selectedVersion}
                    </p>
                  )}
                </>
              )}
            </div>
            
            <Button
              disabled={isProcessing || !uploadedWorkload || !isCertificateReady()}
              onClick={() => handleAction('Encrypt Workload with HPCR Certificate', 'WORKLOAD_SUBMITTED')}
            >
              Encrypt & Submit Workload
            </Button>
            
            {(!uploadedWorkload || !isCertificateReady()) && (
              <p style={{ marginTop: '0.75rem', color: 'var(--cds-text-secondary)', fontSize: '0.75rem', fontStyle: 'italic' }}>
                {!uploadedWorkload ? 'Workload file must be uploaded' :
                 certificateMethod === 'upload' ? 'Certificate file must be uploaded' :
                 'HPCR version must be selected'}
              </p>
            )}
          </Tile>
        );
      } else {
        // Solution Provider viewing builds in other statuses
        return (
          <Tile>
            <h4>Solution Provider: Task Completed</h4>
            <p style={{ marginTop: '1rem', marginBottom: '1rem', color: 'var(--cds-text-secondary)' }}>
              Your workload submission is complete. The build is now in the hands of other team members.
            </p>
            <p style={{ fontSize: '0.875rem', color: 'var(--cds-text-secondary)' }}>
              Current status: <strong>{build.status.replace(/_/g, ' ')}</strong>
            </p>
          </Tile>
        );
      }
    }

    if (activePersona === PERSONAS.DATA_OWNER) {
      if (build.status === 'WORKLOAD_SUBMITTED') {
        return (
          <Tile>
            <h4>Data Owner: Stage Environment Configuration</h4>
            
            {/* Environment File Upload */}
            <div style={{ marginTop: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Upload Environment File</span>
                <Button
                  size="sm"
                  kind="ghost"
                  onClick={() => setShowEnvTemplateModal(true)}
                >
                  Download Template
                </Button>
              </div>
              <FileUploader
                labelTitle=""
                labelDescription="Environment configuration YAML with secrets (will be encrypted locally)"
                buttonLabel="Select Environment File"
                buttonKind="primary"
                size="md"
                filenameStatus="edit"
                accept={['.yaml', '.yml']}
                onChange={handleEnvFileChange}
              />
              {uploadedEnvFile && (
                <p style={{ marginTop: '0.5rem', color: '#42be65', fontSize: '0.875rem' }}>
                  ✓ Selected: {uploadedEnvFile.name}
                </p>
              )}
            </div>
            
            <Button
              disabled={isProcessing || !uploadedEnvFile}
              onClick={() => handleAction('Generate AES, Wrap with RSA, & Sign', 'ENVIRONMENT_STAGED')}
            >
              Encrypt & Stage Environment
            </Button>
            
            {!uploadedEnvFile && (
              <p style={{ marginTop: '0.75rem', color: 'var(--cds-text-secondary)', fontSize: '0.75rem', fontStyle: 'italic' }}>
                Environment file must be uploaded
              </p>
            )}
          </Tile>
        );
      } else {
        // Data Owner viewing builds in other statuses
        return (
          <Tile>
            <h4>Data Owner: Task Completed</h4>
            <p style={{ marginTop: '1rem', marginBottom: '1rem', color: 'var(--cds-text-secondary)' }}>
              Your environment configuration is complete. The build is progressing through the workflow.
            </p>
            <p style={{ fontSize: '0.875rem', color: 'var(--cds-text-secondary)' }}>
              Current status: <strong>{build.status.replace(/_/g, ' ')}</strong>
            </p>
          </Tile>
        );
      }
    }

    if (activePersona === PERSONAS.AUDITOR) {
      if (build.status === 'ENVIRONMENT_STAGED') {
        return (
          <Tile>
            <h4>Auditor: Multi-Step Key Registration & Contract Finalization</h4>
            <p style={{ marginTop: '1rem', marginBottom: '1.5rem', color: 'var(--cds-text-secondary)' }}>
              Complete all steps in sequence to finalize the contract.
            </p>
            
            {/* Step 1: Generate Signing Key/Certificate */}
            <div style={{
              marginBottom: '1.5rem',
              padding: '1rem',
              backgroundColor: auditorStep === 1 ? 'var(--cds-layer-01)' : 'var(--cds-layer-02)',
              border: auditorStep === 1 ? '2px solid var(--cds-border-interactive)' : '1px solid var(--cds-border-subtle)',
              opacity: auditorStep < 1 ? 0.5 : 1
            }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: signingKeyGenerated ? 'var(--cds-support-success)' : 'var(--cds-border-interactive)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: 600
                }}>
                  {signingKeyGenerated ? '✓' : '1'}
                </div>
                <h5 style={{ margin: 0 }}>Generate Signing Key or Certificate</h5>
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--cds-text-secondary)', marginBottom: '1rem', marginLeft: '2rem' }}>
                Generate a signing key or certificate for contract authentication.
              </p>
              {signingKeyGenerated ? (
                <div style={{ marginLeft: '2rem', color: 'var(--cds-support-success)', fontSize: '0.875rem' }}>
                  ✓ Signing key/certificate generated successfully
                </div>
              ) : (
                <Button
                  size="sm"
                  disabled={auditorStep !== 1 || isProcessing}
                  onClick={() => setShowSigningKeyModal(true)}
                  style={{ marginLeft: '2rem' }}
                >
                  Generate Signing Key/Certificate
                </Button>
              )}
            </div>

            {/* Step 2: Generate Attestation Public Key */}
            <div style={{
              marginBottom: '1.5rem',
              padding: '1rem',
              backgroundColor: auditorStep === 2 ? 'var(--cds-layer-01)' : 'var(--cds-layer-02)',
              border: auditorStep === 2 ? '2px solid var(--cds-border-interactive)' : '1px solid var(--cds-border-subtle)',
              opacity: auditorStep < 2 ? 0.5 : 1
            }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: attestationKeyGenerated ? 'var(--cds-support-success)' : 'var(--cds-border-interactive)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: 600
                }}>
                  {attestationKeyGenerated ? '✓' : '2'}
                </div>
                <h5 style={{ margin: 0 }}>Generate Attestation Public Key</h5>
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--cds-text-secondary)', marginBottom: '1rem', marginLeft: '2rem' }}>
                Generate attestation key pair for secure verification.
              </p>
              {attestationKeyGenerated ? (
                <div style={{ marginLeft: '2rem', color: 'var(--cds-support-success)', fontSize: '0.875rem' }}>
                  ✓ Attestation key pair generated successfully
                </div>
              ) : (
                <Button
                  size="sm"
                  disabled={auditorStep !== 2 || isProcessing}
                  onClick={() => setShowAttestationKeyModal(true)}
                  style={{ marginLeft: '2rem' }}
                >
                  Generate Attestation Key
                </Button>
              )}
            </div>

            {/* Step 3: Encrypt Attestation Public Key */}
            <div style={{
              marginBottom: '1.5rem',
              padding: '1rem',
              backgroundColor: auditorStep === 3 ? 'var(--cds-layer-01)' : 'var(--cds-layer-02)',
              border: auditorStep === 3 ? '2px solid var(--cds-border-interactive)' : '1px solid var(--cds-border-subtle)',
              opacity: auditorStep < 3 ? 0.5 : 1
            }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: attestationEncrypted ? 'var(--cds-support-success)' : 'var(--cds-border-interactive)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: 600
                }}>
                  {attestationEncrypted ? '✓' : '3'}
                </div>
                <h5 style={{ margin: 0 }}>Encrypt Attestation Public Key</h5>
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--cds-text-secondary)', marginBottom: '1rem', marginLeft: '2rem' }}>
                Encrypt the attestation public key for secure transmission.
              </p>
              {attestationEncrypted ? (
                <div style={{ marginLeft: '2rem', color: 'var(--cds-support-success)', fontSize: '0.875rem' }}>
                  ✓ Attestation key encrypted successfully
                </div>
              ) : (
                <Button
                  size="sm"
                  disabled={auditorStep !== 3 || isProcessing}
                  onClick={async () => {
                    setIsProcessing(true);
                    setLogs([]);
                    await mockCryptoAction('Encrypt Attestation Public Key', setLogs);
                    setAttestationEncrypted(true);
                    setAuditorStep(4);
                    setIsProcessing(false);
                  }}
                  style={{ marginLeft: '2rem' }}
                >
                  Encrypt Attestation Key
                </Button>
              )}
            </div>

            {/* Step 4: Generate Final Contract */}
            <div style={{
              marginBottom: '1.5rem',
              padding: '1rem',
              backgroundColor: auditorStep === 4 ? 'var(--cds-layer-01)' : 'var(--cds-layer-02)',
              border: auditorStep === 4 ? '2px solid var(--cds-border-interactive)' : '1px solid var(--cds-border-subtle)',
              opacity: auditorStep < 4 ? 0.5 : 1
            }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--cds-border-interactive)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: 600
                }}>
                  4
                </div>
                <h5 style={{ margin: 0 }}>Generate Final Contract</h5>
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--cds-text-secondary)', marginBottom: '1rem', marginLeft: '2rem' }}>
                Assemble all components and generate the final encrypted contract.
              </p>
              <Button
                disabled={auditorStep !== 4 || isProcessing}
                onClick={() => handleAction('Assemble YAML & Sign Final Hash', 'AUDITOR_KEYS_REGISTERED')}
                style={{ marginLeft: '2rem' }}
              >
                Generate Final Contract
              </Button>
            </div>
          </Tile>
        )
      }
      if (build.status === 'AUDITOR_KEYS_REGISTERED') {
         return (
          <Tile>
            <h4>Auditor: Contract Ready for Finalization</h4>
            <p style={{ marginTop: '1rem', marginBottom: '1rem' }}>All keys registered. Click below to finalize the contract.</p>
            <Button
              disabled={isProcessing}
              onClick={() => handleAction('Finalize Contract', 'FINALIZED')}
            >
              Finalize Contract
            </Button>
          </Tile>
         );
      }
      
      // Auditor viewing builds in other statuses
      return (
        <Tile>
          <h4>Auditor: Monitoring Build</h4>
          <p style={{ marginTop: '1rem', marginBottom: '1rem', color: 'var(--cds-text-secondary)' }}>
            {build.status === 'CREATED' && 'Waiting for Solution Provider to submit workload.'}
            {build.status === 'WORKLOAD_SUBMITTED' && 'Waiting for Data Owner to stage environment configuration.'}
            {build.status === 'FINALIZED' && 'Contract has been finalized and is ready for deployment.'}
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--cds-text-secondary)' }}>
            Current status: <strong>{build.status.replace(/_/g, ' ')}</strong>
          </p>
        </Tile>
      );
    }

    if (activePersona === PERSONAS.ENV_OPERATOR) {
      if (build.status === 'FINALIZED') {
        return (
          <Tile>
            <h4>Env Operator: Download & Acknowledge</h4>
            <p style={{ marginTop: '1rem', marginBottom: '1rem' }}>Download the User Data and sign cryptographic proof of receipt.</p>
            <Button
              disabled={isProcessing}
              onClick={async () => {
                setIsProcessing(true);
                setLogs([]);
                await mockCryptoAction('Sign Hash & Generate Receipt', setLogs);
                
                // Open save dialog
                try {
                  const contractContent = `# Encrypted User Data Contract
# Build: ${build.name}
# Generated: ${new Date().toISOString()}

workload:
  encrypted: true
  algorithm: AES-256-GCM
  data: |
    -----BEGIN ENCRYPTED DATA-----
    ${btoa('Sample encrypted workload data for ' + build.name)}
    -----END ENCRYPTED DATA-----

environment:
  encrypted: true
  algorithm: AES-256-GCM
  data: |
    -----BEGIN ENCRYPTED DATA-----
    ${btoa('Sample encrypted environment data for ' + build.name)}
    -----END ENCRYPTED DATA-----

attestation:
  signature: ${btoa('Sample signature')}
  fingerprint: ${btoa('Sample fingerprint')}
`;
                  
                  const savedPath = await window.electron.file.saveFile(
                    `${build.name.replace(/\s+/g, '-')}-contract.yaml`,
                    contractContent
                  );
                  
                  if (savedPath) {
                    setLogs(prev => [...prev, `Contract saved to: ${savedPath}`]);
                  }
                } catch (error) {
                  console.error('Failed to save contract:', error);
                  setLogs(prev => [...prev, `Error: ${error.message}`]);
                }
                
                setIsProcessing(false);
              }}
              kind="tertiary"
            >
              Sign Receipt & Download Contract
            </Button>
          </Tile>
        );
      } else {
        // Env Operator viewing builds in other statuses
        return (
          <Tile>
            <h4>Env Operator: Awaiting Finalization</h4>
            <p style={{ marginTop: '1rem', marginBottom: '1rem', color: 'var(--cds-text-secondary)' }}>
              This build is not yet ready for deployment. Waiting for contract finalization.
            </p>
            <p style={{ fontSize: '0.875rem', color: 'var(--cds-text-secondary)' }}>
              Current status: <strong>{build.status.replace(/_/g, ' ')}</strong>
            </p>
          </Tile>
        );
      }
    }

    // VIEWER persona - read-only view
    if (activePersona === PERSONAS.VIEWER) {
      return (
        <Tile>
          <h4>Viewer: Read-Only Access</h4>
          <p style={{ marginTop: '1rem', marginBottom: '1rem', color: 'var(--cds-text-secondary)' }}>
            You have read-only access to this build. You can view all details and audit trail but cannot perform any actions.
          </p>
          <p style={{ color: 'var(--cds-text-secondary)', fontSize: '0.875rem' }}>
            Current build status: <strong>{build.status.replace(/_/g, ' ')}</strong>
          </p>
        </Tile>
      );
    }

    return (
      <Tile style={{
        backgroundColor: 'var(--cds-layer-01)',
        border: '1px solid var(--cds-border-subtle)'
      }}>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <h4 style={{ marginBottom: '1rem', color: 'var(--cds-text-secondary)' }}>
            No Action Required
          </h4>
          <p style={{ color: 'var(--cds-text-secondary)', fontSize: '0.875rem' }}>
            Waiting for other personas to complete their tasks.
          </p>
          <p style={{ marginTop: '0.5rem', color: 'var(--cds-text-secondary)', fontSize: '0.875rem' }}>
            Current build status: <strong>{build.status.replace(/_/g, ' ')}</strong>
          </p>
          <p style={{ marginTop: '0.5rem', color: 'var(--cds-text-secondary)', fontSize: '0.875rem' }}>
            Your role: <strong>{userRole.replace(/_/g, ' ')}</strong>
          </p>
        </div>
      </Tile>
    );
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <Button kind="ghost" onClick={onBack} style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <ArrowLeft size={16} />
        Back to Dashboard
      </Button>
      
      <h1 style={{ marginBottom: '0.5rem' }}>{build.name}</h1>
      <p style={{ marginBottom: '2rem', color: 'var(--cds-text-secondary)' }}>ID: {build.id}</p>

      <Grid narrow style={{ marginBottom: '2rem' }}>
        <Column lg={16}>
           <ProgressIndicator currentIndex={currentStepIndex} spaceEqually>
              {BUILD_STATES.map((state, index) => (
                <ProgressStep
                   key={state}
                   label={state.replace(/_/g, ' ')}
                   description={`Step ${index + 1}`}
                />
              ))}
           </ProgressIndicator>
        </Column>
      </Grid>

      <Tabs selectedIndex={selectedTab} onChange={({ selectedIndex }) => setSelectedTab(selectedIndex)}>
        <TabList aria-label="Build details tabs">
          <Tab>Overview & Actions</Tab>
          <Tab>Audit Trail</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <Grid narrow style={{ marginTop: '2rem' }}>
              <Column lg={10}>
                 <h3 style={{ marginBottom: '1rem' }}>Persona Action Panel</h3>
                 {renderPersonaAction()}
                 
                 {/* Live Terminal Output - Always visible */}
                 <div style={{ marginTop: '2rem' }}>
                   <Tile style={{
                     backgroundColor: '#161616',
                     padding: '1rem',
                     fontFamily: 'IBM Plex Mono, monospace',
                     minHeight: '200px',
                     maxHeight: '400px',
                     overflowY: 'auto'
                   }}>
                     <div style={{
                       display: 'flex',
                       alignItems: 'center',
                       marginBottom: '0.75rem',
                       paddingBottom: '0.5rem',
                       borderBottom: '1px solid #393939'
                     }}>
                       <h4 style={{
                         fontSize: '0.875rem',
                         fontWeight: 600,
                         color: '#78a9ff',
                         margin: 0
                       }}>
                         Terminal Output
                       </h4>
                       {isProcessing && (
                         <span style={{
                           marginLeft: 'auto',
                           fontSize: '0.75rem',
                           color: '#42be65'
                         }}>
                           ● Processing...
                         </span>
                       )}
                     </div>
                     <div style={{
                       fontSize: '0.75rem',
                       lineHeight: '1.5',
                       color: '#f4f4f4'
                     }}>
                       {logs.length > 0 ? (
                         logs.map((log, index) => (
                           <div key={index} style={{ marginBottom: '0.25rem' }}>
                             <span style={{ color: '#78a9ff' }}>$</span> {log}
                           </div>
                         ))
                       ) : (
                         <div style={{ color: '#8d8d8d', fontStyle: 'italic' }}>
                           Waiting for action... Click a button above to see cryptographic operations.
                         </div>
                       )}
                     </div>
                   </Tile>
                 </div>
              </Column>

              <Column lg={6}>
                 <h3 style={{ marginBottom: '1rem' }}>Build Assignments</h3>
                 <Tile>
                   <ul style={{ listStyle: 'none', padding: 0 }}>
                      <li style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--cds-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong>Admin:</strong> System Admin
                        </div>
                        <Tag type="green" size="sm">✓ Completed</Tag>
                      </li>
                      {Object.entries(build.assignments).map(([role, user]) => {
                        const roleCompleted =
                          (role === 'SOLUTION_PROVIDER' && ['WORKLOAD_SUBMITTED', 'ENVIRONMENT_STAGED', 'AUDITOR_KEYS_REGISTERED', 'FINALIZED'].includes(build.status)) ||
                          (role === 'DATA_OWNER' && ['ENVIRONMENT_STAGED', 'AUDITOR_KEYS_REGISTERED', 'FINALIZED'].includes(build.status)) ||
                          (role === 'AUDITOR' && ['FINALIZED'].includes(build.status)) ||
                          (role === 'ENV_OPERATOR' && build.status === 'FINALIZED');
                        
                        const roleInProgress =
                          (role === 'SOLUTION_PROVIDER' && build.status === 'CREATED') ||
                          (role === 'DATA_OWNER' && build.status === 'WORKLOAD_SUBMITTED') ||
                          (role === 'AUDITOR' && ['ENVIRONMENT_STAGED', 'AUDITOR_KEYS_REGISTERED'].includes(build.status)) ||
                          (role === 'ENV_OPERATOR' && build.status === 'FINALIZED');
                        
                        return (
                          <li key={role} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--cds-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <strong>{role.replace(/_/g, ' ')}:</strong> {user}
                            </div>
                            {roleCompleted ? (
                              <Tag type="green" size="sm">✓ Completed</Tag>
                            ) : roleInProgress ? (
                              <Tag type="blue" size="sm">⟳ In Progress</Tag>
                            ) : (
                              <Tag type="gray" size="sm">⋯ Pending</Tag>
                            )}
                          </li>
                        );
                      })}
                   </ul>
                 </Tile>
              </Column>
            </Grid>
          </TabPanel>
          <TabPanel>
            <div style={{ marginTop: '2rem' }}>
              <h3 style={{ marginBottom: '1rem' }}>Build Audit Trail</h3>
              <p style={{ marginBottom: '1.5rem', color: 'var(--cds-text-secondary)' }}>
                Cryptographic hash chain of all events for this build with signature verification
              </p>
              <DataTable rows={buildAuditTrail} headers={auditHeaders}>
                {({
                  rows,
                  headers,
                  getHeaderProps,
                  getRowProps,
                  getTableProps,
                  getTableContainerProps
                }) => (
                  <TableContainer {...getTableContainerProps()}>
                    <Table {...getTableProps()}>
                      <TableHead>
                        <TableRow>
                          {headers.map((header) => (
                            <TableHeader {...getHeaderProps({ header })} key={header.key}>
                              {header.header}
                            </TableHeader>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {rows.map((row) => {
                          const originalRow = buildAuditTrail.find(r => r.id === row.id);
                          return (
                            <TableRow {...getRowProps({ row })} key={row.id}>
                              {row.cells.map((cell) => (
                                <TableCell key={cell.id}>
                                  {cell.info.header === 'eventType' ? (
                                    <Tag type={getEventTypeTagType(cell.value)}>
                                      {cell.value}
                                    </Tag>
                                  ) : cell.info.header === 'verified' ? (
                                    cell.value ? (
                                      <Tag type="green" renderIcon={Checkmark}>
                                        Verified
                                      </Tag>
                                    ) : (
                                      <Tag type="red">
                                        Failed
                                      </Tag>
                                    )
                                  ) : cell.info.header === 'actorKeyFingerprint' ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      <span>{cell.value}</span>
                                      <CopyButton
                                        feedback="Copied!"
                                        feedbackTimeout={2000}
                                        onClick={() => {
                                          navigator.clipboard.writeText(originalRow?.fullFingerprint || cell.value);
                                        }}
                                      />
                                    </div>
                                  ) : (
                                    cell.value
                                  )}
                                </TableCell>
                              ))}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </DataTable>
            </div>
          </TabPanel>
        </TabPanels>
      </Tabs>

      {/* Workload Template Download Modal */}
      <Modal
        open={showWorkloadTemplateModal}
        modalHeading="Download Workload Template"
        primaryButtonText="Download Docker Compose"
        secondaryButtonText="Download Podman Play"
        onRequestSubmit={() => downloadWorkloadTemplate('docker-compose')}
        onSecondarySubmit={() => downloadWorkloadTemplate('podman-play')}
        onRequestClose={() => setShowWorkloadTemplateModal(false)}
      >
        <p style={{ marginBottom: '1rem' }}>
          Choose the workload template format you want to download:
        </p>
        <ul style={{ marginLeft: '1.5rem', marginBottom: '1rem' }}>
          <li><strong>Docker Compose:</strong> Standard docker-compose.yaml format</li>
          <li><strong>Podman Play:</strong> Kubernetes-compatible pod specification</li>
        </ul>
        <p style={{ fontSize: '0.875rem', color: 'var(--cds-text-secondary)' }}>
          You can customize the template after downloading to match your application requirements.
        </p>
      </Modal>

      {/* Environment Template Download Modal */}
      <Modal
        open={showEnvTemplateModal}
        modalHeading="Download Environment Template"
        primaryButtonText="Download IBM Cloud Logs"
        secondaryButtonText="Download Syslog"
        onRequestSubmit={() => downloadEnvTemplate('ibm-cloud-logs')}
        onSecondarySubmit={() => downloadEnvTemplate('syslog')}
        onRequestClose={() => setShowEnvTemplateModal(false)}
      >
        <p style={{ marginBottom: '1rem' }}>
          Choose the environment configuration template:
        </p>
        <ul style={{ marginLeft: '1.5rem', marginBottom: '1rem' }}>
          <li><strong>IBM Cloud Logs:</strong> Configuration for IBM Cloud Logging service</li>
          <li><strong>Syslog:</strong> Standard syslog configuration</li>
        </ul>
        <p style={{ fontSize: '0.875rem', color: 'var(--cds-text-secondary)' }}>
          Add your secrets and environment variables to the template. They will be encrypted locally before submission.
        </p>
      </Modal>

      {/* Signing Key/Certificate Generation Modal */}
      <Modal
        open={showSigningKeyModal}
        modalHeading="Generate Signing Key or Certificate"
        primaryButtonText="Generate"
        secondaryButtonText="Cancel"
        onRequestSubmit={async () => {
          setIsProcessing(true);
          setLogs([]);
          if (signingKeyType === 'certificate') {
            await mockCryptoAction(`Generate Signing Certificate with details: ${JSON.stringify(certDetails)}`, setLogs);
          } else {
            await mockCryptoAction('Generate Signing Key', setLogs);
          }
          setSigningKeyGenerated(true);
          setAuditorStep(2);
          setShowSigningKeyModal(false);
          setIsProcessing(false);
        }}
        onSecondarySubmit={() => setShowSigningKeyModal(false)}
        onRequestClose={() => setShowSigningKeyModal(false)}
        size="lg"
      >
        <div style={{ marginBottom: '1.5rem' }}>
          <RadioButtonGroup
            legendText="Select Type"
            name="signing-type"
            valueSelected={signingKeyType}
            onChange={setSigningKeyType}
            orientation="horizontal"
          >
            <RadioButton labelText="Signing Key" value="key" id="signing-key" />
            <RadioButton labelText="Signing Certificate" value="certificate" id="signing-cert" />
          </RadioButtonGroup>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <TextInput
                id="signing-key-path"
                labelText="Path to Store Files"
                placeholder="/path/to/store/keys"
                value={signingKeyPath}
                onChange={(e) => setSigningKeyPath(e.target.value)}
                helperText="Directory where signing key/certificate files will be saved"
              />
            </div>
            <Button
              kind="tertiary"
              size="md"
              renderIcon={FolderOpen}
              iconDescription="Browse"
              hasIconOnly
              onClick={() => handleBrowseDirectory(setSigningKeyPath)}
              style={{ marginBottom: '1.5rem' }}
            />
          </div>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <TextInput
            id="signing-key-passphrase"
            type="password"
            labelText="Passphrase for Private Key"
            placeholder="Enter strong passphrase"
            value={signingKeyPassphrase}
            onChange={(e) => setSigningKeyPassphrase(e.target.value)}
            helperText="Used to encrypt the private key"
          />
        </div>

        {signingKeyType === 'certificate' && (
          <div style={{
            padding: '1rem',
            backgroundColor: 'var(--cds-layer-01)',
            marginBottom: '1rem'
          }}>
            <h5 style={{ marginBottom: '1rem' }}>Certificate Details</h5>
            <Grid narrow>
              <Column lg={8} md={4} sm={4}>
                <TextInput
                  id="cert-country"
                  labelText="Country"
                  value={certDetails.country}
                  onChange={(e) => setCertDetails({...certDetails, country: e.target.value})}
                  style={{ marginBottom: '0.5rem' }}
                />
              </Column>
              <Column lg={8} md={4} sm={4}>
                <TextInput
                  id="cert-state"
                  labelText="State"
                  value={certDetails.state}
                  onChange={(e) => setCertDetails({...certDetails, state: e.target.value})}
                  style={{ marginBottom: '0.5rem' }}
                />
              </Column>
              <Column lg={8} md={4} sm={4}>
                <TextInput
                  id="cert-location"
                  labelText="Location"
                  value={certDetails.location}
                  onChange={(e) => setCertDetails({...certDetails, location: e.target.value})}
                  style={{ marginBottom: '0.5rem' }}
                />
              </Column>
              <Column lg={8} md={4} sm={4}>
                <TextInput
                  id="cert-org"
                  labelText="Organization"
                  value={certDetails.org}
                  onChange={(e) => setCertDetails({...certDetails, org: e.target.value})}
                  style={{ marginBottom: '0.5rem' }}
                />
              </Column>
              <Column lg={8} md={4} sm={4}>
                <TextInput
                  id="cert-unit"
                  labelText="Unit"
                  value={certDetails.unit}
                  onChange={(e) => setCertDetails({...certDetails, unit: e.target.value})}
                  style={{ marginBottom: '0.5rem' }}
                />
              </Column>
              <Column lg={8} md={4} sm={4}>
                <TextInput
                  id="cert-domain"
                  labelText="Domain"
                  value={certDetails.domain}
                  onChange={(e) => setCertDetails({...certDetails, domain: e.target.value})}
                  style={{ marginBottom: '0.5rem' }}
                />
              </Column>
              <Column lg={16} md={8} sm={4}>
                <TextInput
                  id="cert-mail"
                  labelText="Email"
                  value={certDetails.mail}
                  onChange={(e) => setCertDetails({...certDetails, mail: e.target.value})}
                />
              </Column>
            </Grid>
          </div>
        )}
      </Modal>

      {/* Attestation Key Generation Modal */}
      <Modal
        open={showAttestationKeyModal}
        modalHeading="Generate Attestation Public Key"
        primaryButtonText="Generate"
        secondaryButtonText="Cancel"
        onRequestSubmit={async () => {
          setIsProcessing(true);
          setLogs([]);
          await mockCryptoAction('Generate Attestation Key Pair', setLogs);
          setAttestationKeyGenerated(true);
          setAuditorStep(3);
          setShowAttestationKeyModal(false);
          setIsProcessing(false);
        }}
        onSecondarySubmit={() => setShowAttestationKeyModal(false)}
        onRequestClose={() => setShowAttestationKeyModal(false)}
      >
        <p style={{ marginBottom: '1.5rem', color: 'var(--cds-text-secondary)' }}>
          Generate an attestation key pair for secure verification of the contract.
        </p>

        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <TextInput
                id="attestation-key-path"
                labelText="Path to Store Files"
                placeholder="/path/to/store/attestation-keys"
                value={attestationKeyPath}
                onChange={(e) => setAttestationKeyPath(e.target.value)}
                helperText="Directory where attestation key files will be saved"
              />
            </div>
            <Button
              kind="tertiary"
              size="md"
              renderIcon={FolderOpen}
              iconDescription="Browse"
              hasIconOnly
              onClick={() => handleBrowseDirectory(setAttestationKeyPath)}
              style={{ marginBottom: '1.5rem' }}
            />
          </div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <TextInput
            id="attestation-key-passphrase"
            type="password"
            labelText="Passphrase for Private Key"
            placeholder="Enter strong passphrase"
            value={attestationKeyPassphrase}
            onChange={(e) => setAttestationKeyPassphrase(e.target.value)}
            helperText="Used to encrypt the attestation private key"
          />
        </div>
      </Modal>
    </div>
  );
};

export default BuildDetails;
