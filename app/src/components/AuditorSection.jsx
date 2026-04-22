import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  InlineNotification,
  Tag,
  Tile,
  PasswordInput,
  RadioButtonGroup,
  RadioButton,
  Select,
  SelectItem,
  FileUploader,
} from '@carbon/react';
import {
  Key,
  Certificate,
} from '@carbon/icons-react';
import buildService from '../services/buildService';
import ConfirmDialog from './ConfirmDialog';
import { PLATFORMS, getCertsByPlatform, getCertById } from '../data/builtinCerts';

const CONTEXT_KEY_PREFIX = 'auditor_v2_';
const TERMINAL_STATUSES = new Set(['FINALIZED', 'CONTRACT_DOWNLOADED', 'CANCELLED']);
const SIGNING_REGISTERED_STATUSES = new Set([
  'SIGNING_KEY_REGISTERED',
  'WORKLOAD_SUBMITTED',
  'ENVIRONMENT_STAGED',
  'ATTESTATION_KEY_REGISTERED',
  'FINALIZED',
  'CONTRACT_DOWNLOADED',
  'CANCELLED',
  // Legacy v1 state retained in DB for older builds.
  'AUDITOR_KEYS_REGISTERED',
]);
const ATTESTATION_REGISTERED_STATUSES = new Set([
  'ATTESTATION_KEY_REGISTERED',
  'FINALIZED',
  'CONTRACT_DOWNLOADED',
  'CANCELLED',
  // Legacy v1 state retained in DB for older builds.
  'AUDITOR_KEYS_REGISTERED',
]);

