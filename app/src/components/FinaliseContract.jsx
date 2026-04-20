import React, { useEffect, useState } from 'react';
import {
  Button,
  InlineNotification,
  Tag,
  Tile,
  TextInput,
  TextArea,
} from '@carbon/react';
import {
  CheckmarkFilled,
  Upload,
} from '@carbon/icons-react';
import buildService from '../services/buildService';
import { formatDate } from '../utils/formatters';

const CONTEXT_KEY_PREFIX = 'auditor_v2_';

const FinaliseContract = ({ buildId, buildStatus: buildStatusProp, onStatusUpdate }) => {
  const [liveStatus, setLiveStatus] = useState(buildStatusProp || '');
  const [isFinalized, setIsFinalized] = useState(false);
  const [finalizedAt, setFinalizedAt] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const [signingKeyId, setSigningKeyId] = useState('');
  const [attestationKeyId, setAttestationKeyId] = useState('');
  const [attestationCertPEM, setAttestationCertPEM] = useState('');

  const [finalizing, setFinalizing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const contextKey = `${CONTEXT_KEY_PREFIX}${buildId}`;

  const loadContextFromSession = () => {
    try {
      const raw = sessionStorage.getItem(contextKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setSigningKeyId(parsed?.signing_key_id || '');
      setAttestationKeyId(parsed?.attestation_key_id || '');
      setAttestationCertPEM(parsed?.attestation_cert_pem || '');
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

    if (!signingKeyId.trim()) {
      setError('Signing key ID is required. Complete Add Signing Key first.');
      return;
    }

    setFinalizing(true);
    try {
      const response = await buildService.finalizeBuildV2(buildId, {
        signing_key_id: signingKeyId.trim(),
        attestation_key_id: attestationKeyId.trim() || undefined,
        attestation_cert_pem: attestationCertPEM.trim() || undefined,
      });

      setResult(response || null);
      setSuccess('Build finalized successfully.');

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
        <TextInput
          id="finalize-signing-key-id"
          labelText="Signing Key ID"
          value={signingKeyId}
          onChange={(e) => setSigningKeyId(e.target.value)}
          placeholder="UUID from Add Signing Key tab"
          disabled={finalizing || isFinalized}
        />

        <TextInput
          id="finalize-attestation-key-id"
          labelText="Attestation Key ID (Optional)"
          value={attestationKeyId}
          onChange={(e) => setAttestationKeyId(e.target.value)}
          placeholder="UUID from Add attestation key tab"
          disabled={finalizing || isFinalized}
        />

        <TextArea
          id="finalize-attestation-cert"
          labelText="Attestation Certificate PEM (Optional)"
          value={attestationCertPEM}
          onChange={(e) => setAttestationCertPEM(e.target.value)}
          rows={8}
          disabled={finalizing || isFinalized}
          placeholder="Paste certificate PEM if attestation key should be encrypted during finalization"
        />

        <div className="workflow-inline-actions">
          <Button
            kind="secondary"
            onClick={loadContextFromSession}
            disabled={finalizing || isFinalized}
          >
            Load From Key Tabs
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
    </div>
  );
};

export default FinaliseContract;
