import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  CodeSnippet,
  FileUploader,
  InlineNotification,
  PasswordInput,
  Tag,
  Tile,
} from '@carbon/react';
import { Renew } from '@carbon/icons-react';
import buildService from '../services/buildService';
import { formatDate } from '../utils/formatters';

const FINAL_BUILD_STATUSES = new Set(['FINALIZED', 'CONTRACT_DOWNLOADED']);
const UPLOAD_ALLOWED_STATES = new Set(['PENDING_UPLOAD', 'REJECTED']);
const AUDITOR_CONTEXT_KEY_PREFIX = 'auditor_v2_';

const parseEventData = (rawEventData) => {
  if (!rawEventData) return {};
  if (typeof rawEventData === 'object') return rawEventData;
  if (typeof rawEventData !== 'string') return {};
  try {
    return JSON.parse(rawEventData);
  } catch (_) {
    return {};
  }
};

const findLatestEvidenceId = (events = []) => {
  const sortedEvents = [...events].sort((a, b) => (a.sequence_no || 0) - (b.sequence_no || 0));
  for (let i = sortedEvents.length - 1; i >= 0; i -= 1) {
    const event = sortedEvents[i];
    if (event?.event_type !== 'ATTESTATION_EVIDENCE_UPLOADED') continue;
    const eventData = parseEventData(event.event_data);
    const id = eventData?.evidence_id || eventData?.evidenceId;
    if (typeof id === 'string' && id.trim()) {
      return id.trim();
    }
  }
  return '';
};

const STATUS_TAG_TYPE = {
  PENDING_UPLOAD: 'gray',
  UPLOADED: 'cyan',
  VERIFIED: 'green',
  REJECTED: 'red',
};

