import React, { useState, useEffect, useRef } from 'react';
import {
  Button,
  InlineNotification,
  Tag,
  Tile,
  RadioButtonGroup,
  RadioButton,
  TextInput,
  PasswordInput,
  FileUploader,
  Select,
  SelectItem,
} from '@carbon/react';
import {
  CheckmarkFilled,
  Terminal,
  Folder,
  Certificate,
  Key,
  Upload,
} from '@carbon/icons-react';
import { PLATFORMS, getCertsByPlatform, getCertById } from '../data/builtinCerts';
import buildService from '../services/buildService';
import sectionService from '../services/sectionService';
import cryptoService from '../services/cryptoService';
import { useAuthStore } from '../store/authStore';
import { formatDate } from '../utils/formatters';

const AuditorSection = ({ buildId, buildStatus: buildStatusProp, onStatusUpdate }) => {
  const user = useAuthStore((s) => s.user);

  // Live build status (avoid stale prop)
  const [liveStatus, setLiveStatus] = useState(buildStatusProp);
  useEffect(() => { setLiveStatus(buildStatusProp); }, [buildStatusProp]);
  useEffect(() => {
    buildService.getBuild(buildId)
      .then(b => { if (b?.status) setLiveStatus(b.status); })
      .catch(() => {});
    return () => { window.electron?.auditor?.offTerminalLine?.(); };
  }, [buildId]);

  // Lock the form once attestation is complete (status advanced past ENVIRONMENT_STAGED)
  const DONE_STATUSES = ['AUDITOR_KEYS_REGISTERED', 'CONTRACT_ASSEMBLED', 'FINALIZED', 'CONTRACT_DOWNLOADED'];
  const [existingSection, setExistingSection] = useState(null);
  const [loadingSection, setLoadingSection] = useState(true);
  useEffect(() => {
    const load = async () => {
      try {
        const build = await buildService.getBuild(buildId);
        if (DONE_STATUSES.includes(build?.status)) {
          setLiveStatus(build.status);
          setAttestationConfirmed(true);

          // 1. Try sessionStorage (set at step 3 completion in this session)
          let registeredAt = null;
          try {
            const stored = sessionStorage.getItem(`auditor_step3_${buildId}`);
            if (stored) registeredAt = JSON.parse(stored).registeredAt || null;
          } catch (_) {}

          // 2. Fall back to audit trail event timestamp
          if (!registeredAt) {
            try {
              const events = await buildService.getAuditTrail(buildId);
              const evt = events.find(e => e.event_type === 'AUDITOR_KEYS_REGISTERED');
              if (evt?.created_at) registeredAt = evt.created_at;
            } catch (_) {}
          }

          setExistingSection({ submitted_at: registeredAt });
        }
      } catch (_) {
      } finally {
        setLoadingSection(false);
      }
    };
    load();
  }, [buildId]);

  // ── Step progress flags ───────────────────────────────────────────────────
  const [step1Done, setStep1Done] = useState(false);
  const [step2Done, setStep2Done] = useState(false);
  const [step3Done, setStep3Done] = useState(false);

  // ── Step 1: Signing key or cert ───────────────────────────────────────────
  const [signingMode, setSigningMode] = useState('key'); // 'key' | 'cert'
  const [signingFolder, setSigningFolder] = useState('');
  const [signingPassphrase, setSigningPassphrase] = useState('');
  // Cert-only extra fields
  const [certCountry, setCertCountry] = useState('');
  const [certState, setCertState] = useState('');
  const [certLocality, setCertLocality] = useState('');
  const [certOrg, setCertOrg] = useState('');
  const [certUnit, setCertUnit] = useState('');
  const [certDomain, setCertDomain] = useState('');
  const [certEmail, setCertEmail] = useState('');
  // Result from step 1
  const [signingResult, setSigningResult] = useState(null); // { publicKey, certPath?, keyPath }
  const [step1Running, setStep1Running] = useState(false);

  // ── Step 2: Attestation key ────────────────────────────────────────────────
  const [attFolder, setAttFolder] = useState('');
  const [attPassphrase, setAttPassphrase] = useState('');
  const [attResult, setAttResult] = useState(null); // { publicKey, publicKeyPath }
  const [step2Running, setStep2Running] = useState(false);

  // ── Encrypted env preview (after Step 1) ───────────────────────────────────
  const [envPreviewResult, setEnvPreviewResult] = useState(null); // { encryptedEnv }
  const [envPreviewRunning, setEnvPreviewRunning] = useState(false);

  // ── Step 3: Encrypt attestation public key ────────────────────────────────
  const [hpcrCertSource, setHpcrCertSource] = useState('custom');
  const [hpcrPlatformId, setHpcrPlatformId] = useState(PLATFORMS[0]?.id || '');
  const [hpcrCertId, setHpcrCertId] = useState('');
  const [hpcrCustomCert, setHpcrCustomCert] = useState('');
  const [hpcrCustomCertName, setHpcrCustomCertName] = useState('');
  const [step3Result, setStep3Result] = useState(null); // { encryptedEnv, encryptedAttestationPubKey }
  const [step3Running, setStep3Running] = useState(false);
  const [attestationConfirmed, setAttestationConfirmed] = useState(false);

  // Set default cert when platform changes
  useEffect(() => {
    const certs = getCertsByPlatform(hpcrPlatformId);
    setHpcrCertId(certs.length > 0 ? certs[0].id : '');
  }, [hpcrPlatformId]);

  // ── Terminal ───────────────────────────────────────────────────────────────
  const [terminalLines, setTerminalLines] = useState([]);
  const terminalRef = useRef(null);
  const topRef = useRef(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLines]);

  // ── Error / success ────────────────────────────────────────────────────────
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const addLine = (type, line) =>
    setTerminalLines(prev => [...prev, { type, line }]);

  const clearTerminal = () => setTerminalLines([]);

  const getHpcrCertContent = () => {
    if (hpcrCertSource === 'custom') return hpcrCustomCert;
    return getCertById(hpcrCertId)?.cert || '';
  };

  const getAuditorBridge = () => window.electron?.auditor || null;

  const hasAnyAuditorEncryptionBridge = () => {
    const auditor = getAuditorBridge();
    return !!(
      auditor?.generateEncryptedEnv ||
      auditor?.encryptEnvAndAttestation
    );
  };

  const hasAnyAttestationEncryptionBridge = () => {
    const auditor = getAuditorBridge();
    return !!(
      auditor?.encryptAttestationPublicKey ||
      auditor?.encryptEnvAndAttestation
    );
  };

  const selectFolder = async () => {
    const path = await window.electron?.selectDirectory?.();
    return path || null;
  };

  // ── Step 1: Generate signing key or cert ──────────────────────────────────

  const handleStep1 = async () => {
    setError(null);
    if (!window.electron?.auditor?.generateSigningKey) {
      setError('Auditor IPC bridge not available. Please fully restart the app (quit and relaunch).');
      return;
    }
    if (!signingFolder) { setError('Please select a folder to store keys.'); return; }
    if (!signingPassphrase) { setError('Please enter a passphrase.'); return; }

    window.electron?.auditor?.offTerminalLine?.();
    window.electron?.auditor?.onTerminalLine?.((data) => addLine(data.type, data.line));
    clearTerminal();
    setStep1Running(true);
    setStep1Done(false);
    setSigningResult(null);
    setEnvPreviewResult(null);
    setStep2Done(false);
    setAttResult(null);
    setStep3Done(false);
    setStep3Result(null);
    setAttestationConfirmed(false);

    try {
      let result;
      if (signingMode === 'key') {
        addLine('info', '-- Generating RSA-4096 signing key pair --');
        result = await window.electron.auditor.generateSigningKey({
          folderPath: signingFolder,
          passphrase: signingPassphrase,
        });
      } else {
        // cert mode — validate fields
        if (!certCountry || !certState || !certLocality || !certOrg || !certUnit || !certDomain || !certEmail) {
          setError('Please fill in all certificate fields.');
          setStep1Running(false);
          return;
        }
        if (certCountry.length !== 2) {
          setError('Country code must be exactly 2 characters (e.g., US, IN, GB).');
          setStep1Running(false);
          return;
        }
        addLine('info', '-- Generating self-signed X.509 signing certificate --');
        result = await window.electron.auditor.generateSigningCert({
          folderPath: signingFolder,
          passphrase: signingPassphrase,
          country: certCountry,
          state: certState,
          locality: certLocality,
          organisation: certOrg,
          unit: certUnit,
          domain: certDomain,
          email: certEmail,
        });
      }
      setSigningResult(result);
      setStep1Done(true);
      // Persist Step 1 context for Finalise Contract tab (same session only)
      try {
        sessionStorage.setItem(`auditor_step1_${buildId}`, JSON.stringify({
          signingFolder,
          signingPassphrase,
          signingMode,
          signingPublicKey: result?.publicKey || '',
          updatedAt: new Date().toISOString(),
        }));
      } catch (_) {}
      addLine('result', signingMode === 'key'
        ? 'Signing key pair ready at: ' + signingFolder
        : 'Signing certificate ready at: ' + (result.certPath || signingFolder));
    } catch (err) {
      addLine('error', 'Error: ' + err.message);
      setError('Step 1 failed: ' + err.message);
    } finally {
      setStep1Running(false);
      window.electron?.auditor?.offTerminalLine?.();
    }
  };

  // ── Step 2: Generate attestation key ──────────────────────────────────────

  const handleStep2 = async () => {
    setError(null);
    if (!attFolder) { setError('Please select a folder for the attestation key.'); return; }
    if (!attPassphrase) { setError('Please enter a passphrase for the attestation key.'); return; }

    window.electron?.auditor?.offTerminalLine?.();
    window.electron?.auditor?.onTerminalLine?.((data) => addLine(data.type, data.line));
    setStep2Running(true);
    setStep2Done(false);
    setAttResult(null);

    try {
      addLine('info', '-- Generating RSA-4096 attestation key pair --');
      const result = await window.electron.auditor.generateAttestationKey({
        folderPath: attFolder,
        passphrase: attPassphrase,
      });
      setAttResult(result);
      setStep2Done(true);
      setStep3Done(false);
      setEnvPreviewResult(null);
      setStep3Result(null);
      setAttestationConfirmed(false);
      addLine('result', 'Attestation key pair ready at: ' + attFolder);
    } catch (err) {
      addLine('error', 'Error: ' + err.message);
      setError('Step 2 failed: ' + err.message);
    } finally {
      setStep2Running(false);
      window.electron?.auditor?.offTerminalLine?.();
    }
  };

  // ── Encrypted env preview (after Step 1) ──────────────────────────────────

  const handleGenerateEncryptedEnvPreview = async () => {
    setError(null);
    const auditor = getAuditorBridge();
    if (!auditor || !hasAnyAuditorEncryptionBridge()) {
      setError('Auditor IPC bridge not available. Please fully quit and relaunch the app to load the latest preload APIs.');
      return;
    }

    const hpcrCert = getHpcrCertContent();
    if (!hpcrCert || hpcrCert.includes('PASTE_')) {
      setError('Please select or upload a valid HPCR encryption certificate.');
      return;
    }

    // Fetch environment section from backend
    let envSection;
    try {
      envSection = await sectionService.getSection(buildId, 'DATA_OWNER');
    } catch (_) {}
    if (!envSection) {
      setError('No environment section found for this build. The Data Owner must submit first.');
      return;
    }
    if (!envSection.wrapped_symmetric_key) {
      setError('Environment section is missing the wrapped symmetric key. Ensure the Data Owner submitted using the correct flow.');
      return;
    }

    // Need auditor's own identity private key for RSA-OAEP unwrap
    const privateKey = await cryptoService.getPrivateKey(user?.id);
    if (!privateKey) {
      setError('Identity private key not found. Please register your public key in your profile first.');
      return;
    }

    // Need the signing cert content
    const signingCertContent = signingMode === 'cert'
      ? signingResult?.certificate
      : null; // key mode: no cert, inject public key instead
    const signingPubKeyContent = signingResult?.publicKey || '';
    const certToInject = signingCertContent || signingPubKeyContent;
    if (!certToInject) {
      setError('Signing certificate / public key not available from Step 1.');
      return;
    }

    window.electron?.auditor?.offTerminalLine?.();
    window.electron?.auditor?.onTerminalLine?.((data) => addLine(data.type, data.line));
    setEnvPreviewRunning(true);
    setStep3Done(false);
    setEnvPreviewResult(null);
    setStep3Result(null);
    setAttestationConfirmed(false);

    try {
      addLine('info', '-- Decrypting environment section and generating encrypted env preview --');
      let result;
      if (auditor.generateEncryptedEnv) {
        result = await auditor.generateEncryptedEnv({
          encryptedEnvPayload: envSection.encrypted_payload,
          wrappedSymmetricKey: envSection.wrapped_symmetric_key,
          signingCertContent: certToInject,
          certContent: hpcrCert,
          auditorPrivateKeyPem: privateKey,
        });
      } else if (auditor.encryptEnvAndAttestation) {
        // Backward-compatible fallback for stale preload bridge exposing only combined API.
        result = await auditor.encryptEnvAndAttestation({
          encryptedEnvPayload: envSection.encrypted_payload,
          wrappedSymmetricKey: envSection.wrapped_symmetric_key,
          signingCertContent: certToInject,
          attestationPublicKey: attResult?.publicKey || '',
          certContent: hpcrCert,
          auditorPrivateKeyPem: privateKey,
        });
      } else {
        throw new Error('Missing auditor encryption API in preload bridge.');
      }
      setEnvPreviewResult(result);
      setStep3Done(true);
      addLine('result', 'Encrypted environment artifact preview ready.');
    } catch (err) {
      addLine('error', 'Error: ' + err.message);
      setError('Encrypted env preview failed: ' + err.message);
    } finally {
      setEnvPreviewRunning(false);
      window.electron?.auditor?.offTerminalLine?.();
    }
  };

  // ── Step 4: Confirm Sign & Add Attestation ───────────────────────────────

  const handleStep3 = async () => {
    setError(null);
    const auditor = getAuditorBridge();
    if (!auditor || !hasAnyAttestationEncryptionBridge()) {
      setError('Auditor IPC bridge not available. Please fully quit and relaunch the app to load the latest preload APIs.');
      return;
    }

    const hpcrCert = getHpcrCertContent();
    if (!hpcrCert || hpcrCert.includes('PASTE_')) {
      setError('Please select or upload a valid HPCR encryption certificate.');
      return;
    }
    if (!step3Done || !envPreviewResult?.encryptedEnv) {
      setError('Please complete Step 3 (Generate Encrypted Environment Preview) first.');
      return;
    }
    if (!attResult?.publicKey) {
      setError('Please generate attestation key first.');
      return;
    }

    window.electron?.auditor?.offTerminalLine?.();
    window.electron?.auditor?.onTerminalLine?.((data) => addLine(data.type, data.line));
    setStep3Running(true);
    setStep3Result(null);

    try {
      addLine('info', '-- Encrypting attestation public key --');
      let combinedResult;
      if (auditor.encryptAttestationPublicKey) {
        const result = await auditor.encryptAttestationPublicKey({
          attestationPublicKey: attResult.publicKey,
          certContent: hpcrCert,
        });
        combinedResult = {
          encryptedEnv: envPreviewResult.encryptedEnv,
          encryptedAttestationPubKey: result.encryptedAttestationPubKey,
        };
      } else if (auditor.encryptEnvAndAttestation) {
        // Backward-compatible fallback for older preload bridge.
        const envSection = await sectionService.getSection(buildId, 'DATA_OWNER');
        if (!envSection?.encrypted_payload || !envSection?.wrapped_symmetric_key) {
          throw new Error('Environment section is missing encrypted payload or wrapped symmetric key.');
        }
        const privateKey = await cryptoService.getPrivateKey(user?.id);
        if (!privateKey) {
          throw new Error('Identity private key not found. Please register your public key in your profile first.');
        }
        const signingCertContent = signingMode === 'cert'
          ? signingResult?.certificate
          : null;
        const signingPubKeyContent = signingResult?.publicKey || '';
        const certToInject = signingCertContent || signingPubKeyContent;
        if (!certToInject) {
          throw new Error('Signing certificate / public key not available from Step 1.');
        }

        combinedResult = await auditor.encryptEnvAndAttestation({
          encryptedEnvPayload: envSection.encrypted_payload,
          wrappedSymmetricKey: envSection.wrapped_symmetric_key,
          signingCertContent: certToInject,
          attestationPublicKey: attResult.publicKey,
          certContent: hpcrCert,
          auditorPrivateKeyPem: privateKey,
        });
      } else {
        throw new Error('Missing auditor attestation encryption API in preload bridge.');
      }

      setStep3Result(combinedResult);
      // Persist for FinaliseContract tab (sessionStorage cleared on finalize)
      try {
        sessionStorage.setItem(`auditor_step3_${buildId}`, JSON.stringify({
          encryptedEnv: combinedResult.encryptedEnv,
          encryptedAttestationPubKey: combinedResult.encryptedAttestationPubKey,
          signingPublicKey: signingResult?.publicKey || '',
          signingFolder,
          signingPassphrase,
          registeredAt: new Date().toISOString(),
        }));
      } catch (_) {}

      // Transition build status -> AUDITOR_KEYS_REGISTERED (confirm step only)
      addLine('cmd', '$ POST /builds/' + buildId + '/attestation');
      const registerResult = await buildService.registerAttestationKeys(buildId, {});
      const returnedStatus = registerResult?.status || 'AUDITOR_KEYS_REGISTERED';
      const alreadyRegistered = registerResult?.already_registered === true;

      setLiveStatus(returnedStatus);
      onStatusUpdate?.(returnedStatus);
      if (alreadyRegistered) {
        addLine('info', `Attestation already confirmed earlier. Build remains in ${returnedStatus}.`);
        setSuccess(`Attestation was already confirmed. Build remains in ${returnedStatus}.`);
      } else {
        addLine('success', 'Attestation confirmed. Build transitioned to AUDITOR_KEYS_REGISTERED.');
        setSuccess('Attestation confirmed. Build moved to AUDITOR_KEYS_REGISTERED.');
      }

      setAttestationConfirmed(true);
      addLine('result', 'Sign & Add Attestation complete. Proceed to Finalise Contract.');
    } catch (err) {
      addLine('error', 'Error: ' + err.message);
      setError('Step 4 failed: ' + err.message);
    } finally {
      setStep3Running(false);
      window.electron?.auditor?.offTerminalLine?.();
    }
  };

  // ── Status guard ───────────────────────────────────────────────────────────
  // Allow if status is ENVIRONMENT_STAGED or any intermediate auditor status
  // (in case a previous attempt advanced the status but didn't finalize)
  const AUDITOR_ACTIVE_STATUSES = [
    'ENVIRONMENT_STAGED', 'AUDITOR_KEYS_REGISTERED', 'CONTRACT_ASSEMBLED',
  ];
  const isCorrectStatus = AUDITOR_ACTIVE_STATUSES.includes(liveStatus);
  const isTerminalLocked = ['FINALIZED', 'CONTRACT_DOWNLOADED', 'CANCELLED'].includes(liveStatus);
  const isDisabled = !isCorrectStatus || isTerminalLocked;

  const certOptions = getCertsByPlatform(hpcrPlatformId);
  const bodyClassName = `workflow-body${isDisabled ? ' workflow-body--disabled' : ''}`;
  const step2ClassName = `workflow-step-card${step1Done ? '' : ' workflow-step-card--blocked'}`;
  const step3ClassName = `workflow-step-card${step2Done ? '' : ' workflow-step-card--blocked'}`;
  const step4ClassName = `workflow-step-card${step3Done ? '' : ' workflow-step-card--blocked'}`;

  const getTerminalLineClass = (type) => {
    const supportedTypes = ['cmd', 'info', 'stdout', 'stderr', 'success', 'result', 'error', 'muted'];
    const normalizedType = supportedTypes.includes(type) ? type : 'stdout';
    return `workflow-terminal__line workflow-terminal__line--${normalizedType}`;
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div ref={topRef}>
      <h3 className="workflow-title">Sign & Add Attestation</h3>
      <p className="workflow-description">
        Generate signing and attestation artifacts, then confirm attestation readiness.
      </p>

      {error && (
        <InlineNotification kind="error" title="Error" subtitle={error}
          onCloseButtonClick={() => setError(null)} lowContrast className="workflow-notification" />
      )}
      {success && (
        <InlineNotification kind="success" title="Success" subtitle={success}
          onCloseButtonClick={() => setSuccess(null)} lowContrast className="workflow-notification" />
      )}

      {!loadingSection && existingSection && (
        <Tile className="workflow-complete-tile">
          <div className="workflow-complete-tile__row">
            <CheckmarkFilled size={20} className="workflow-complete-tile__icon" />
            <div>
              <strong>Attestation keys registered</strong>
              <div className="workflow-complete-tile__meta">
                Registered at: {existingSection.submitted_at
                  ? formatDate(existingSection.submitted_at, { second: '2-digit', timeZoneName: 'short' }) : 'N/A'}
              </div>
            </div>
            <Tag type="green" className="workflow-complete-tile__tag">Keys Registered</Tag>
          </div>
        </Tile>
      )}

      {!isCorrectStatus && !existingSection && (
        <InlineNotification kind="info" title="Not yet available"
          subtitle={`This section requires build status "ENVIRONMENT_STAGED". Current: ${liveStatus}.`}
          lowContrast hideCloseButton className="workflow-notification" />

      )}

      <div className={bodyClassName}>

        {/* ── Step 1: Signing key or cert ───────────────────────────────── */}
        <div>
          <h4 className="workflow-step-heading">
            <Certificate size={18} />
            Step 1 — Generate Signing Key or Certificate
            {step1Done && <Tag type="green" size="sm">Done</Tag>}
          </h4>

          <RadioButtonGroup
            name="signing-mode"
            valueSelected={signingMode}
            onChange={(val) => {
              setSigningMode(val);
              setStep1Done(false);
              setSigningResult(null);
              setEnvPreviewResult(null);
              setStep2Done(false);
              setAttResult(null);
              setStep3Done(false);
              setStep3Result(null);
              setAttestationConfirmed(false);
            }}
            className="workflow-radio-group"
          >
            <RadioButton labelText="Signing key (RSA-4096)" value="key" id="signing-key" />
            <RadioButton labelText="Signing certificate (self-signed X.509)" value="cert" id="signing-cert" />
          </RadioButtonGroup>

          <div className="workflow-inline-actions workflow-form-row--spaced">
            <Button
              kind="ghost"
              size="md"
              renderIcon={Folder}
              onClick={async () => {
                const p = await selectFolder();
                if (p) setSigningFolder(p);
              }}
            >
              Browse
            </Button>
            <span className="workflow-upload-meta">
              {signingFolder ? `Selected folder: ${signingFolder}` : 'No output folder selected yet.'}
            </span>
          </div>

          <PasswordInput
            id="signing-passphrase"
            labelText="Passphrase for private key"
            placeholder="Enter passphrase"
            value={signingPassphrase}
            onChange={(e) => setSigningPassphrase(e.target.value)}
            className="workflow-input workflow-input--password"
          />

          {signingMode === 'cert' && (
            <div className="workflow-grid-form">
              <TextInput
                id="cert-country"
                labelText="Country (2-letter ISO code)"
                placeholder="US"
                value={certCountry}
                onChange={e => setCertCountry(e.target.value.toUpperCase().slice(0, 2))}
                maxLength={2}
                helperText="Must be exactly 2 characters (e.g., US, IN, GB)"
              />
              <TextInput id="cert-state" labelText="State / Province" placeholder="California"
                value={certState} onChange={e => setCertState(e.target.value)} />
              <TextInput id="cert-locality" labelText="Locality / City" placeholder="San Jose"
                value={certLocality} onChange={e => setCertLocality(e.target.value)} />
              <TextInput id="cert-org" labelText="Organisation" placeholder="IBM"
                value={certOrg} onChange={e => setCertOrg(e.target.value)} />
              <TextInput id="cert-unit" labelText="Organisational Unit" placeholder="Security"
                value={certUnit} onChange={e => setCertUnit(e.target.value)} />
              <TextInput id="cert-domain" labelText="Common Name / Domain" placeholder="auditor.example.com"
                value={certDomain} onChange={e => setCertDomain(e.target.value)} />
              <TextInput id="cert-email" labelText="Email" placeholder="auditor@example.com"
                value={certEmail} onChange={e => setCertEmail(e.target.value)}
                className="workflow-grid-form__full" />
            </div>
          )}

          <Button
            kind="secondary"
            renderIcon={signingMode === 'cert' ? Certificate : Key}
            onClick={handleStep1}
            disabled={step1Running}
          >
            {step1Running
              ? 'Generating...'
              : signingMode === 'key'
                ? 'Generate Signing Key'
                : 'Generate Signing Certificate'}
          </Button>

        </div>

        {/* ── Step 2: Attestation key ───────────────────────────────────── */}
        <div className={step2ClassName}>
          <h4 className="workflow-step-heading">
            <Key size={18} />
            Step 2 — Generate Attestation Key
            {step2Done && <Tag type="green" size="sm">Done</Tag>}
            {!step1Done && <Tag type="gray" size="sm">Waiting for Step 1</Tag>}
          </h4>

          <div className="workflow-inline-actions workflow-form-row--spaced">
            <Button
              kind="ghost"
              size="md"
              renderIcon={Folder}
              onClick={async () => {
                const p = await selectFolder();
                if (p) setAttFolder(p);
              }}
            >
              Browse
            </Button>
            <span className="workflow-upload-meta">
              {attFolder ? `Selected folder: ${attFolder}` : 'No output folder selected yet.'}
            </span>
          </div>

          <PasswordInput
            id="att-passphrase"
            labelText="Passphrase for attestation private key"
            placeholder="Enter passphrase"
            value={attPassphrase}
            onChange={(e) => setAttPassphrase(e.target.value)}
            className="workflow-input workflow-input--password"
          />

          <Button
            kind="secondary"
            renderIcon={Key}
            onClick={handleStep2}
            disabled={step2Running || !step1Done}
          >
            {step2Running ? 'Generating...' : 'Generate Attestation Key'}
          </Button>
        </div>

        {/* ── Step 3: Generate encrypted env preview ────────────────────── */}
        <div className={step3ClassName}>
          <h4 className="workflow-step-heading">
            <Terminal size={18} />
            Step 3 — Generate Encrypted Environment Preview
            {step3Done && <Tag type="green" size="sm">Done</Tag>}
            {!step2Done && <Tag type="gray" size="sm">Waiting for Step 2</Tag>}
          </h4>

          <p className="workflow-step-copy">
            Select the HPCR encryption certificate used to generate encrypted environment preview.
          </p>

          <RadioButtonGroup
            name="hpcr-cert-source"
            valueSelected={hpcrCertSource}
            onChange={(val) => {
              setHpcrCertSource(val);
              setStep3Done(false);
              setEnvPreviewResult(null);
              setStep3Result(null);
              setAttestationConfirmed(false);
            }}
            className="workflow-radio-group"
          >
            <RadioButton labelText="Upload custom certificate" value="custom" id="hpcr-cert-custom" />
            <RadioButton labelText="Use built-in certificate" value="builtin" id="hpcr-cert-builtin" />
          </RadioButtonGroup>

          {hpcrCertSource === 'builtin' ? (
            <div className="workflow-form-row workflow-form-row--spaced">
              <Select
                id="hpcr-platform"
                labelText="Platform"
                value={hpcrPlatformId}
                onChange={e => {
                  setHpcrPlatformId(e.target.value);
                  setStep3Done(false);
                  setEnvPreviewResult(null);
                  setStep3Result(null);
                  setAttestationConfirmed(false);
                }}
                className="workflow-select workflow-select--medium"
              >
                {PLATFORMS.map(p => <SelectItem key={p.id} value={p.id} text={p.label} />)}
              </Select>
              <Select
                id="hpcr-version"
                labelText="Version"
                value={hpcrCertId}
                onChange={e => {
                  setHpcrCertId(e.target.value);
                  setStep3Done(false);
                  setEnvPreviewResult(null);
                  setStep3Result(null);
                  setAttestationConfirmed(false);
                }}
                className="workflow-select workflow-select--version"
              >
                {certOptions.map(c => <SelectItem key={c.id} value={c.id} text={c.version} />)}
              </Select>
            </div>
          ) : (
            <div className="workflow-form-row--spaced">
              <FileUploader
                labelDescription="Upload HPCR certificate (.crt / .pem)"
                buttonLabel="Choose file"
                filenameStatus="edit"
                accept={['.crt', '.pem', '.cer']}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setHpcrCustomCertName(file.name);
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    setHpcrCustomCert(ev.target.result);
                    setStep3Done(false);
                    setEnvPreviewResult(null);
                    setStep3Result(null);
                    setAttestationConfirmed(false);
                  };
                  reader.readAsText(file);
                }}
              />
              {hpcrCustomCertName && (
                <p className="workflow-upload-meta">
                  {hpcrCustomCertName} loaded
                </p>
              )}
            </div>
          )}

          <Button
            kind="secondary"
            renderIcon={Terminal}
            onClick={handleGenerateEncryptedEnvPreview}
            disabled={envPreviewRunning || !step2Done}
          >
            {envPreviewRunning ? 'Processing...' : 'Generate Encrypted Environment Preview'}
          </Button>
        </div>

        {/* ── Step 4: Confirm Sign & Add Attestation ───────────────────── */}
        <div className={step4ClassName}>
          <h4 className="workflow-step-heading">
            <Upload size={18} />
            Step 4 — Confirm Sign & Add Attestation
            {attestationConfirmed && <Tag type="green" size="sm">Done</Tag>}
            {!step3Done && <Tag type="gray" size="sm">Waiting for Step 3</Tag>}
          </h4>
          <p className="workflow-step-copy">
            Encrypt attestation public key and confirm attestation readiness on backend.
          </p>
          <Button
            kind="secondary"
            renderIcon={Upload}
            onClick={handleStep3}
            disabled={step3Running || !step3Done}
          >
            {step3Running ? 'Confirming...' : 'Confirm Sign & Add Attestation'}
          </Button>
        </div>

        {attestationConfirmed && (
          <InlineNotification kind="success" title="Ready to finalize"
            subtitle="Attestation is confirmed. Go to the Finalise Contract tab to generate and submit the final contract."
            lowContrast hideCloseButton className="workflow-notification" />
        )}

        {/* ── Terminal output ───────────────────────────────────────────── */}
        <div>
          <h4 className="workflow-step-heading">
            <Terminal size={18} /> Terminal Output
          </h4>
          <div
            ref={terminalRef}
            className="workflow-terminal workflow-terminal--tall"
          >
            {terminalLines.length === 0 ? (
              <span className="workflow-terminal__line workflow-terminal__line--muted">
                Terminal output will appear here as operations run...
              </span>
            ) : (
              terminalLines.map((l, i) => (
                <div key={i} className={getTerminalLineClass(l.type)}>
                  {l.line}
                </div>
              ))
            )}
            {(step1Running || step2Running || envPreviewRunning || step3Running) && (
              <span className="workflow-terminal__cursor">|</span>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default AuditorSection;
