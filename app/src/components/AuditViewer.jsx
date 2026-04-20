import React, { useState, useEffect, useMemo } from 'react';
import {
  Tag,
  Accordion,
  AccordionItem,
  Button,
  InlineNotification,
  CodeSnippet,
  Tile,
  Loading,
  Toggle,
  Modal
} from '@carbon/react';
import {
  CheckmarkFilled,
  ErrorFilled,
  WarningAlt,
  Renew,
  Link as LinkIcon,
  Information
} from '@carbon/icons-react';
import { useBuildStore } from '../store/buildStore';
import buildService from '../services/buildService';
import verificationService from '../services/verificationService';
import { formatDate } from '../utils/formatters';

const EVENT_META = {
  BUILD_CREATED: { tagType: 'blue', tagLabel: 'Created', title: 'Build Created' },
  SIGNING_KEY_CREATED: { tagType: 'purple', tagLabel: 'Signing Key', title: 'Signing Key Created' },
  WORKLOAD_SUBMITTED: { tagType: 'green', tagLabel: 'Workload', title: 'Workload Submitted' },
  ENVIRONMENT_STAGED: { tagType: 'teal', tagLabel: 'Environment', title: 'Environment Staged' },
  ATTESTATION_KEY_REGISTERED: { tagType: 'purple', tagLabel: 'Attestation', title: 'Attestation Key Registered' },
  BUILD_FINALIZED: { tagType: 'magenta', tagLabel: 'Finalized', title: 'Build Finalized' },
  CONTRACT_DOWNLOADED: { tagType: 'gray', tagLabel: 'Downloaded', title: 'Contract Downloaded' },
  ATTESTATION_EVIDENCE_UPLOADED: { tagType: 'cyan', tagLabel: 'Evidence', title: 'Attestation Evidence Uploaded' },
  ATTESTATION_VERIFIED: { tagType: 'green', tagLabel: 'Verified', title: 'Attestation Verified' },
  BUILD_CANCELLED: { tagType: 'red', tagLabel: 'Cancelled', title: 'Build Cancelled' },
  ROLE_ASSIGNED: { tagType: 'cyan', tagLabel: 'Assignment', title: 'Role Assigned' },
  // Deprecated v1 event types (for backward compat with existing builds)
  AUDITOR_KEYS_REGISTERED: { tagType: 'purple', tagLabel: 'Attestation (v1)', title: 'Auditor Keys Registered' },
  CONTRACT_ASSEMBLED: { tagType: 'cyan', tagLabel: 'Assembly (v1)', title: 'Contract Assembled' },
};

const ASSIGNMENT_ROLE_LABELS = {
  SOLUTION_PROVIDER: 'Solution Provider Assigned',
  DATA_OWNER: 'Data Owner Assigned',
  AUDITOR: 'Auditor Assigned',
  ENV_OPERATOR: 'Environment Operator Assigned',
  ADMIN: 'Administrator Assigned',
  VIEWER: 'Viewer Assigned'
};

const EVENT_TYPES_REQUIRING_SIGNATURE = new Set([
  'BUILD_CREATED',
  'SIGNING_KEY_CREATED',
  'WORKLOAD_SUBMITTED',
  'ENVIRONMENT_STAGED',
  'ATTESTATION_KEY_REGISTERED',
  'BUILD_FINALIZED',
  'CONTRACT_DOWNLOADED',
  'ATTESTATION_EVIDENCE_UPLOADED',
  'ATTESTATION_VERIFIED',
]);

const VERIFIABLE_EVENT_TYPES = new Set([
  'BUILD_CREATED',
  'SIGNING_KEY_CREATED',
  'WORKLOAD_SUBMITTED',
  'ENVIRONMENT_STAGED',
  'ATTESTATION_KEY_REGISTERED',
  'BUILD_FINALIZED',
  'CONTRACT_DOWNLOADED',
  'ATTESTATION_EVIDENCE_UPLOADED',
  'ATTESTATION_VERIFIED',
]);

