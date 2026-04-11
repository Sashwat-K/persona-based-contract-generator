import React, { useState, useEffect, useRef } from 'react';
import {
  Button,
  InlineNotification,
  Tag,
  Tile,
  Modal,
  CodeSnippet,
} from '@carbon/react';
import {
  CheckmarkFilled,
  Terminal,
  Document,
  Upload,
  View,
} from '@carbon/icons-react';
import buildService from '../services/buildService';
import sectionService from '../services/sectionService';
import cryptoService from '../services/cryptoService';
import apiClient from '../services/apiClient';
import { useAuthStore } from '../store/authStore';
import { formatDate } from '../utils/formatters';

const upsertTopLevelYamlField = (yaml, key, value) => {
  const fieldPattern = new RegExp(`^${key}:\\s*.*$`, 'm');
  if (fieldPattern.test(yaml)) {
    return yaml.replace(fieldPattern, `${key}: ${value}`);
  }
  const normalized = yaml.endsWith('\n') ? yaml : `${yaml}\n`;
  return `${normalized}${key}: ${value}\n`;
};

const FinaliseContract = ({ buildId, buildStatus: buildStatusProp, onStatusUpdate }) => {
  const user = useAuthStore((s) => s.user);

  // Live status
  const [liveStatus, setLiveStatus] = useState(buildStatusProp);
  useEffect(() => { setLiveStatus(buildStatusProp); }, [buildStatusProp]);
  useEffect(() => {
    buildService.getBuild(buildId)
      .then(b => { if (b?.status) setLiveStatus(b.status); })
      .catch(() => {});
    return () => { window.electron?.auditor?.offTerminalLine?.(); };
  }, [buildId]);

  // Check if already finalized
  const [isFinalized, setIsFinalized] = useState(false);
  const [finalizedAt, setFinalizedAt] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  useEffect(() => {
    buildService.getBuild(buildId)
      .then(b => {
        if (b?.status === 'FINALIZED') {
          setIsFinalized(true);
          setFinalizedAt(b.updated_at || b.finalized_at || null);
        }
        setLiveStatus(b?.status);
      })
      .catch(() => {})
      .finally(() => setLoadingStatus(false));
  }, [buildId]);

  // Cached step1/step3 results from AuditorSection (stored in sessionStorage)
  const step1Key = `auditor_step1_${buildId}`;
  const getStep1Result = () => {
    try {
      const direct = JSON.parse(sessionStorage.getItem(step1Key));
      if (direct?.signingFolder && direct?.signingPassphrase) return direct;
    } catch (_) {}
    try {
      // Backward/alternate fallback: recover from step3 cache if present.
      const step3 = JSON.parse(sessionStorage.getItem(step3Key));
      if (step3?.signingFolder && step3?.signingPassphrase) {
        return {
          signingFolder: step3.signingFolder,
          signingPassphrase: step3.signingPassphrase,
          signingMode: 'key',
        };
      }
    } catch (_) {}
    return null;
  };

  const step3Key = `auditor_step3_${buildId}`;
  const getStep3Result = () => {
    try { return JSON.parse(sessionStorage.getItem(step3Key)); } catch { return null; }
  };

  // Generate contract state
  const [generating, setGenerating] = useState(false);
  const [generatedContract, setGeneratedContract] = useState(null);
  const [contractReady, setContractReady] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Finalize state
  const [finalizing, setFinalizing] = useState(false);

  // Terminal
  const [terminalLines, setTerminalLines] = useState([]);
  const terminalRef = useRef(null);
  const topRef = useRef(null);
  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [terminalLines]);

  // Error / success
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const addLine = (type, line) => setTerminalLines(prev => [...prev, { type, line }]);

  // ── Generate contract ─────────────────────────────────────────────────────

  const handleGenerate = async () => {
    setError(null);
    const step1Result = getStep1Result();
    const signingFolder = step1Result?.signingFolder || '';
    const signingPassphrase = step1Result?.signingPassphrase || '';
    if (!signingFolder || !signingPassphrase) {
      setError('Signing key context is missing in this session. Please revisit Sign & Add Attestation and run Step 1 once, then retry.');
      return;
    }

    // Need encrypted env from step3 result cached by AuditorSection
    const step3Result = getStep3Result();
    if (!step3Result?.encryptedEnv || !step3Result?.encryptedAttestationPubKey) {
      setError('Encrypted artifacts not found. Please complete "Sign & Add Attestation" (Steps 1-4) first in that tab.');
      return;
    }

    let workloadSection;
    try {
      workloadSection = await sectionService.getSection(buildId, 'SOLUTION_PROVIDER');
    } catch (_) {}
    if (!workloadSection) {
      setError('No workload section found. The Solution Provider must submit first.');
      return;
    }

    setGenerating(true);
    setContractReady(false);
    setGeneratedContract(null);
    setTerminalLines([]);
    addLine('info', '-- Assembling and signing final contract --');

    window.electron?.auditor?.offTerminalLine?.();
    window.electron?.auditor?.onTerminalLine?.((data) => addLine(data.type, data.line));

    try {
      // 1. Build partial YAML (workload + env) for signing
      addLine('cmd', '$ assemble workload + env YAML for signing');
      const partialYaml = `workload: ${workloadSection.encrypted_payload}\nenv: ${step3Result.encryptedEnv}\n`;
      addLine('stdout', 'Partial YAML ready (' + partialYaml.length + ' bytes).');

      // 2. Sign with contract-cli sign-contract
      const sep = signingFolder.includes('\\') ? '\\' : '/';
      const signingKeyPath = signingFolder.replace(/[/\\]$/, '') + sep + 'signing-private.pem';
      addLine('cmd', '$ contract-cli sign-contract --in - --password <passphrase> --priv ' + signingKeyPath);
      const signedContractBase = await window.electron.auditor.signContract({
        contractYaml: partialYaml,
        signingKeyPath,
        signingPassphrase,
      });
      addLine('stdout', 'Signed workload+env contract generated (' + signedContractBase.length + ' bytes).');

      // 3. Add attestation public key to the signed contract YAML
      addLine('cmd', '$ upsert attestationPublicKey into signed contract YAML');
      const contractYaml = upsertTopLevelYamlField(
        signedContractBase,
        'attestationPublicKey',
        step3Result.encryptedAttestationPubKey
      );
      addLine('stdout', 'Contract YAML assembled (' + contractYaml.length + ' bytes).');

      // 4. Hash
      addLine('cmd', '$ node:crypto  SHA-256  hash(contractYaml)');
      const contractHash = await cryptoService.hash(contractYaml);
      addLine('stdout', 'contract hash: ' + contractHash);

      // 5. Sign hash with auditor identity key for backend audit
      const privateKey = await cryptoService.getPrivateKey(user?.id);
      if (!privateKey) throw new Error('Identity private key not found.');
      addLine('cmd', '$ node:crypto  RSA-PSS  sign(contractHash, auditorIdentityKey)');
      const signature = await cryptoService.sign(contractHash, privateKey);
      addLine('stdout', 'signature (first 32 chars): ' + signature.substring(0, 32) + '...');

      // Fetch the auditor identity public key that matches the private key used above.
      const publicKeyResp = await apiClient.get(`/users/${user?.id}/public-key`);
      const publicKey = publicKeyResp?.data?.public_key || '';
      if (!publicKey) {
        throw new Error('Registered identity public key not found. Please register public key in Account Settings.');
      }

      setGeneratedContract({ yaml: contractYaml, hash: contractHash, signature, publicKey });
      setContractReady(true);
      addLine('result', 'Contract ready. Review it before finalizing.');
    } catch (err) {
      addLine('error', 'Error: ' + err.message);
      setError('Generate failed: ' + err.message);
    } finally {
      setGenerating(false);
      window.electron?.auditor?.offTerminalLine?.();
    }
  };

  // ── Finalize build ────────────────────────────────────────────────────────

  const handleFinalize = async () => {
    setError(null);
    setFinalizing(true);
    addLine('info', '-- Finalizing build --');

    try {
      const STATUS_ORDER = [
        'CREATED', 'WORKLOAD_SUBMITTED', 'ENVIRONMENT_STAGED',
        'AUDITOR_KEYS_REGISTERED', 'CONTRACT_ASSEMBLED', 'FINALIZED',
      ];
      const currentBuild = await buildService.getBuild(buildId);
      let currentStatus = currentBuild.status;
      addLine('stdout', 'Current build status: ' + currentStatus);

      const isAtOrPast = (target) =>
        STATUS_ORDER.indexOf(currentStatus) >= STATUS_ORDER.indexOf(target);

      // Transition -> CONTRACT_ASSEMBLED if not already there
      if (!isAtOrPast('CONTRACT_ASSEMBLED')) {
        addLine('cmd', '$ PATCH /builds/' + buildId + '/status  ->  CONTRACT_ASSEMBLED');
        await apiClient.patch(`/builds/${buildId}/status`, { status: 'CONTRACT_ASSEMBLED' });
        currentStatus = 'CONTRACT_ASSEMBLED';
        addLine('success', 'Build transitioned to CONTRACT_ASSEMBLED.');
      } else {
        addLine('info', 'Already at ' + currentStatus + ', skipping CONTRACT_ASSEMBLED transition.');
      }

      // POST /finalize
      addLine('cmd', '$ POST /builds/' + buildId + '/finalize');
      await buildService.finalizeBuild(buildId, {
        contract_hash: generatedContract.hash,
        contract_yaml: generatedContract.yaml,
        signature: generatedContract.signature,
        public_key: generatedContract.publicKey,
      });

      addLine('success', 'Build finalized successfully.');
      addLine('result', 'Status -> FINALIZED');

      setIsFinalized(true);
      setFinalizedAt(new Date().toISOString());
      setLiveStatus('FINALIZED');
      onStatusUpdate?.('FINALIZED');

      // Clear cached step3 result
      sessionStorage.removeItem(step3Key);

      setSuccess('Contract finalized. The build is now FINALIZED.');
    } catch (err) {
      addLine('error', 'Error: ' + err.message);
      setError('Finalize failed: ' + err.message);
    } finally {
      setFinalizing(false);
      topRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // ── Status guard ───────────────────────────────────────────────────────────

  const ACTIVE_STATUSES = [
    'AUDITOR_KEYS_REGISTERED', 'CONTRACT_ASSEMBLED',
  ];
  const isAvailable = ACTIVE_STATUSES.includes(liveStatus) || isFinalized;
  const bodyClassName = `workflow-body${isAvailable && !isFinalized ? '' : ' workflow-body--disabled'}`;
  const step2ClassName = `workflow-step-card${contractReady ? '' : ' workflow-step-card--blocked'}`;

  const getTerminalLineClass = (type) => {
    const supportedTypes = ['cmd', 'info', 'stdout', 'stderr', 'success', 'result', 'error', 'muted'];
    const normalizedType = supportedTypes.includes(type) ? type : 'stdout';
    return `workflow-terminal__line workflow-terminal__line--${normalizedType}`;
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div ref={topRef}>
      <h3 className="workflow-title">Finalise Contract</h3>
      <p className="workflow-description">
        Generate the final signed contract and finalize the build.
      </p>

      {error && (
        <InlineNotification kind="error" title="Error" subtitle={error}
          onCloseButtonClick={() => setError(null)} lowContrast className="workflow-notification" />
      )}
      {success && (
        <InlineNotification kind="success" title="Success" subtitle={success}
          onCloseButtonClick={() => setSuccess(null)} lowContrast className="workflow-notification" />
      )}

      {!loadingStatus && isFinalized && (
        <Tile className="workflow-complete-tile">
          <div className="workflow-complete-tile__row">
            <CheckmarkFilled size={20} className="workflow-complete-tile__icon" />
            <div>
              <strong>Build finalized</strong>
              {finalizedAt && (
                <div className="workflow-complete-tile__meta">
                  Finalized at: {formatDate(finalizedAt, { second: '2-digit', timeZoneName: 'short' })}
                </div>
              )}
            </div>
            <Tag type="green" className="workflow-complete-tile__tag">FINALIZED</Tag>
          </div>
        </Tile>
      )}

      {!loadingStatus && !isFinalized && !ACTIVE_STATUSES.includes(liveStatus) && (
        <InlineNotification kind="info" title="Not yet available"
          subtitle={`Requires build status "AUDITOR_KEYS_REGISTERED". Current: ${liveStatus}. Complete Sign & Add Attestation first.`}
          lowContrast hideCloseButton className="workflow-notification" />
      )}

      <div className={bodyClassName}>

        {/* ── Step 1: Generate contract ─────────────────────────────────── */}
        <div>
          <h4 className="workflow-step-heading">
            <Terminal size={18} />
            Step 1 — Generate Contract
            {contractReady && <Tag type="green" size="sm">Done</Tag>}
          </h4>
          <p className="workflow-step-copy">
            Signs and assembles the final contract YAML locally.
          </p>

          <div className="workflow-inline-actions">
            <Button
              kind="secondary"
              renderIcon={Document}
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating ? 'Generating...' : 'Generate Final Contract'}
            </Button>

            {contractReady && (
              <Button
                kind="ghost"
                renderIcon={View}
                onClick={() => setShowPreview(true)}
              >
                Preview Contract
              </Button>
            )}
          </div>
        </div>

        {/* ── Step 2: Finalize ─────────────────────────────────────────── */}
        <div className={step2ClassName}>
          <h4 className="workflow-step-heading">
            <Upload size={18} />
            Step 2 — Finalize Build
            {!contractReady && <Tag type="gray" size="sm">Waiting for Step 1</Tag>}
          </h4>
          <p className="workflow-step-copy">
            Submits the contract to the backend and locks the build as FINALIZED.
          </p>

          <Button
            renderIcon={Upload}
            onClick={handleFinalize}
            disabled={finalizing || !contractReady}
          >
            {finalizing ? 'Finalizing...' : 'Finalize Build'}
          </Button>
        </div>

        {/* ── Terminal ─────────────────────────────────────────────────── */}
        <div>
          <h4 className="workflow-step-heading">
            <Terminal size={18} /> Terminal Output
          </h4>
          <div
            ref={terminalRef}
            className="workflow-terminal workflow-terminal--compact"
          >
            {terminalLines.length === 0 ? (
              <span className="workflow-terminal__line workflow-terminal__line--muted">
                Terminal output will appear here...
              </span>
            ) : (
              terminalLines.map((l, i) => (
                <div key={i} className={getTerminalLineClass(l.type)}>
                  {l.line}
                </div>
              ))
            )}
            {(generating || finalizing) && <span className="workflow-terminal__cursor">|</span>}
          </div>
        </div>

      </div>

      {/* ── Preview modal ─────────────────────────────────────────────────── */}
      <Modal
        open={showPreview}
        modalHeading="Final Contract Preview"
        modalLabel="Review before finalizing"
        primaryButtonText="Close"
        onRequestSubmit={() => setShowPreview(false)}
        onRequestClose={() => setShowPreview(false)}
        size="lg"
        passiveModal
      >
        {generatedContract && (
          <>
            <p className="workflow-modal-copy workflow-modal-copy--tight">
              Contract hash: <code>{generatedContract.hash}</code>
            </p>
            <p className="workflow-modal-copy">
              Review the assembled contract YAML below. Once you finalize, the build is locked.
            </p>
            <CodeSnippet type="multi" feedback="Copied to clipboard" wrapText>
              {generatedContract.yaml}
            </CodeSnippet>
          </>
        )}
      </Modal>
    </div>
  );
};

export default FinaliseContract;
