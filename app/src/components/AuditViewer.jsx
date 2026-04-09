import React, { useState, useEffect } from 'react';
import {
  Tag,
  Accordion,
  AccordionItem,
  Button,
  InlineNotification,
  CodeSnippet,
  Tile,
  Loading,
  Toggle
} from '@carbon/react';
import {
  CheckmarkFilled,
  ErrorFilled,
  WarningAlt,
  View,
  Renew,
  ChevronRight,
  Link as LinkIcon
} from '@carbon/icons-react';
import { useBuildStore } from '../store/buildStore';
import buildService from '../services/buildService';
import verificationService from '../services/verificationService';
import cryptoService from '../services/cryptoService';

/**
 * AuditViewer Component
 * Displays audit trail with hash chain visualization and verification
 * Features: Timeline, hash chain, actor fingerprints, verification status
 */
const AuditViewer = ({ buildId }) => {
  const { getBuildAuditEvents, getBuildVerificationResult } = useBuildStore();

  const [auditEvents, setAuditEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Verification state
  const [verificationResult, setVerificationResult] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Display options
  const [showHashChain, setShowHashChain] = useState(true);
  const [showSignatures, setShowSignatures] = useState(false);
  const [expandedEvents, setExpandedEvents] = useState(new Set());

  useEffect(() => {
    loadAuditEvents();

    // Load cached verification result
    const cached = getBuildVerificationResult(buildId);
    if (cached) {
      setVerificationResult(cached);
    }
  }, [buildId]);

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
    setIsVerifying(true);
    setError(null);

    try {
      const result = await verificationService.performCompleteVerification(buildId);
      setVerificationResult(result);

      if (result.overall.valid) {
        // Success notification handled by result display
      } else {
        setError(`Verification failed: ${result.overall.errors.join(', ')}`);
      }
    } catch (err) {
      setError(`Verification failed: ${err.message}`);
    } finally {
      setIsVerifying(false);
    }
  };

  const toggleEventExpansion = (eventId) => {
    setExpandedEvents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
    });
  };

  const getEventTypeTag = (eventType) => {
    const typeConfig = {
      build_created: { type: 'blue', label: 'Created' },
      assignment_created: { type: 'cyan', label: 'Assignment' },
      section_submitted: { type: 'green', label: 'Section' },
      status_changed: { type: 'purple', label: 'Status' },
      contract_exported: { type: 'teal', label: 'Export' },
      contract_downloaded: { type: 'magenta', label: 'Download' },
      verification_performed: { type: 'gray', label: 'Verification' }
    };

    const config = typeConfig[eventType] || { type: 'gray', label: eventType };
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
              <span className="node-label">Genesis</span>
              <CodeSnippet type="inline" feedback="Copied">
                {formatHash(auditEvents[0]?.previous_event_hash || 'N/A')}
              </CodeSnippet>
            </div>
          </div>

          {auditEvents.map((event, index) => (
            <React.Fragment key={event.id}>
              <div className="chain-link">
                <LinkIcon size={16} />
              </div>
              <div className="chain-item">
                <div className="chain-node">
                  <span className="node-label">Event {event.sequence_no}</span>
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
              <span className="detail-value">{new Date(event.created_at).toLocaleString()}</span>
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

        {showSignatures && event.signature && (
          <div className="detail-section">
            <h6>Cryptographic Signature</h6>
            <CodeSnippet type="multi" feedback="Copied">
              {event.signature}
            </CodeSnippet>
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
              size="sm"
              renderIcon={Renew}
              onClick={loadAuditEvents}
              disabled={loading}
            >
              Refresh
            </Button>
            <Button
              kind="primary"
              size="sm"
              renderIcon={CheckmarkFilled}
              onClick={handleVerify}
              disabled={isVerifying || auditEvents.length === 0}
            >
              {isVerifying ? 'Verifying...' : 'Verify'}
            </Button>
          </div>
        </div>
      </div>

      {renderVerificationSummary()}
      {renderHashChain()}

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
                  <span className="event-actor">{event.actor_name}</span>
                  <span className="event-time">
                    {new Date(event.created_at).toLocaleString()}
                  </span>
                </div>
              }
            >
              {renderEventDetails(event)}
            </AccordionItem>
          ))}
        </Accordion>
      )}

      <style>{`
        .audit-viewer {
          margin: 1rem 0;
        }
        
        .viewer-header {
          margin-bottom: 1rem;
        }
        
        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .header-content h4 {
          margin: 0;
        }
        
        .header-actions {
          display: flex;
          gap: 1rem;
          align-items: center;
        }
        
        .hash-chain {
          margin: 1.5rem 0;
          padding: 1rem;
          background: var(--cds-layer-01);
          border-radius: 4px;
        }
        
        .hash-chain h5 {
          margin-bottom: 1rem;
        }
        
        .chain-container {
          display: flex;
          align-items: center;
          overflow-x: auto;
          padding: 1rem 0;
        }
        
        .chain-item {
          flex-shrink: 0;
        }
        
        .chain-item.genesis .chain-node {
          background: var(--cds-support-success);
          color: white;
        }
        
        .chain-node {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          padding: 1rem;
          background: var(--cds-layer-02);
          border-radius: 4px;
          min-width: 150px;
        }
        
        .node-label {
          font-size: 0.875rem;
          font-weight: 600;
        }
        
        .chain-link {
          display: flex;
          align-items: center;
          padding: 0 0.5rem;
          color: var(--cds-text-secondary);
        }
        
        .error-icon {
          color: var(--cds-support-error);
        }
        
        .verification-summary {
          margin: 1rem 0;
          padding: 1.5rem;
        }
        
        .summary-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }
        
        .summary-header h5 {
          margin: 0;
        }
        
        .verification-checks {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 1rem;
        }
        
        .check-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem;
          background: var(--cds-layer-02);
          border-radius: 4px;
        }
        
        .check-label {
          font-weight: 600;
        }
        
        .verification-stats {
          display: flex;
          gap: 2rem;
          padding-top: 1rem;
          border-top: 1px solid var(--cds-border-subtle);
          font-size: 0.875rem;
          color: var(--cds-text-secondary);
        }
        
        .event-title {
          display: flex;
          align-items: center;
          gap: 1rem;
          width: 100%;
        }
        
        .event-sequence {
          font-weight: 600;
          color: var(--cds-text-secondary);
        }
        
        .event-actor {
          flex: 1;
        }
        
        .event-time {
          font-size: 0.875rem;
          color: var(--cds-text-secondary);
        }
        
        .event-details {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          padding: 1rem 0;
        }
        
        .detail-section h6 {
          margin-bottom: 0.5rem;
          font-size: 0.875rem;
          text-transform: uppercase;
          color: var(--cds-text-secondary);
        }
        
        .detail-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1rem;
        }
        
        .detail-item {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        
        .detail-label {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--cds-text-secondary);
        }
        
        .detail-value {
          font-weight: 500;
        }
        
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3rem;
          text-align: center;
        }
        
        .empty-state h5 {
          margin: 1rem 0 0.5rem;
        }
        
        .empty-state p {
          color: var(--cds-text-secondary);
        }
      `}</style>
    </div>
  );
};

export default AuditViewer;

