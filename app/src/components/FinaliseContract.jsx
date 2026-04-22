import React, { useEffect, useState } from 'react';
import {
  Button,
  InlineNotification,
  Tag,
  Tile,
  TextInput,
  Modal,
  CodeSnippet,
} from '@carbon/react';
import {
  CheckmarkFilled,
  Upload,
  View,
  Download,
} from '@carbon/icons-react';
import buildService from '../services/buildService';
import { formatDate } from '../utils/formatters';

const CONTEXT_KEY_PREFIX = 'auditor_v2_';

const FinaliseContract = ({ buildId, buildStatus: buildStatusProp, onStatusUpdate }) => {
  const [liveStatus, setLiveStatus] = useState(buildStatusProp || '');
  const [isFinalized, setIsFinalized] = useState(false);
  const [finalizedAt, setFinalizedAt] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const [signingKeyPassphrase, setSigningKeyPassphrase] = useState('');

  const [finalizing, setFinalizing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [showContractPreview, setShowContractPreview] = useState(false);
  const [contractContent, setContractContent] = useState('');
  const [loadingContract, setLoadingContract] = useState(false);

  const contractEditorLineRef = React.useRef(null);

  const contextKey = `${CONTEXT_KEY_PREFIX}${buildId}`;

  const loadContextFromSession = () => {
    try {
      const raw = sessionStorage.getItem(contextKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setSigningKeyPassphrase(parsed?.signing_key_passphrase || '');
    } catch (_) {
      // no-op
    }
  };

  const refreshBuildStatus = async () => {
    const build = await buildService.getBuild(buildId);
    const status = build?.status || '';
    setLiveStatus(status);

    const finalized = status === 'FINALIZED' || status === 'CONTRACT_DOWNLOADED';
    setIsFinalized(finalized);
    if (finalized) {
      setFinalizedAt(build?.finalized_at || build?.updated_at || new Date().toISOString());
    }

    onStatusUpdate?.(status);
  };

  useEffect(() => {
    setLiveStatus(buildStatusProp || '');
  }, [buildStatusProp]);

  useEffect(() => {
    const load = async () => {
      try {
        loadContextFromSession();
        await refreshBuildStatus();
      } catch (_) {
        // no-op
      } finally {
        setLoadingStatus(false);
      }
    };
    load();
  }, [buildId]);

  const handleFinalize = async () => {
    setError(null);
    setSuccess(null);
    setResult(null);

    if (!signingKeyPassphrase.trim()) {
      setError('Signing key passphrase is required for contract signing.');
      return;
    }

    setFinalizing(true);
    try {
      const response = await buildService.finalizeBuildV2(buildId, {
        signing_key_passphrase: signingKeyPassphrase.trim(),
      });

      setResult(response || null);
      setSuccess('Build finalized successfully. The contract has been signed.');

      try {
        sessionStorage.removeItem(contextKey);
      } catch (_) {
        // no-op
      }

      await refreshBuildStatus();
    } catch (err) {
      setError(`Finalize failed: ${err.message}`);
    } finally {
      setFinalizing(false);
    }
  };

  const handlePreviewContract = async () => {
    setLoadingContract(true);
    setError(null);
    try {
      const data = await buildService.downloadContract(buildId);
      // getUserData returns {contract_yaml, contract_hash}
      let contract = data?.contract_yaml || data?.contract || data?.user_data || '';
      
      // Decode if base64 encoded
      if (contract && typeof contract === 'string') {
        const trimmed = contract.trim();
        // Check if it looks like base64 (no newlines, no YAML keywords)
        if (!trimmed.includes('\n') && !trimmed.includes('workload:') && !trimmed.includes('env:')) {
          try {
            contract = atob(trimmed);
          } catch (_) {
            // Not base64, use as-is
          }
        }
      }
      
      setContractContent(contract);
      setShowContractPreview(true);
    } catch (err) {
      setError(`Failed to load contract: ${err.message}`);
    } finally {
      setLoadingContract(false);
    }
  };

  const syncContractEditorScroll = (event) => {
    if (!contractEditorLineRef.current) return;
    contractEditorLineRef.current.scrollTop = event.target.scrollTop;
  };

  const isAvailable = liveStatus === 'ATTESTATION_KEY_REGISTERED' || isFinalized;

  return (
    <div>
      <h3 className="workflow-title">Finalise contract</h3>
      <p className="workflow-description">
        Finalize the build using backend-native contract assembly via <code>POST /builds/{'{id}'}/v2/finalize</code>.
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
              <div style={{ marginTop: '0.5rem' }}>
                <Button
                  kind="ghost"
                  size="sm"
                  renderIcon={View}
                  onClick={handlePreviewContract}
                  disabled={loadingContract}
                >
                  {loadingContract ? 'Loading...' : 'Preview Contract'}
                </Button>
              </div>
            </div>
            <Tag type="green" className="workflow-complete-tile__tag">{liveStatus || 'FINALIZED'}</Tag>
          </div>
        </Tile>
      )}

      {!loadingStatus && !isFinalized && !isAvailable && (
        <InlineNotification
          kind="info"
          title="Not yet available"
          subtitle={`Requires build status "ATTESTATION_KEY_REGISTERED". Current: ${liveStatus}. Complete Add attestation key first.`}
          lowContrast
          hideCloseButton
          className="workflow-notification"
        />
      )}

      <div className={`workflow-body${isAvailable && !isFinalized ? '' : ' workflow-body--disabled'}`}>
        <p className="workflow-step-copy">
          The backend will automatically use the latest signing and attestation keys registered for this build.
          You only need to provide the signing key passphrase to decrypt the private key for contract signing.
        </p>

        <TextInput
          id="finalize-signing-key-passphrase"
          labelText="Signing Key Passphrase (Required)"
          type="password"
          value={signingKeyPassphrase}
          onChange={(e) => setSigningKeyPassphrase(e.target.value)}
          placeholder="Enter the passphrase used during signing key registration"
          disabled={finalizing || isFinalized}
          autoComplete="off"
          helperText="This passphrase will be used to decrypt the signing private key for contract signing"
        />

        <div className="workflow-inline-actions">
          <Button
            kind="secondary"
            onClick={loadContextFromSession}
            disabled={finalizing || isFinalized}
          >
            Load Passphrase from Session
          </Button>
          <Button
            renderIcon={Upload}
            onClick={handleFinalize}
            disabled={finalizing || !isAvailable || isFinalized}
          >
            {finalizing ? 'Finalizing...' : 'Finalize Build'}
          </Button>
        </div>

        {result?.contract_hash && (
          <p className="workflow-step-copy">
            Contract hash: <code>{result.contract_hash}</code>
          </p>
        )}
      </div>

      <Modal
        open={showContractPreview}
        onRequestClose={() => setShowContractPreview(false)}
        modalHeading="Final Contract Preview"
        modalLabel="Signed contract YAML"
        passiveModal
        size="lg"
      >
        <p className="workflow-modal-copy">
          This is the final signed contract YAML ready for deployment to IBM Hyper Protect Container Runtime.
        </p>
        {contractContent ? (
          <CodeSnippet
            type="multi"
            feedback="Copied to clipboard"
            wrapText={false}
            style={{ marginTop: '1rem', maxHeight: '500px', overflow: 'auto' }}
          >
            {contractContent}
          </CodeSnippet>
        ) : (
          <p>Loading contract...</p>
        )}
      </Modal>
    </div>
  );
};

export default FinaliseContract;