const AuditorSection = ({ buildId, buildStatus: buildStatusProp, onStatusUpdate, mode = 'combined' }) => {
  const [liveStatus, setLiveStatus] = useState(buildStatusProp || '');
  const [loadingStatus, setLoadingStatus] = useState(true);

  const [signingResult, setSigningResult] = useState(null);
  const [attestationResult, setAttestationResult] = useState(null);
  const [signingPassphrase, setSigningPassphrase] = useState('');
  const [attestationPassphrase, setAttestationPassphrase] = useState('');
  
  // Certificate source: 'builtin' | 'custom'
  const [certSource, setCertSource] = useState('custom');
  const [selectedPlatformId, setSelectedPlatformId] = useState(PLATFORMS[0].id);
  const [selectedCertId, setSelectedCertId] = useState('');
  const [customCertContent, setCustomCertContent] = useState('');
  const [customCertFileName, setCustomCertFileName] = useState('');

  const [registeringSigning, setRegisteringSigning] = useState(false);
  const [registeringAttestation, setRegisteringAttestation] = useState(false);
  const [confirmRegisterSigningOpen, setConfirmRegisterSigningOpen] = useState(false);
  const [confirmRegisterAttestationOpen, setConfirmRegisterAttestationOpen] = useState(false);

  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const contextKey = `${CONTEXT_KEY_PREFIX}${buildId}`;
  const isSigningMode = mode === 'signing';
  const isAttestationMode = mode === 'attestation';
  const showSigningCard = !isAttestationMode;
  const showAttestationCards = !isSigningMode;

  const signingKeyID = useMemo(
    () => signingResult?.signing_key_id || signingResult?.key_id || '',
    [signingResult]
  );
  const attestationKeyID = useMemo(
    () => attestationResult?.attestation_key_id || attestationResult?.key_id || '',
    [attestationResult]
  );

  const liveStatusUpper = (liveStatus || '').toUpperCase();
  const isTerminal = TERMINAL_STATUSES.has(liveStatusUpper);
  const isSigningRegistered = Boolean(signingKeyID) || SIGNING_REGISTERED_STATUSES.has(liveStatusUpper);
  const isAttestationRegistered = Boolean(attestationKeyID) || ATTESTATION_REGISTERED_STATUSES.has(liveStatusUpper);
  const canRegisterAttestation = ['ENVIRONMENT_STAGED', 'ATTESTATION_KEY_REGISTERED', 'FINALIZED', 'CONTRACT_DOWNLOADED']
    .includes(liveStatusUpper);

  const pageTitle = isSigningMode
    ? 'Add Signing Key'
    : isAttestationMode
      ? 'Add attestation key'
      : 'Sign & Add Attestation';
  const pageDescription = isSigningMode
    ? 'Register a build-scoped signing key for this build.'
    : isAttestationMode
      ? 'Register a build-scoped attestation key for this build.'
      : 'Register signing and attestation keys using backend-native v2 endpoints.';
  const attestationStepLabel = showSigningCard ? 'Step 2' : 'Step 1';
  
  // Get certificate options based on selected platform
  const certOptions = getCertsByPlatform(selectedPlatformId);
  
  // Get active certificate content
  const getActiveCertContent = () => {
    if (certSource === 'custom') return customCertContent;
    return getCertById(selectedCertId)?.cert || '';
  };

  // Set default cert when platform changes
  useEffect(() => {
    const certs = getCertsByPlatform(selectedPlatformId);
    setSelectedCertId(certs.length > 0 ? certs[0].id : '');
  }, [selectedPlatformId]);

  const readStoredContext = () => {
    try {
      const raw = sessionStorage.getItem(contextKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
      return {};
    }
  };

  const persistContext = (updates) => {
    try {
      const next = { ...readStoredContext(), ...updates, saved_at: new Date().toISOString() };
      sessionStorage.setItem(contextKey, JSON.stringify(next));
    } catch (_) {
      // no-op
    }
  };

  const refreshBuildStatus = async () => {
    const build = await buildService.getBuild(buildId);
    const status = build?.status || '';
    setLiveStatus(status);
    onStatusUpdate?.(status);
  };

  useEffect(() => {
    setLiveStatus(buildStatusProp || '');
  }, [buildStatusProp]);

  useEffect(() => {
    const load = async () => {
      try {
        await refreshBuildStatus();
      } catch (_) {
        // no-op
      } finally {
        setLoadingStatus(false);
      }

      const parsed = readStoredContext();
      if (parsed?.signing_key_id) {
        setSigningResult({ signing_key_id: parsed.signing_key_id, source: 'session' });
      }
      if (parsed?.attestation_key_id) {
        setAttestationResult({ attestation_key_id: parsed.attestation_key_id, source: 'session' });
      }
    };

    load();
  }, [buildId, contextKey]);

  const handleRegisterSigningKey = () => {
    setError(null);
    setSuccess(null);

    if (isSigningRegistered) {
      setSuccess('Signing key is already registered for this build.');
      return;
    }

    if (!signingPassphrase.trim()) {
      setError('Signing key passphrase is required.');
      return;
    }

    setConfirmRegisterSigningOpen(true);
  };

  const confirmRegisterSigningKey = async () => {
    setConfirmRegisterSigningOpen(false);
    setError(null);
    setSuccess(null);

    if (isSigningRegistered) {
      setSuccess('Signing key is already registered for this build.');
      return;
    }

    if (!signingPassphrase.trim()) {
      setError('Signing key passphrase is required.');
      return;
    }

    setRegisteringSigning(true);
    try {
      const result = await buildService.registerSigningKey(buildId, {
        mode: 'generate',
        passphrase: signingPassphrase.trim()
      });
      setSigningResult(result);
      const nextSigningKeyID = result?.signing_key_id || result?.key_id || '';
      if (nextSigningKeyID) {
        persistContext({
          signing_key_id: nextSigningKeyID,
          signing_key_passphrase: signingPassphrase.trim()
        });
      }
      await refreshBuildStatus();
      if (result?.passphrase_ignored) {
        setSuccess('Signing key registered successfully. Passphrase is saved in this session.');
      } else {
        setSuccess(isSigningMode
          ? 'Signing key registered successfully.'
          : 'Signing key registered successfully.');
      }
    } catch (err) {
      setError(`Failed to register signing key: ${err.message}`);
    } finally {
      setRegisteringSigning(false);
    }
  };

  const handleCustomCertUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCustomCertFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setCustomCertContent(ev.target.result);
    reader.readAsText(file);
  };

  const handleRegisterAttestationKey = () => {
    setError(null);
    setSuccess(null);

    if (isAttestationRegistered) {
      setSuccess('Attestation key is already registered for this build.');
      return;
    }

    if (!attestationPassphrase.trim()) {
      setError('Attestation key passphrase is required.');
      return;
    }

    const certContent = getActiveCertContent();
    if (!certContent || certContent.trim() === '') {
      setError('Please select or upload a valid encryption certificate.');
      return;
    }
    // Check for placeholder/dummy certificates
    if (certContent.includes('PASTE_') || certContent.includes('qLqL')) {
      setError('Please upload a real encryption certificate. Built-in certificates are placeholders for demonstration.');
      return;
    }

    setConfirmRegisterAttestationOpen(true);
  };

  const confirmRegisterAttestationKey = async () => {
    setConfirmRegisterAttestationOpen(false);
    setError(null);
    setSuccess(null);

    if (isAttestationRegistered) {
      setSuccess('Attestation key is already registered for this build.');
      return;
    }

    if (!attestationPassphrase.trim()) {
      setError('Attestation key passphrase is required.');
      return;
    }

    const certContent = getActiveCertContent();
    if (!certContent || certContent.trim() === '') {
      setError('Please select or upload a valid encryption certificate.');
      return;
    }
    // Check for placeholder/dummy certificates
    if (certContent.includes('PASTE_') || certContent.includes('qLqL')) {
      setError('Please upload a real encryption certificate. Built-in certificates are placeholders for demonstration.');
      return;
    }

    setRegisteringAttestation(true);
    try {
      const result = await buildService.registerAttestationKey(buildId, {
        mode: 'generate',
        passphrase: attestationPassphrase.trim(),
        encryption_cert_pem: certContent
      });
      setAttestationResult(result);
      const nextAttestationKeyID = result?.attestation_key_id || result?.key_id || '';
      if (nextAttestationKeyID) {
        persistContext({
          attestation_key_id: nextAttestationKeyID,
          attestation_key_passphrase: attestationPassphrase.trim()
        });
      }
      await refreshBuildStatus();
      setSuccess('Attestation key registered successfully. The public key has been encrypted.');
    } catch (err) {
      setError(`Failed to register attestation key: ${err.message}`);
    } finally {
      setRegisteringAttestation(false);
    }
  };

  return (
    <div>
      <h3 className="workflow-title">{pageTitle}</h3>
      <p className="workflow-description">
        {pageDescription}
      </p>

      {error && (
        <InlineNotification
          kind="error"
          title="Error"
          subtitle={error}
          onCloseButtonClick={() => setError(null)}
          lowContrast
          className="workflow-notification"
        />
      )}

      {success && (
        <InlineNotification
          kind="success"
          title="Success"
          subtitle={success}
          onCloseButtonClick={() => setSuccess(null)}
          lowContrast
          className="workflow-notification"
        />
      )}

      {!loadingStatus && (
        <Tile className="workflow-complete-tile" style={{ marginBottom: 16 }}>
          <div className="workflow-complete-tile__row">
            <div>
              <strong>Current Build Status</strong>
              <div className="workflow-complete-tile__meta">{liveStatus || 'Unknown'}</div>
            </div>
            <Tag type="blue" className="workflow-complete-tile__tag">{liveStatus || 'UNKNOWN'}</Tag>
          </div>
        </Tile>
      )}

      <div className={`workflow-body${isTerminal ? ' workflow-body--disabled' : ''}`}>
        {showSigningCard && (
          <div className="workflow-step-card">
            <h4 className="workflow-step-heading">
              <Key size={18} />
              Step 1 — Register Signing Key
              {isSigningRegistered && <Tag type="green" size="sm">Done</Tag>}
            </h4>
            <p className="workflow-step-copy">
              Registers a build-scoped signing key for this build.
            </p>
            <PasswordInput
              id="signing-key-passphrase"
              labelText="Signing Key Passphrase"
              placeholder="Enter passphrase"
              value={signingPassphrase}
              onChange={(e) => setSigningPassphrase(e.target.value)}
              autoComplete="new-password"
              disabled={registeringSigning || isTerminal || isSigningRegistered}
            />
            {signingKeyID && (
              <p className="workflow-step-copy">
                Signing Key ID: <code>{signingKeyID}</code>
              </p>
            )}
            {isSigningRegistered && !signingKeyID && (
              <p className="workflow-step-copy">
                Signing key is already registered for this build.
              </p>
            )}
            <div className="workflow-inline-actions workflow-inline-actions--spaced">
              <Button
                kind="secondary"
                onClick={handleRegisterSigningKey}
                disabled={registeringSigning || isTerminal || isSigningRegistered}
              >
                {registeringSigning ? 'Registering...' : (isSigningRegistered ? 'Signing Key Registered' : 'Register Signing Key')}
              </Button>
            </div>
          </div>
        )}

        {showAttestationCards && (
          <div className={`workflow-step-card${canRegisterAttestation ? '' : ' workflow-step-card--blocked'}`}>
            <h4 className="workflow-step-heading">
              <Certificate size={18} />
              {attestationStepLabel} — Register Attestation Key
              {attestationKeyID && <Tag type="green" size="sm">Done</Tag>}
              {!canRegisterAttestation && !isAttestationRegistered && <Tag type="gray" size="sm">Wait for ENVIRONMENT_STAGED</Tag>}
            </h4>
            <p className="workflow-step-copy">
              Registers a build-scoped attestation key via <code>POST /builds/{'{id}'}/keys/attestation</code>.
            </p>
            {attestationKeyID && (
              <p className="workflow-step-copy">
                Attestation Key ID: <code>{attestationKeyID}</code>
              </p>
            )}
            <PasswordInput
              id="attestation-key-passphrase"
              labelText="Attestation Key Passphrase"
              placeholder="Enter passphrase"
              value={attestationPassphrase}
              onChange={(e) => setAttestationPassphrase(e.target.value)}
              autoComplete="new-password"
              disabled={registeringAttestation || !canRegisterAttestation || isTerminal || isAttestationRegistered}
            />
            
            <div style={{ marginTop: '1rem' }}>
              <h5 className="workflow-step-title" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                HPCR Encryption Certificate
              </h5>
              <p style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.75rem' }}>
                The attestation public key will be encrypted using this certificate before storage.
              </p>
              
              <RadioButtonGroup
                name="attestation-cert-source"
                valueSelected={certSource}
                onChange={(val) => setCertSource(val)}
                className="workflow-radio-group"
                disabled={registeringAttestation || !canRegisterAttestation || isTerminal || isAttestationRegistered}
              >
                <RadioButton
                  labelText="Upload custom certificate"
                  value="custom"
                  id="attestation-cert-custom"
                  disabled={registeringAttestation || !canRegisterAttestation || isTerminal || isAttestationRegistered}
                />
                <RadioButton
                  labelText="Use built-in certificate"
                  value="builtin"
                  id="attestation-cert-builtin"
                  disabled={registeringAttestation || !canRegisterAttestation || isTerminal || isAttestationRegistered}
                />
              </RadioButtonGroup>

              {certSource === 'builtin' ? (
                <div className="workflow-form-row" style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <Select
                    id="attestation-cert-platform"
                    labelText="Platform"
                    value={selectedPlatformId}
                    onChange={(e) => setSelectedPlatformId(e.target.value)}
                    className="workflow-select workflow-select--platform"
                    disabled={registeringAttestation || !canRegisterAttestation || isTerminal || isAttestationRegistered}
                  >
                    {PLATFORMS.map(p => (
                      <SelectItem key={p.id} value={p.id} text={p.label} />
                    ))}
                  </Select>

                  <Select
                    id="attestation-cert-version"
                    labelText="Certificate"
                    value={selectedCertId}
                    onChange={(e) => setSelectedCertId(e.target.value)}
                    className="workflow-select workflow-select--version"
                    disabled={registeringAttestation || !canRegisterAttestation || isTerminal || isAttestationRegistered}
                  >
                    {certOptions.map(c => (
                      <SelectItem key={c.id} value={c.id} text={c.label} />
                    ))}
                  </Select>
                </div>
              ) : (
                <div style={{ marginTop: '1rem' }}>
                  <FileUploader
                    labelDescription="Upload certificate (.crt / .pem)"
                    buttonLabel="Choose file"
                    filenameStatus="edit"
                    accept={['.crt', '.pem', '.cer']}
                    onChange={handleCustomCertUpload}
                    disabled={registeringAttestation || !canRegisterAttestation || isTerminal || isAttestationRegistered}
                  />
                  {customCertFileName && (
                    <p className="workflow-upload-meta" style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#525252' }}>
                      {customCertFileName} loaded
                    </p>
                  )}
                </div>
              )}
            </div>
            {isAttestationRegistered && !attestationKeyID && (
              <p className="workflow-step-copy">
                Attestation key is already registered for this build.
              </p>
            )}
            <Button
              kind="secondary"
              onClick={handleRegisterAttestationKey}
              disabled={registeringAttestation || !canRegisterAttestation || isTerminal || isAttestationRegistered}
            >
              {registeringAttestation ? 'Registering...' : (isAttestationRegistered ? 'Attestation Key Registered' : 'Register Attestation Key')}
            </Button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmRegisterSigningOpen}
        title="Register Signing Key"
        type="warning"
        primaryButtonText={registeringSigning ? 'Registering...' : 'Register'}
        secondaryButtonText="Cancel"
        onConfirm={confirmRegisterSigningKey}
        onCancel={() => setConfirmRegisterSigningOpen(false)}
        loading={registeringSigning}
      >
        <div>
          <p className="confirm-dialog__paragraph">
            Register a signing key for this build now?
          </p>
          <p className="confirm-dialog__note">
            The passphrase you entered will be retained for this build session.
          </p>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmRegisterAttestationOpen}
        title="Register Attestation Key"
        type="warning"
        primaryButtonText={registeringAttestation ? 'Registering...' : 'Register'}
        secondaryButtonText="Cancel"
        onConfirm={confirmRegisterAttestationKey}
        onCancel={() => setConfirmRegisterAttestationOpen(false)}
        loading={registeringAttestation}
      >
        <div>
          <p className="confirm-dialog__paragraph">
            Register an attestation key for this build now?
          </p>
          <p className="confirm-dialog__note">
            The passphrase you entered will be retained for this build session.
          </p>
        </div>
      </ConfirmDialog>
    </div>
  );
};

export default AuditorSection;