const STAGE_VERIFY_CONFIG = [
  {
    eventType: 'SIGNING_KEY_CREATED',
    title: 'Signing Key Created',
    description: 'Confirms the signing key registration event is linked correctly in the audit chain.',
    requiresSignature: true,
    personaRole: 'AUDITOR'
  },
  {
    eventType: 'WORKLOAD_SUBMITTED',
    title: 'Workload Submitted',
    description: 'Confirms the workload submission event is linked correctly in the audit chain.',
    requiresSignature: true,
    personaRole: 'SOLUTION_PROVIDER'
  },
  {
    eventType: 'ENVIRONMENT_STAGED',
    title: 'Environment Staged',
    description: 'Confirms the environment stage event is linked correctly in the audit chain.',
    requiresSignature: true,
    personaRole: 'DATA_OWNER'
  },
  {
    eventType: 'ATTESTATION_KEY_REGISTERED',
    title: 'Attestation Key Registered',
    description: 'Confirms attestation key registration is linked correctly in the audit chain.',
    requiresSignature: true,
    personaRole: 'AUDITOR'
  },
  {
    eventType: 'BUILD_FINALIZED',
    title: 'Build Finalized',
    description: 'Confirms the finalization event is linked correctly and signature validation succeeds.',
    requiresSignature: true,
    personaRole: 'AUDITOR'
  },
  {
    eventType: 'CONTRACT_DOWNLOADED',
    title: 'Contract Downloaded',
    description: 'Confirms contract download acknowledgment is linked correctly and signature validation succeeds.',
    requiresSignature: true,
    personaRole: 'ENV_OPERATOR'
  }
];

const buildHashLinkCheckCommand = (currentEvent, previousEvent) => {
  if (!currentEvent) {
    return 'This stage event is not available in the audit trail yet.';
  }

  if (!previousEvent) {
    return 'No previous event found. Hash-link check needs this event and the one immediately before it.';
  }

  return [
    `PREVIOUS_EVENT_HASH="${currentEvent.previous_event_hash || '<missing_previous_hash>'}"`,
    `EXPECTED_HASH="${previousEvent.event_hash || '<missing_event_hash>'}"`,
    '[ "$PREVIOUS_EVENT_HASH" = "$EXPECTED_HASH" ] && echo "PASS: hash link is correct" || echo "FAIL: hash link mismatch"'
  ].join('\n');
};

const buildSignatureCheckCommand = (event) => {
  if (!event?.signature) return null;

  return [
    `# Use values copied from Event #${event.sequence_no}`,
    `EVENT_HASH="${event.event_hash || '<event_hash>'}"`,
    '',
    '# 1) Paste Signature value into event-signature.b64',
    '# 2) Save the matching actor public key as actor-public.pem',
    'openssl base64 -d -A -in event-signature.b64 -out event-signature.bin',
    'printf \'%s\' "$EVENT_HASH" > event-hash.txt',
    'openssl dgst -sha256 -verify actor-public.pem -signature event-signature.bin event-hash.txt',
    'echo "If you see \\"Verified OK\\", signature validation passed."'
  ].join('\n');
};

/**
 * AuditViewer Component
 * Displays audit trail with hash chain visualization and verification
 * Features: Timeline, hash chain, actor fingerprints, verification status
 */
