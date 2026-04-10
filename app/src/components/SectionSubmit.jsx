import React, { useState, useEffect, useRef } from 'react';
import {
  Button,
  InlineNotification,
  Tag,
  Tile,
  RadioButtonGroup,
  RadioButton,
  Select,
  SelectItem,
  FileUploader,
  Modal,
  CodeSnippet,
} from '@carbon/react';
import { Upload, CheckmarkFilled, Terminal, Document, View, Download } from '@carbon/icons-react';
import sectionService from '../services/sectionService';
import buildService from '../services/buildService';
import assignmentService from '../services/assignmentService';
import cryptoService from '../services/cryptoService';
import { PLATFORMS, getCertsByPlatform, getCertById } from '../data/builtinCerts';
import AuditorSection from './AuditorSection';

// ── Workload templates ────────────────────────────────────────────────────────

const WORKLOAD_TEMPLATES = {
  docker_compose: {
    label: 'Docker Compose',
    content: `workload:
  compose:
    archive: ""
  images:
    - name: ""
      platforms:
        - s390x
  type: compose
`,
  },
  podman_play: {
    label: 'Podman Play',
    content: `workload:
  play:
    archive: ""
  images:
    - name: ""
      platforms:
        - s390x
  type: play
`,
  },
};

// ── Environment templates ─────────────────────────────────────────────────────

const ENV_TEMPLATES = {
  syslog: {
    label: 'Syslog',
    content: `env:
  type: env
  logging:
    syslog:
      hostname: ""
      port: 514
      facility: 1
      tag: ""
`,
  },
  ibm_cloud_logs: {
    label: 'IBM Cloud Logs',
    content: `env:
  type: env
  logging:
    logDNA:
      ingestionKey: ""
      hostname: ""
      port: 6514
      tag: ""
`,
  },
};

// ── Role config ───────────────────────────────────────────────────────────────

const ROLE_CONFIG = {
  SOLUTION_PROVIDER: {
    title: 'Encrypted Workload',
    description: 'Upload your workload YAML file and select an encryption certificate to encrypt and submit the workload section.',
    requiredBuildStatus: 'CREATED',
    needsCert: true,
    templates: WORKLOAD_TEMPLATES,
    fileLabel: 'workload',
  },
  DATA_OWNER: {
    title: 'Add Environment',
    description: 'Upload your environment YAML file and submit the environment section.',
    requiredBuildStatus: 'WORKLOAD_SUBMITTED',
    needsCert: false,
    templates: ENV_TEMPLATES,
    fileLabel: 'environment',
  },
  AUDITOR: {
    title: 'Sign & Add Attestation',
    description: 'Upload your attestation YAML file and select an encryption certificate to encrypt and submit the attestation section.',
    requiredBuildStatus: 'ENVIRONMENT_STAGED',
    needsCert: true,
    templates: null,
    fileLabel: 'attestation',
  },
};

// ── Terminal colours — always light-on-dark, no CSS variables ────────────────

const TC = {
  cmd:     '#78a9ff',  // bright blue — the command line
  info:    '#a8a8a8',
  stdout:  '#f4f4f4',
  stderr:  '#f1c21b',
  success: '#42be65',
  result:  '#42be65',  // final encrypted output
  error:   '#fa4d56',
  muted:   '#6f6f6f',
};

// ─────────────────────────────────────────────────────────────────────────────