const AttestationEvidenceSection = ({ buildId, buildStatus: buildStatusProp, mode = 'upload' }) => {
  const [liveBuildStatus, setLiveBuildStatus] = useState(buildStatusProp || '');
  const [attestationStatus, setAttestationStatus] = useState(null);
  const [latestEvidenceId, setLatestEvidenceId] = useState('');
  const [loadingContext, setLoadingContext] = useState(true);

  const [recordsFile, setRecordsFile] = useState(null);
  const [signatureFile, setSignatureFile] = useState(null);
  const [uploaderVersion, setUploaderVersion] = useState(0);

  const [uploadResult, setUploadResult] = useState(null);
  const [verifyResult, setVerifyResult] = useState(null);
  const [attestationKeyPassphrase, setAttestationKeyPassphrase] = useState('');

  const [uploading, setUploading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const isUploadMode = mode === 'upload';
  const title = isUploadMode ? 'Upload Attestation Records' : 'Verify Attestation Records';
  const description = isUploadMode
    ? 'Data Owner or Environment Operator can upload attestation records and signature files after contract download.'
    : 'Auditor verification uses backend HpcrGetAttestationRecords() and HpcrVerifySignatureAttestationRecords().';

  const buildStatusUpper = String(liveBuildStatus || '').toUpperCase();
  const attestationState = String(
    attestationStatus?.attestation_state || attestationStatus?.state || 'PENDING_UPLOAD'
  ).toUpperCase();
  const latestVerdict = String(attestationStatus?.latest_verdict || '').toUpperCase();
  const buildReady = FINAL_BUILD_STATUSES.has(buildStatusUpper);
  const uploadStageReady = buildStatusUpper === 'CONTRACT_DOWNLOADED';

  const canUpload = useMemo(
    () => uploadStageReady && UPLOAD_ALLOWED_STATES.has(attestationState),
    [uploadStageReady, attestationState]
  );

  const canVerify = useMemo(
    () => buildReady && attestationState === 'UPLOADED' && Boolean(latestEvidenceId),
    [buildReady, attestationState, latestEvidenceId]
  );

  useEffect(() => {
    setLiveBuildStatus(buildStatusProp || '');
  }, [buildStatusProp]);

  const loadContext = useCallback(async () => {
    setLoadingContext(true);
    try {
      const [build, status, auditEvents] = await Promise.all([
        buildService.getBuild(buildId),
        buildService.getAttestationStatus(buildId),
        buildService.getAuditEvents(buildId),
      ]);
      setLiveBuildStatus(build?.status || '');
      setAttestationStatus(status || null);
      setLatestEvidenceId(findLatestEvidenceId(auditEvents));
    } catch (err) {
      setError(`Failed to load attestation status: ${err.message}`);
    } finally {
      setLoadingContext(false);
    }
  }, [buildId]);

  useEffect(() => {
    loadContext();
  }, [loadContext]);

  useEffect(() => {
    if (isUploadMode) return;
    try {
      const raw = sessionStorage.getItem(`${AUDITOR_CONTEXT_KEY_PREFIX}${buildId}`);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const savedPassphrase = typeof parsed?.attestation_key_passphrase === 'string'
        ? parsed.attestation_key_passphrase
        : '';
      if (savedPassphrase) {
        setAttestationKeyPassphrase(savedPassphrase);
      }
    } catch (_) {
      // no-op
    }
  }, [buildId, isUploadMode]);

  const handleUpload = async () => {
    if (!recordsFile || !signatureFile) {
      setError('Please select both attestation records and signature files.');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);
    setUploadResult(null);
    try {
      const result = await buildService.uploadAttestationEvidence(buildId, {
        recordsFile,
        signatureFile,
      });
      setUploadResult(result);
      setSuccess('Attestation evidence uploaded successfully.');
      setRecordsFile(null);
      setSignatureFile(null);
      setUploaderVersion((prev) => prev + 1);
      await loadContext();
    } catch (err) {
      setError(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleVerify = async () => {
    if (!latestEvidenceId) {
      setError('No uploaded evidence was found to verify.');
      return;
    }

    setVerifying(true);
    setError(null);
    setSuccess(null);
    setVerifyResult(null);
    try {
      const result = await buildService.verifyAttestationEvidence(
        buildId,
        latestEvidenceId,
        attestationKeyPassphrase.trim()
      );
      setVerifyResult(result);
      const verdict = String(result?.verdict || 'UNKNOWN').toUpperCase();
      const reason = String(result?.details?.reason || '').trim();
      if (verdict === 'REJECTED') {
        setError(reason ? `Verification rejected: ${reason}` : 'Verification rejected.');
      } else {
        setSuccess(`Verification completed with verdict: ${verdict}.`);
      }
      await loadContext();
    } catch (err) {
      setError(`Verification failed: ${err.message}`);
    } finally {
      setVerifying(false);
    }
  };

  const verificationDetails = verifyResult?.details || attestationStatus?.last_result?.details || {};
  const verificationVerdict = String(verifyResult?.verdict || latestVerdict || '').toUpperCase();
  const verificationReason = String(verificationDetails?.reason || '').trim();
  const verificationTime =
    verifyResult?.verified_at
    || attestationStatus?.verified_at
    || attestationStatus?.last_result?.created_at;

  return (
    <div className="attestation-evidence-section">
      <h3 className="workflow-title">{title}</h3>
      <p className="workflow-description">{description}</p>

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

      <Tile className="workflow-complete-tile">
        <div className="workflow-complete-tile__row">
          <div>
            <strong>Attestation Status</strong>
            <div className="workflow-complete-tile__meta">Build status: {liveBuildStatus || 'Unknown'}</div>
          </div>
          <Tag type={STATUS_TAG_TYPE[attestationState] || 'gray'} className="workflow-complete-tile__tag">
            {attestationState || 'UNKNOWN'}
          </Tag>
        </div>
        <div className="attestation-evidence-meta">
          <div className="attestation-evidence-meta__item">
            <span className="attestation-evidence-meta__label">Evidence count</span>
            <strong>{attestationStatus?.evidence_count ?? 0}</strong>
          </div>
          <div className="attestation-evidence-meta__item">
            <span className="attestation-evidence-meta__label">Latest verdict</span>
            <strong>{verificationVerdict || 'N/A'}</strong>
          </div>
          <div className="attestation-evidence-meta__item">
            <span className="attestation-evidence-meta__label">Verified at</span>
            <strong>{verificationTime ? formatDate(verificationTime) : 'N/A'}</strong>
          </div>
        </div>
        {latestEvidenceId && (
          <div className="attestation-evidence-id">
            <p className="workflow-help-text">Latest uploaded evidence ID</p>
            <CodeSnippet type="single" feedback="Copied">
              {latestEvidenceId}
            </CodeSnippet>
          </div>
        )}
      </Tile>

      <div className="workflow-step-card">
        <h4 className="workflow-step-heading">
          {isUploadMode ? 'Upload Evidence Files' : 'Run Attestation Verification'}
          {isUploadMode && !uploadStageReady && <Tag type="gray" size="sm">Wait for CONTRACT_DOWNLOADED</Tag>}
          {!isUploadMode && !buildReady && <Tag type="gray" size="sm">Wait for FINALIZED</Tag>}
        </h4>
        {isUploadMode && !uploadStageReady && (
          <p className="workflow-help-text">
            Upload becomes available when build status is CONTRACT_DOWNLOADED.
          </p>
        )}
        {!isUploadMode && !buildReady && (
          <p className="workflow-help-text">
            This action becomes available when build status is FINALIZED or CONTRACT_DOWNLOADED.
          </p>
        )}

        {isUploadMode ? (
          <>
            <div className="attestation-evidence-uploaders">
              <div>
                <FileUploader
                  key={`attestation-records-${uploaderVersion}`}
                  labelTitle="Attestation records file"
                  labelDescription="Upload encrypted attestation records"
                  buttonLabel="Choose records file"
                  filenameStatus="edit"
                  onChange={(e) => setRecordsFile(e.target.files?.[0] || null)}
                  disabled={uploading || !canUpload}
                />
                {recordsFile && <p className="workflow-upload-meta">{recordsFile.name}</p>}
              </div>

              <div>
                <FileUploader
                  key={`attestation-signature-${uploaderVersion}`}
                  labelTitle="Signature file"
                  labelDescription="Upload signature for attestation records"
                  buttonLabel="Choose signature file"
                  filenameStatus="edit"
                  onChange={(e) => setSignatureFile(e.target.files?.[0] || null)}
                  disabled={uploading || !canUpload}
                />
                {signatureFile && <p className="workflow-upload-meta">{signatureFile.name}</p>}
              </div>
            </div>

            <div className="attestation-evidence-actions">
              <Button
                kind="primary"
                onClick={handleUpload}
                disabled={uploading || !canUpload || !recordsFile || !signatureFile}
              >
                {uploading ? 'Uploading...' : 'Upload Attestation Evidence'}
              </Button>
              <Button kind="ghost" renderIcon={Renew} onClick={loadContext} disabled={loadingContext}>
                Refresh Status
              </Button>
            </div>

            {!UPLOAD_ALLOWED_STATES.has(attestationState) && buildReady && (
              <p className="workflow-help-text">
                Upload is allowed when attestation state is PENDING_UPLOAD or REJECTED.
              </p>
            )}

            {uploadResult?.evidence_id && (
              <div className="attestation-evidence-id">
                <p className="workflow-help-text">Uploaded evidence ID</p>
                <CodeSnippet type="single" feedback="Copied">{uploadResult.evidence_id}</CodeSnippet>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="workflow-step-copy">
              The auditor verifies the most recently uploaded attestation evidence for this build.
            </p>
            <PasswordInput
              id="attestation-verify-passphrase"
              labelText="Attestation Key Passphrase"
              placeholder="Enter attestation key passphrase"
              helperText="Required when the attestation private key is encrypted."
              value={attestationKeyPassphrase}
              onChange={(e) => setAttestationKeyPassphrase(e.target.value)}
              autoComplete="new-password"
              className="workflow-input--password"
              disabled={verifying || !canVerify}
            />
            <div className="attestation-evidence-actions">
              <Button kind="primary" onClick={handleVerify} disabled={verifying || !canVerify}>
                {verifying ? 'Verifying...' : 'Verify Attestation Evidence'}
              </Button>
              <Button kind="ghost" renderIcon={Renew} onClick={loadContext} disabled={loadingContext}>
                Refresh Status
              </Button>
            </div>
            {!latestEvidenceId && (
              <p className="workflow-help-text">
                No attestation evidence found yet. Wait for Data Owner or Environment Operator upload.
              </p>
            )}
            {attestationState !== 'UPLOADED' && latestEvidenceId && (
              <p className="workflow-help-text">
                Verification requires attestation state UPLOADED. Current state: {attestationState}.
              </p>
            )}
            {(verifyResult || attestationStatus?.last_result?.details) && (
              <div className="attestation-evidence-results">
                <Tag type={verificationVerdict === 'VERIFIED' ? 'green' : verificationVerdict === 'REJECTED' ? 'red' : 'gray'}>
                  {verificationVerdict || 'N/A'}
                </Tag>
                {'records_decrypted' in verificationDetails && (
                  <p className="workflow-help-text">Records decrypted: {String(Boolean(verificationDetails.records_decrypted))}</p>
                )}
                {'signature_valid' in verificationDetails && (
                  <p className="workflow-help-text">Signature valid: {String(Boolean(verificationDetails.signature_valid))}</p>
                )}
                {verificationDetails.records_hash && (
                  <div className="attestation-evidence-id">
                    <p className="workflow-help-text">Records hash (SHA-256)</p>
                    <CodeSnippet type="single" feedback="Copied">{String(verificationDetails.records_hash)}</CodeSnippet>
                  </div>
                )}
                {verificationReason && (
                  <div className="attestation-evidence-contractgo-error">
                    <p className="attestation-evidence-contractgo-error__label">contract-go error</p>
                    <CodeSnippet type="multi" feedback="Copied">
                      {verificationReason}
                    </CodeSnippet>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AttestationEvidenceSection;