const AuditViewer = ({ buildId, userRole = 'VIEWER' }) => {
  const { getBuildVerificationResult } = useBuildStore();

  const [auditEvents, setAuditEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Verification state
  const [verificationResult, setVerificationResult] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showVerifyInfo, setShowVerifyInfo] = useState(false);
  const [showStageVerifyInfo, setShowStageVerifyInfo] = useState(false);
  const [selectedStageType, setSelectedStageType] = useState(null);

  // Display options
  const [showHashChain, setShowHashChain] = useState(true);
  const [showSignatures, setShowSignatures] = useState(false);

  const getAssignmentRoleName = (event) => {
    const role = event?.event_data?.role_name
      || event?.event_data?.persona_role
      || event?.event_data?.assigned_role
      || event?.event_data?.role;
    return typeof role === 'string' ? role.toUpperCase() : '';
  };

  const formatEventTitle = (eventOrType) => {
    const eventType = typeof eventOrType === 'string'
      ? eventOrType
      : eventOrType?.event_type;
    if (!eventType) return 'Unknown';

    if (eventType === 'ROLE_ASSIGNED' && typeof eventOrType === 'object') {
      const assignmentRole = getAssignmentRoleName(eventOrType);
      if (assignmentRole && ASSIGNMENT_ROLE_LABELS[assignmentRole]) {
        return ASSIGNMENT_ROLE_LABELS[assignmentRole];
      }
    }

    if (EVENT_META[eventType]?.title) return EVENT_META[eventType].title;
    return (eventType || 'UNKNOWN')
      .toLowerCase()
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  const sortedAuditEvents = useMemo(
    () => [...auditEvents].sort((a, b) => (a.sequence_no || 0) - (b.sequence_no || 0)),
    [auditEvents]
  );

  const hasVerifiableEvents = sortedAuditEvents.some((event) =>
    VERIFIABLE_EVENT_TYPES.has(event.event_type)
  );
  const canVerify = hasVerifiableEvents && !isVerifying;

  const verifyInfoContext = useMemo(() => {
    const firstEvent = sortedAuditEvents[0] || null;
    const lastEvent = sortedAuditEvents[sortedAuditEvents.length - 1] || null;
    const previousEvent = sortedAuditEvents.length > 1
      ? sortedAuditEvents[sortedAuditEvents.length - 2]
      : null;
    const lastSignedEvent = [...sortedAuditEvents].reverse().find((event) => !!event.signature) || null;
    const sampleSequence = lastSignedEvent?.sequence_no ?? '<sequence_no>';
    const sampleFingerprint = lastSignedEvent?.actor_key_fingerprint || '<actor_key_fingerprint>';

    const hashLinkCheckCommand = previousEvent && lastEvent
      ? [
          `PREVIOUS_EVENT_HASH="${lastEvent.previous_event_hash || '<missing_previous_hash>'}"`,
          `EXPECTED_HASH="${previousEvent.event_hash || '<missing_event_hash>'}"`,
          '[ "$PREVIOUS_EVENT_HASH" = "$EXPECTED_HASH" ] && echo "PASS: hash link is correct" || echo "FAIL: hash link mismatch"'
        ].join('\n')
      : 'Need at least two events to run the hash-link check.';

    const manualSignatureCommand = buildSignatureCheckCommand(lastSignedEvent)
      || 'No signed events available yet. Run this check after a signed event appears.';

    const keyFingerprintCheckCommand = lastSignedEvent
      ? [
          `# Use the actor public key for Event #${sampleSequence} in actor-public.pem`,
          `EXPECTED_FINGERPRINT="${sampleFingerprint}"`,
          'ACTUAL_FINGERPRINT=$(openssl pkey -pubin -in actor-public.pem -outform DER \\',
          '  | openssl dgst -sha256 -binary \\',
          '  | xxd -p -c 256 \\',
          '  | tr \'[:lower:]\' \'[:upper:]\' \\',
          '  | sed -E \'s/(..)/\\1:/g; s/:$//\')',
          '',
          'echo "Expected: $EXPECTED_FINGERPRINT"',
          'echo "Actual:   $ACTUAL_FINGERPRINT"',
          '[ "$EXPECTED_FINGERPRINT" = "$ACTUAL_FINGERPRINT" ] && echo "PASS: actor key matches event" || echo "FAIL: actor key mismatch"'
        ].join('\n')
      : 'No signed events available yet. Run this check after a signed event appears.';

    return {
      firstEvent,
      lastEvent,
      previousEvent,
      lastSignedEvent,
      hashLinkCheckCommand,
      keyFingerprintCheckCommand,
      manualSignatureCommand
    };
  }, [sortedAuditEvents]);

  const stageVerificationGuides = useMemo(() => (
    STAGE_VERIFY_CONFIG.map((stage) => {
      const stageEvent = [...sortedAuditEvents]
        .reverse()
        .find((event) => event.event_type === stage.eventType) || null;

      if (!stageEvent) {
        return {
          ...stage,
          stageEvent: null,
          previousEvent: null,
          hashLinkCheckCommand: buildHashLinkCheckCommand(null, null),
          signatureCheckCommand: null,
          signatureCheckStatusMessage: 'This stage signature check will be available once the stage event is recorded.',
        };
      }

      const stageIndex = sortedAuditEvents.findIndex((event) => {
        if (event?.id != null && stageEvent?.id != null) {
          return event.id === stageEvent.id;
        }
        return event?.sequence_no === stageEvent?.sequence_no
          && event?.event_type === stageEvent?.event_type;
      });
      const previousEvent = stageIndex > 0 ? sortedAuditEvents[stageIndex - 1] : null;
      const hashLinkCheckCommand = buildHashLinkCheckCommand(stageEvent, previousEvent);

      const signatureCheckCommand = stage.requiresSignature
        ? buildSignatureCheckCommand(stageEvent)
        : null;
      const signatureCheckStatusMessage = stage.requiresSignature
        ? (
          signatureCheckCommand
            ? ''
            : 'No signature is present on this stage event. Signature verification cannot be completed.'
        )
        : 'Signature verification is not configured for this stage.';

      return {
        ...stage,
        stageEvent,
        previousEvent,
        hashLinkCheckCommand,
        signatureCheckCommand,
        signatureCheckStatusMessage
      };
    })
  ), [sortedAuditEvents]);

  const selectedStageGuide = useMemo(
    () => stageVerificationGuides.find((stage) => stage.eventType === selectedStageType) || null,
    [selectedStageType, stageVerificationGuides]
  );

  const visibleStageVerificationGuides = useMemo(
    () => stageVerificationGuides.filter((stage) => stage.personaRole === userRole),
    [stageVerificationGuides, userRole]
  );

  const hasVisibleStageGuides = visibleStageVerificationGuides.length > 0;

  useEffect(() => {
    loadAuditEvents();

    // Load cached verification result
    const cached = getBuildVerificationResult(buildId);
    if (cached) {
      setVerificationResult(cached);
    }
  }, [buildId]);

  useEffect(() => {
    if (!canVerify && showVerifyInfo) {
      setShowVerifyInfo(false);
    }
  }, [canVerify, showVerifyInfo]);

  useEffect(() => {
    if (!selectedStageType) return;
    const stageStillVisible = visibleStageVerificationGuides
      .some((stage) => stage.eventType === selectedStageType);
    if (!stageStillVisible) {
      setShowStageVerifyInfo(false);
      setSelectedStageType(null);
    }
  }, [selectedStageType, visibleStageVerificationGuides]);

  const loadAuditEvents = async () => {
    setLoading(true);
    setError(null);

    try {
      const events = await buildService.getAuditTrail(buildId);
      setAuditEvents(events);
    } catch (err) {
      setError(`Failed to load audit events: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!canVerify) return;

    setIsVerifying(true);
    setError(null);

    try {
      const [auditResult, contractResult] = await Promise.all([
        verificationService.verifyAuditChain(buildId),
        verificationService.verifyContractIntegrity(buildId),
      ]);
      // Normalize backend response to display shape
      const normalized = {
        overall: {
          valid: auditResult.is_valid && contractResult.valid,
          errors: [
            ...(auditResult.failed_events || []).map(e => e.details || e.failure_type),
            ...(contractResult.valid ? [] : (contractResult.errors || [contractResult.details || 'Contract integrity verification failed']))
          ]
        },
        auditChain: {
          valid: auditResult.chain_intact,
          totalEvents: auditResult.total_events,
          verifiedEvents: auditResult.verified_events
        },
        contractIntegrity: {
          valid: contractResult.valid,
          details: contractResult.details,
          hashMatches: contractResult.hash_matches,
          signatureValid: contractResult.signature_valid
        },
        hashChain: {
          valid: auditResult.chain_intact,
          totalEvents: auditResult.total_events,
          verifiedEvents: auditResult.verified_events,
          errors: (auditResult.failed_events || []).map(e => ({
            ...e,
            sequence: e.sequence_no
          }))
        },
        signatures: auditResult.signatures_valid
          ? [{ valid: true }]
          : (auditResult.failed_events || [])
              .filter(e => e.failure_type === 'signature_invalid' || e.failure_type === 'missing_signature')
              .map(e => ({ valid: false, details: e.details }))
      };
      setVerificationResult(normalized);

      if (!normalized.overall.valid) {
        const errMsgs = [
          ...(auditResult.failed_events || []).map(e => `#${e.sequence_no}: ${e.failure_type}`),
          ...(contractResult.valid ? [] : [`contract: ${contractResult.details || 'integrity check failed'}`]),
        ];
        setError(`Verification failed: ${errMsgs.join(', ')}`);
      }
    } catch (err) {
      setError(`Verification failed: ${err.message}`);
    } finally {
      setIsVerifying(false);
    }
  };

  const getEventTypeTag = (eventType) => {
    const config = EVENT_META[eventType]
      ? { type: EVENT_META[eventType].tagType, label: EVENT_META[eventType].tagLabel }
      : { type: 'gray', label: formatEventTitle(eventType) };
    return <Tag type={config.type}>{config.label}</Tag>;
  };

  const getVerificationStatusTag = (isValid) => {
    return isValid ? (
      <Tag type="green" renderIcon={CheckmarkFilled}>Valid</Tag>
    ) : (
      <Tag type="red" renderIcon={ErrorFilled}>Invalid</Tag>
    );
  };

  const formatHash = (hash) => {
    if (!hash) return 'N/A';
    return `${hash.substring(0, 8)}...${hash.substring(hash.length - 8)}`;
  };

  const formatFingerprint = (fingerprint) => {
    if (!fingerprint) return 'N/A';
    return fingerprint.substring(0, 16) + '...';
  };

  const renderHashChain = () => {
    if (!showHashChain || auditEvents.length === 0) return null;

    return (
      <div className="hash-chain">
        <h5>Hash Chain Visualization</h5>
        <div className="chain-container">
          <div className="chain-item genesis">
            <div className="chain-node">
                  <span className="node-label">Start</span>
              <CodeSnippet type="inline" feedback="Copied">
                {formatHash(auditEvents[0]?.previous_event_hash || 'N/A')}
              </CodeSnippet>
            </div>
          </div>

          {auditEvents.map((event) => (
            <React.Fragment key={event.id}>
              <div className="chain-link">
                <LinkIcon size={16} />
              </div>
              <div className="chain-item">
                <div className="chain-node">
                  <span className="node-label node-label--secondary">
                    #{event.sequence_no} · {formatEventTitle(event)}
                  </span>
                  <CodeSnippet type="inline" feedback="Copied">
                    {formatHash(event.event_hash)}
                  </CodeSnippet>
                  {verificationResult?.hashChain?.errors?.some(e => e.sequence === event.sequence_no) && (
                    <ErrorFilled size={16} className="error-icon" />
                  )}
                </div>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  };

  const renderVerificationSummary = () => {
    if (!verificationResult) return null;

    const { overall, auditChain, contractIntegrity, hashChain, signatures } = verificationResult;

    return (
      <Tile className="verification-summary">
        <div className="summary-header">
          <h5>Verification Summary</h5>
          {getVerificationStatusTag(overall.valid)}
        </div>

        <div className="verification-checks">
          <div className="check-item">
            <span className="check-label">Audit Chain:</span>
            {getVerificationStatusTag(auditChain?.valid)}
          </div>
          <div className="check-item">
            <span className="check-label">Contract Integrity:</span>
            {getVerificationStatusTag(contractIntegrity?.valid)}
          </div>
          <div className="check-item">
            <span className="check-label">Hash Chain:</span>
            {getVerificationStatusTag(hashChain?.valid)}
          </div>
          <div className="check-item">
            <span className="check-label">Signatures:</span>
            {getVerificationStatusTag(signatures?.every(s => s.valid))}
          </div>
        </div>

        {overall.errors.length > 0 && (
          <InlineNotification
            kind="error"
            title="Verification Errors"
            subtitle={`${overall.errors.length} error(s) found`}
            lowContrast
          />
        )}

        <div className="verification-stats">
          <span>Total Events: {hashChain?.totalEvents || 0}</span>
          <span>Verified: {hashChain?.verifiedEvents || 0}</span>
          <span>Valid Signatures: {signatures?.filter(s => s.valid).length || 0}/{signatures?.length || 0}</span>
        </div>
      </Tile>
    );
  };

  const renderStageVerificationGuides = () => (
    <div className="audit-stage-guides">
      <h5 className="audit-stage-guides__title">Stage Verification Guides</h5>
      <div className="audit-stage-guides__grid">
        {visibleStageVerificationGuides.map((stage) => (
          <Tile key={stage.eventType} className="audit-stage-guide">
            <div className="audit-stage-guide__header">
              <div className="audit-stage-guide__meta">
                <h6>{stage.title}</h6>
                <p>{stage.description}</p>
              </div>
              <Tag type={stage.stageEvent ? 'green' : 'gray'}>
                {stage.stageEvent ? `Event #${stage.stageEvent.sequence_no}` : 'Pending'}
              </Tag>
            </div>
            <p className="audit-stage-guide__expectation">
              Hash-chain + signature check
            </p>
            <Button
              kind="ghost"
              size="sm"
              renderIcon={Information}
              onClick={() => {
                setSelectedStageType(stage.eventType);
                setShowStageVerifyInfo(true);
              }}
            >
              How to verify this stage
            </Button>
          </Tile>
        ))}
      </div>
    </div>
  );

  const renderEventDetails = (event) => {
    return (
      <div className="event-details">
        <div className="detail-section">
          <h6>Event Information</h6>
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-label">Sequence:</span>
              <span className="detail-value">{event.sequence_no}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Type:</span>
              <span className="detail-value">{event.event_type}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Timestamp:</span>
              <span className="detail-value">
                {formatDate(event.created_at, { second: '2-digit', timeZoneName: 'short' })}
              </span>
            </div>
          </div>
        </div>

        <div className="detail-section">
          <h6>Actor Information</h6>
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-label">User:</span>
              <span className="detail-value">{event.actor_name || 'N/A'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Key Fingerprint:</span>
              <CodeSnippet type="inline" feedback="Copied">
                {formatFingerprint(event.actor_key_fingerprint)}
              </CodeSnippet>
            </div>
          </div>
        </div>

        {showHashChain && (
          <div className="detail-section">
            <h6>Hash Chain</h6>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Previous Hash:</span>
                <CodeSnippet type="inline" feedback="Copied">
                  {formatHash(event.previous_event_hash)}
                </CodeSnippet>
              </div>
              <div className="detail-item">
                <span className="detail-label">Event Hash:</span>
                <CodeSnippet type="inline" feedback="Copied">
                  {formatHash(event.event_hash)}
                </CodeSnippet>
              </div>
            </div>
          </div>
        )}

        {showSignatures && (event.signature || EVENT_TYPES_REQUIRING_SIGNATURE.has(event.event_type)) && (
          <div className="detail-section">
            <h6>Cryptographic Signature</h6>
            {event.signature ? (
              <CodeSnippet type="multi" feedback="Copied">
                {event.signature}
              </CodeSnippet>
            ) : (
              EVENT_TYPES_REQUIRING_SIGNATURE.has(event.event_type) ? (
                <InlineNotification
                  kind="warning"
                  title="Missing Signature"
                  subtitle={`Event type "${formatEventTitle(event)}" should be signed, but signature is missing.`}
                  lowContrast
                  hideCloseButton
                />
              ) : null
            )}
          </div>
        )}

        {event.event_data && (
          <div className="detail-section">
            <h6>Event Data</h6>
            <CodeSnippet type="multi" feedback="Copied">
              {JSON.stringify(event.event_data, null, 2)}
            </CodeSnippet>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="audit-viewer">
      {error && (
        <InlineNotification
          kind="error"
          title="Error"
          subtitle={error}
          onCloseButtonClick={() => setError(null)}
          lowContrast
        />
      )}

      <div className="viewer-header">
        <div className="header-content">
          <h4>Audit Trail</h4>
          <div className="header-actions">
            <Toggle
              id="show-hash-chain"
              labelText="Show Hash Chain"
              size="sm"
              toggled={showHashChain}
              onToggle={setShowHashChain}
            />
            <Toggle
              id="show-signatures"
              labelText="Show Signatures"
              size="sm"
              toggled={showSignatures}
              onToggle={setShowSignatures}
            />
            <Button
              kind="tertiary"
              size="md"
              renderIcon={Renew}
              onClick={loadAuditEvents}
              disabled={loading}
            >
              Refresh
            </Button>
            <Button
              kind="ghost"
              size="md"
              hasIconOnly
              renderIcon={Information}
              iconDescription="How verification works"
              disabled={!canVerify}
              onClick={() => setShowVerifyInfo(true)}
            />
            <Button
              kind="primary"
              size="sm"
              renderIcon={CheckmarkFilled}
              onClick={handleVerify}
              disabled={!canVerify}
            >
              {isVerifying ? 'Verifying...' : 'Verify'}
            </Button>
          </div>
        </div>
      </div>

      {renderVerificationSummary()}
      {renderHashChain()}

      <Modal
        open={showVerifyInfo}
        passiveModal
        modalHeading="How Verify Works"
        onRequestClose={() => setShowVerifyInfo(false)}
      >
        <div className="audit-viewer-verify-info">
          <p>
            This guide helps you manually confirm the same checks done by the <strong>Verify</strong> button.
            You only need values shown in this screen and a terminal.
          </p>
          {hasVisibleStageGuides && (
            <p>
              Need stage-specific instructions? Use <strong>How to verify this stage</strong> in the
              Stage Verification Guides section.
            </p>
          )}
          <p>
            Goal: confirm the event chain is linked correctly and that a signed event was signed by the expected actor key.
          </p>
          <div className="audit-viewer-verify-info__meta">
            <div>
              <strong>Build:</strong> <code>{buildId}</code>
            </div>
            <div>
              <strong>Total events:</strong> {sortedAuditEvents.length}
            </div>
            <div>
              <strong>First event:</strong>{' '}
              {verifyInfoContext.firstEvent ? `#${verifyInfoContext.firstEvent.sequence_no}` : 'N/A'}
            </div>
            <div>
              <strong>Latest event:</strong>{' '}
              {verifyInfoContext.lastEvent ? `#${verifyInfoContext.lastEvent.sequence_no}` : 'N/A'}
            </div>
            <div>
              <strong>Recommended signed event:</strong>{' '}
              {verifyInfoContext.lastSignedEvent ? `#${verifyInfoContext.lastSignedEvent.sequence_no}` : 'N/A'}
            </div>
          </div>
          <p>
            Manual verification steps:
          </p>
          <ol>
            <li>
              <strong>Check one hash-chain link.</strong>{' '}
              Compare the latest event&apos;s <code>Previous Hash</code> with the event hash just before it.
              If output says <code>PASS</code>, the chain link is valid.
            </li>
          </ol>
          <CodeSnippet type="multi" feedback="Copied">
            {verifyInfoContext.hashLinkCheckCommand}
          </CodeSnippet>
          <ol start={2}>
            <li>
              <strong>Confirm the actor public key matches the event fingerprint.</strong>{' '}
              Use the same signed event for all values. If output says <code>PASS</code>,
              the key file you are using matches that event.
            </li>
          </ol>
          <CodeSnippet type="multi" feedback="Copied">
            {verifyInfoContext.keyFingerprintCheckCommand}
          </CodeSnippet>
          <ol start={3}>
            <li>
              <strong>Validate the event signature.</strong>{' '}
              Use the same event&apos;s <code>Event Hash</code>, <code>Signature</code>, and actor public key.
              If OpenSSL prints <code>Verified OK</code>, signature validation passed.
            </li>
          </ol>
          <CodeSnippet type="multi" feedback="Copied">
            {verifyInfoContext.manualSignatureCommand}
          </CodeSnippet>
          <ol start={4}>
            <li>
              <strong>Read the result.</strong>{' '}
              If steps 1 and 2 show <code>PASS</code> and step 3 shows <code>Verified OK</code>,
              the manual verification for that event is successful.
            </li>
          </ol>
          <p>
            You can repeat steps 2 and 3 for any other signed event if you want additional spot checks.
          </p>
        </div>
      </Modal>

      <Modal
        open={showStageVerifyInfo}
        passiveModal
        modalHeading={selectedStageGuide ? `Verify: ${selectedStageGuide.title}` : 'Verify Stage'}
        onRequestClose={() => setShowStageVerifyInfo(false)}
      >
        <div className="audit-viewer-verify-info">
          {!selectedStageGuide ? (
            <p>Select a stage to view manual verification steps.</p>
          ) : (
            <>
              <p>{selectedStageGuide.description}</p>
              <div className="audit-viewer-verify-info__meta">
                <div>
                  <strong>Build:</strong> <code>{buildId}</code>
                </div>
                <div>
                  <strong>Stage status:</strong>{' '}
                  {selectedStageGuide.stageEvent ? 'Recorded' : 'Pending'}
                </div>
                <div>
                  <strong>Event number:</strong>{' '}
                  {selectedStageGuide.stageEvent ? `#${selectedStageGuide.stageEvent.sequence_no}` : 'N/A'}
                </div>
                <div>
                  <strong>Recorded at:</strong>{' '}
                  {selectedStageGuide.stageEvent
                    ? formatDate(selectedStageGuide.stageEvent.created_at, { second: '2-digit', timeZoneName: 'short' })
                    : 'N/A'}
                </div>
                <div>
                  <strong>Signature expected:</strong>{' '}
                  Yes
                </div>
              </div>

              <ol>
                <li>
                  <strong>Check this stage hash link.</strong>{' '}
                  If output says <code>PASS</code>, the stage event is correctly linked to the previous event.
                </li>
              </ol>
              <CodeSnippet type="multi" feedback="Copied">
                {selectedStageGuide.hashLinkCheckCommand}
              </CodeSnippet>

              <ol start={2}>
                <li>
                  <strong>Validate this stage signature.</strong>{' '}
                  If OpenSSL prints <code>Verified OK</code>, signature validation passed.
                </li>
              </ol>
              {selectedStageGuide.signatureCheckCommand ? (
                <CodeSnippet type="multi" feedback="Copied">
                  {selectedStageGuide.signatureCheckCommand}
                </CodeSnippet>
              ) : (
                <InlineNotification
                  kind="warning"
                  title="Signature check unavailable"
                  subtitle={selectedStageGuide.signatureCheckStatusMessage}
                  lowContrast
                  hideCloseButton
                />
              )}
            </>
          )}
        </div>
      </Modal>

      {loading ? (
        <Loading description="Loading audit events..." withOverlay={false} />
      ) : auditEvents.length === 0 ? (
        <Tile className="empty-state">
          <WarningAlt size={48} />
          <h5>No Audit Events</h5>
          <p>No audit events have been recorded for this build yet.</p>
        </Tile>
      ) : (
        <Accordion>
          {auditEvents.map((event) => (
            <AccordionItem
              key={event.id}
              title={
                <div className="event-title">
                  {getEventTypeTag(event.event_type)}
                  <span className="event-sequence">#{event.sequence_no}</span>
                  <span className="event-title-text">{formatEventTitle(event)}</span>
                  <span className="event-actor">{event.actor_name}</span>
                  <span className="event-time">
                    {formatDate(event.created_at, { second: '2-digit', timeZoneName: 'short' })}
                  </span>
                </div>
              }
            >
              {renderEventDetails(event)}
            </AccordionItem>
          ))}
        </Accordion>
      )}
      {hasVisibleStageGuides && renderStageVerificationGuides()}
    </div>
  );
};

export default AuditViewer;