const SectionSubmit = ({ buildId, buildStatus: buildStatusProp, personaRole, onStatusUpdate }) => {
  const config = ROLE_CONFIG[personaRole];

  // Workload file
  const [workloadContent, setWorkloadContent] = useState('');
  const [workloadFileName, setWorkloadFileName] = useState('');

  // Certificate source: 'builtin' | 'custom'
  const [certSource, setCertSource] = useState('custom');
  const [selectedPlatformId, setSelectedPlatformId] = useState(PLATFORMS[0].id);
  const [selectedCertId, setSelectedCertId] = useState('');
  const [customCertContent, setCustomCertContent] = useState('');
  const [customCertFileName, setCustomCertFileName] = useState('');

  // Terminal / encryption
  const [terminalLines, setTerminalLines] = useState([]);
  const [encrypting, setEncrypting] = useState(false);
  const [encryptedResult, setEncryptedResult] = useState(null);
  const [wrappedSymmetricKey, setWrappedSymmetricKey] = useState(null);
  const terminalRef = useRef(null);
  const topRef = useRef(null);

  // Preview modal
  const [showPreview, setShowPreview] = useState(false);

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [existingSection, setExistingSection] = useState(null);
  const [loadingSection, setLoadingSection] = useState(true);
  const [liveStatus, setLiveStatus] = useState(buildStatusProp);

  // Sync live status when prop changes (parent updated)
  useEffect(() => { setLiveStatus(buildStatusProp); }, [buildStatusProp]);

  // Set default cert when platform changes
  useEffect(() => {
    const certs = getCertsByPlatform(selectedPlatformId);
    setSelectedCertId(certs.length > 0 ? certs[0].id : '');
  }, [selectedPlatformId]);

  useEffect(() => {
    loadExistingSection();
    // Fetch live build status in case the prop is stale
    buildService.getBuild(buildId)
      .then(b => { if (b?.status) setLiveStatus(b.status); })
      .catch(() => {});
    return () => { window.electron?.contractCli?.offTerminalLine?.(); };
  }, [buildId, personaRole]);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLines]);

  const loadExistingSection = async () => {
    try {
      setLoadingSection(true);
      const section = await sectionService.getSection(buildId, personaRole);
      setExistingSection(section);
    } catch (_) { /* no section yet */ } finally {
      setLoadingSection(false);
    }
  };

  const handleWorkloadUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setWorkloadFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setWorkloadContent(ev.target.result);
    reader.readAsText(file);
  };

  const handleCustomCertUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCustomCertFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setCustomCertContent(ev.target.result);
    reader.readAsText(file);
  };

  const downloadTemplate = (key) => {
    const tpl = config.templates?.[key];
    if (!tpl) return;
    const blob = new Blob([tpl.content], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.fileLabel}-template-${key}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getActiveCertContent = () => {
    if (certSource === 'custom') return customCertContent;
    return getCertById(selectedCertId)?.cert || '';
  };

  const addLine = (type, line) =>
    setTerminalLines(prev => [...prev, { type, line }]);

  const handleEncrypt = async () => {
    if (!workloadContent) { setError(`Please upload a ${config.fileLabel} YAML file.`); return; }

    if (config.needsCert) {
      const certContent = getActiveCertContent();
      if (!certContent || certContent.includes('PASTE_')) {
        setError('Please select or upload a valid encryption certificate.'); return;
      }

      setEncrypting(true);
      setEncryptedResult(null);
      setTerminalLines([]);
      setError(null);

      window.electron?.contractCli?.offTerminalLine?.();
      window.electron?.contractCli?.onTerminalLine?.((data) => addLine(data.type, data.line));

      try {
        const result = await window.electron.contractCli.encryptSectionStream(workloadContent, certContent);
        setEncryptedResult(result);
      } catch (err) {
        setError(`Encryption failed: ${err.message}`);
      } finally {
        setEncrypting(false);
        window.electron?.contractCli?.offTerminalLine?.();
      }
    } else {
      // DATA_OWNER: AES-256-GCM encrypt env, wrap AES key with Auditor's RSA public key
      setEncrypting(true);
      setEncryptedResult(null);
      setWrappedSymmetricKey(null);
      setTerminalLines([]);
      setError(null);

      try {
        // Step 1 — fetch Auditor's public key
        addLine('cmd', '$ GET /builds/' + buildId + '/assignments  ->  find AUDITOR user_id');
        const auditorPublicKey = await assignmentService.getAuditorPublicKey(buildId);
        addLine('cmd', '$ GET /users/{auditor_id}/public-key');
        // Show first 60 chars of PEM header so the user can confirm it loaded
        addLine('stdout', auditorPublicKey.split('\n').slice(0, 2).join(' '));
        addLine('success', 'Auditor RSA-4096 public key retrieved.');

        // Step 2 — generate AES-256 symmetric key
        addLine('cmd', '$ node:crypto  generateSymmetricKey()  ->  AES-256 (32 bytes)');
        const symKeyBase64 = await cryptoService.generateSymmetricKey();
        addLine('stdout', 'key (base64, first 16 chars): ' + symKeyBase64.substring(0, 16) + '...');
        addLine('success', 'AES-256 symmetric key generated.');

        // Step 3 — AES-256-GCM encrypt the env section
        addLine('cmd', '$ node:crypto  createCipheriv("aes-256-gcm", key, iv)  ->  encrypt env YAML');
        addLine('stdout', 'input: ' + workloadContent.length + ' bytes');
        const encryptedObj = await cryptoService.encryptWithSymmetricKey(workloadContent, symKeyBase64);
        const encryptedPayload = JSON.stringify(encryptedObj);
        addLine('stdout', 'iv (base64):      ' + encryptedObj.iv);
        addLine('stdout', 'authTag (base64): ' + encryptedObj.authTag);
        addLine('stdout', 'ciphertext size:  ' + encryptedObj.encrypted?.length + ' chars (base64)');
        addLine('success', 'Environment YAML encrypted with AES-256-GCM.');

        // Step 4 — RSA-OAEP wrap the AES key
        addLine('cmd', '$ node:crypto  publicEncrypt({ key, oaepHash: "sha256" }, aesKey)  ->  RSA-OAEP wrap');
        const wrapped = await cryptoService.wrapSymmetricKey(symKeyBase64, auditorPublicKey);
        addLine('stdout', 'wrapped key (base64, first 32 chars): ' + wrapped.substring(0, 32) + '...');
        addLine('success', 'AES key wrapped with Auditor RSA-4096 public key (RSA-OAEP / SHA-256).');

        addLine('result', 'All operations complete. Environment section ready to submit.');
        setEncryptedResult(encryptedPayload);
        setWrappedSymmetricKey(wrapped);
      } catch (err) {
        addLine('error', 'Error: ' + err.message);
        setError(`Encryption failed: ${err.message}`);
      } finally {
        setEncrypting(false);
      }
    }
  };

  const handleSubmit = async () => {
    if (!encryptedResult) { setError('Please encrypt the section first.'); return; }
    setSubmitting(true);
    setError(null);
    try {
      await sectionService.submitEncryptedSection(buildId, personaRole, encryptedResult, wrappedSymmetricKey);
      setEncryptedResult(null);
      setWrappedSymmetricKey(null);
      setTerminalLines([]);
      await loadExistingSection();
      // Fetch updated build status and notify parent + update local state
      const updatedBuild = await buildService.getBuild(buildId);
      if (updatedBuild?.status) setLiveStatus(updatedBuild.status);
      onStatusUpdate?.(updatedBuild.status);
      setSuccess('Section submitted successfully.');
    } catch (err) {
      setError(`Submission failed: ${err.message}`);
    } finally {
      setSubmitting(false);
      topRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  if (!config) return null;

  // AUDITOR has its own dedicated component
  if (personaRole === 'AUDITOR') {
    return (
      <AuditorSection
        buildId={buildId}
        buildStatus={liveStatus}
        onStatusUpdate={onStatusUpdate}
      />
    );
  }

  const isCorrectStatus = liveStatus === config.requiredBuildStatus;
  const certOptions = getCertsByPlatform(selectedPlatformId);
  const isDisabled = !isCorrectStatus || !!existingSection;

  return (
    <div ref={topRef}>
      <h3 style={{ marginBottom: '0.5rem' }}>{config.title}</h3>
      <p style={{ color: 'var(--cds-text-secondary)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
        {config.description}
      </p>

      {error && (
        <InlineNotification kind="error" title="Error" subtitle={error}
          onCloseButtonClick={() => setError(null)} lowContrast style={{ marginBottom: '1rem' }} />
      )}
      {success && (
        <InlineNotification kind="success" title="Success" subtitle={success}
          onCloseButtonClick={() => setSuccess(null)} lowContrast style={{ marginBottom: '1rem' }} />
      )}

      {!loadingSection && existingSection && (
        <Tile style={{ marginBottom: '1.5rem', padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <CheckmarkFilled size={20} style={{ color: 'var(--cds-support-success)' }} />
            <div>
              <strong>Section already submitted</strong>
              <div style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary)', marginTop: '0.25rem' }}>
                Submitted at: {existingSection.submitted_at
                  ? new Date(existingSection.submitted_at).toLocaleString() : 'N/A'}
              </div>
            </div>
            <Tag type="green" style={{ marginLeft: 'auto' }}>Submitted</Tag>
          </div>
        </Tile>
      )}

      {!isCorrectStatus && !existingSection && (
        <InlineNotification kind="info" title="Not yet available"
          subtitle={`This section requires build status "${config.requiredBuildStatus}". Current: ${liveStatus}.`}
          lowContrast hideCloseButton style={{ marginBottom: '1rem' }} />
      )}

      <div style={{
        display: 'flex', flexDirection: 'column', gap: '2rem',
        opacity: isDisabled ? 0.6 : 1,
        pointerEvents: isDisabled ? 'none' : 'auto',
      }}>

        {/* ── Step 1: Upload YAML ───────────────────────────────────────── */}
        <div>
          <h4 style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Document size={18} /> Step 1 — Upload {config.fileLabel.charAt(0).toUpperCase() + config.fileLabel.slice(1)} YAML
          </h4>

          {/* Template buttons — shown when templates are configured */}
          {config.templates && (
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--cds-text-secondary)' }}>
                Download template:
              </span>
              {Object.entries(config.templates).map(([key, tpl]) => (
                <Button
                  key={key}
                  kind="ghost"
                  size="sm"
                  renderIcon={Download}
                  onClick={() => downloadTemplate(key)}
                >
                  {tpl.label}
                </Button>
              ))}
            </div>
          )}

          <FileUploader
            labelDescription={`Upload ${config.fileLabel} YAML file (.yaml / .yml)`}
            buttonLabel="Choose file"
            filenameStatus="edit"
            accept={['.yaml', '.yml']}
            onChange={handleWorkloadUpload}
          />
          {workloadContent && (
            <p style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary)', marginTop: '0.5rem' }}>
              {workloadFileName} — {workloadContent.length} bytes loaded
            </p>
          )}
        </div>

        {/* ── Step 2: Certificate (only when encryption is needed) ─────── */}
        {config.needsCert && (
          <div>
            <h4 style={{ marginBottom: '0.75rem' }}>Step 2 — HPCR Encryption Certificate</h4>

            <RadioButtonGroup
              name={`cert-source-${personaRole}`}
              valueSelected={certSource}
              onChange={(val) => { setCertSource(val); setEncryptedResult(null); }}
              style={{ marginBottom: '1rem' }}
            >
              <RadioButton labelText="Upload custom certificate" value="custom" id={`cert-custom-${personaRole}`} />
              <RadioButton labelText="Use built-in certificate" value="builtin" id={`cert-builtin-${personaRole}`} />
            </RadioButtonGroup>

            {certSource === 'builtin' ? (
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <Select
                  id={`cert-platform-${personaRole}`}
                  labelText="Platform"
                  value={selectedPlatformId}
                  onChange={(e) => { setSelectedPlatformId(e.target.value); setEncryptedResult(null); }}
                  style={{ minWidth: '420px' }}
                >
                  {PLATFORMS.map(p => (
                    <SelectItem key={p.id} value={p.id} text={p.label} />
                  ))}
                </Select>

                <Select
                  id={`cert-version-${personaRole}`}
                  labelText="Version"
                  value={selectedCertId}
                  onChange={(e) => { setSelectedCertId(e.target.value); setEncryptedResult(null); }}
                  style={{ minWidth: '140px' }}
                >
                  {certOptions.map(c => (
                    <SelectItem key={c.id} value={c.id} text={c.version} />
                  ))}
                </Select>
              </div>
            ) : (
              <div>
                <FileUploader
                  labelDescription="Upload certificate (.crt / .pem)"
                  buttonLabel="Choose file"
                  filenameStatus="edit"
                  accept={['.crt', '.pem', '.cer']}
                  onChange={handleCustomCertUpload}
                />
                {customCertFileName && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary)', marginTop: '0.5rem' }}>
                    {customCertFileName} loaded
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Step 2/3: Encrypt ─────────────────────────────────────────── */}
        <div>
          <h4 style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Terminal size={18} /> Step {config.needsCert ? 3 : 2} — {config.needsCert ? 'Encrypt' : 'Prepare'}
          </h4>

          <Button
            kind="secondary"
            renderIcon={Terminal}
            onClick={handleEncrypt}
            disabled={encrypting || !workloadContent}
            style={{ marginBottom: '1rem' }}
          >
            {encrypting ? 'Processing...' : config.needsCert ? 'Run Encryption' : 'Prepare Section'}
          </Button>

          {/* Terminal */}
          <div
            ref={terminalRef}
            style={{
              background: '#161616',
              borderRadius: '4px',
              padding: '1rem',
              fontFamily: '"IBM Plex Mono", "Courier New", monospace',
              fontSize: '0.8125rem',
              lineHeight: '1.7',
              minHeight: '160px',
              maxHeight: '320px',
              overflowY: 'auto',
              border: '1px solid #393939',
              color: TC.stdout,
            }}
          >
            {terminalLines.length === 0 ? (
              <span style={{ color: TC.muted }}>
                Terminal output will appear here when encryption runs...
              </span>
            ) : (
              terminalLines.map((l, i) => (
                <div key={i} style={{ color: TC[l.type] || TC.stdout, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {l.line}
                </div>
              ))
            )}
            {encrypting && (
              <span style={{ color: TC.info, animation: 'blink 1s step-end infinite' }}>▌</span>
            )}
          </div>

          {encryptedResult && (
            <div style={{
              marginTop: '0.75rem',
              padding: '0.75rem 1rem',
              background: '#0d1a0d',
              borderRadius: '4px',
              borderLeft: '4px solid #42be65',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '1rem',
            }}>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#42be65', marginBottom: '0.25rem' }}>
                  {config.needsCert ? 'Encryption complete' : 'Section ready'}
                </div>
                <div style={{
                  fontFamily: '"IBM Plex Mono", monospace',
                  fontSize: '0.75rem',
                  color: TC.muted,
                  wordBreak: 'break-all',
                }}>
                  {encryptedResult.substring(0, 80)}...
                </div>
              </div>
              <Button
                kind="ghost"
                size="sm"
                renderIcon={View}
                onClick={() => setShowPreview(true)}
                style={{ flexShrink: 0 }}
              >
                Preview
              </Button>
            </div>
          )}
        </div>

        {/* ── Step 3/4: Submit ──────────────────────────────────────────── */}
        <div>
          <h4 style={{ marginBottom: '0.75rem' }}>Step {config.needsCert ? 4 : 3} — Submit</h4>
          <Button
            renderIcon={Upload}
            onClick={handleSubmit}
            disabled={submitting || !encryptedResult}
          >
            {submitting ? 'Submitting...' : `Submit ${config.title}`}
          </Button>
          {!encryptedResult && (
            <p style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary)', marginTop: '0.5rem' }}>
              Complete Step {config.needsCert ? 3 : 2} before submitting.
            </p>
          )}
        </div>

      </div>

      {/* ── Preview modal ─────────────────────────────────────────────────── */}
      <Modal
        open={showPreview}
        modalHeading={`${config.title} Preview`}
        modalLabel="Review before submit"
        primaryButtonText="Close"
        onRequestSubmit={() => setShowPreview(false)}
        onRequestClose={() => setShowPreview(false)}
        size="lg"
        passiveModal
      >
        <p style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--cds-text-secondary)' }}>
          {config.needsCert
            ? <>This is the encrypted payload that will be submitted. It is in{' '}
                <code>hyper-protect-basic.&lt;encrypted-password&gt;.&lt;encrypted-data&gt;</code> format.</>
            : 'AES-256-GCM encrypted environment section. The iv, authTag, and encrypted fields are all base64-encoded.'}
        </p>
        <CodeSnippet type="multi" feedback="Copied to clipboard" wrapText>
          {(() => {
            if (!encryptedResult) return '';
            try {
              return JSON.stringify(JSON.parse(encryptedResult), null, 2);
            } catch {
              return encryptedResult;
            }
          })()}
        </CodeSnippet>
      </Modal>

      <style>{`
        @keyframes blink { 50% { opacity: 0; } }
      `}</style>
    </div>
  );
};

export default SectionSubmit;
