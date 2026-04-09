import React, { useState, useEffect } from 'react';
import {
  Button,
  Modal,
  InlineNotification,
  CodeSnippet,
  Tile,
  Tag,
  Loading,
  ProgressBar
} from '@carbon/react';
import {
  Download,
  DocumentExport,
  CheckmarkFilled,
  WarningAlt,
  View,
  Save
} from '@carbon/icons-react';
import { useBuildStore } from '../store/buildStore';
import { useAuthStore } from '../store/authStore';
import exportService from '../services/exportService';
import verificationService from '../services/verificationService';

/**
 * ContractExport Component
 * Handles contract export, preview, and download acknowledgment
 * Features: Export button, YAML preview, download with signature, verification
 */
const ContractExport = ({ buildId }) => {
  const { user } = useAuthStore();
  const { getBuildExportData, isBuildComplete } = useBuildStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Export state
  const [exportData, setExportData] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Verification state
  const [verificationResult, setVerificationResult] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const buildComplete = isBuildComplete(buildId);

  useEffect(() => {
    // Load cached export data if available
    const cached = getBuildExportData(buildId);
    if (cached) {
      setExportData(cached);
    }
  }, [buildId]);

  const handleExport = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await exportService.exportContract(buildId);
      setExportData(data);
      setSuccess('Contract exported successfully');

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(`Failed to export contract: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = () => {
    if (!exportData) {
      handleExport().then(() => setIsPreviewOpen(true));
    } else {
      setIsPreviewOpen(true);
    }
  };

  const handleDownload = async () => {
    if (!exportData) {
      setError('No export data available. Please export first.');
      return;
    }

    setIsExporting(true);
    setError(null);

    try {
      // Save contract locally and acknowledge download
      const result = await exportService.exportAndSave(
        buildId,
        `contract-${buildId}.yaml`
      );

      setSuccess(`Contract saved to: ${result.path}`);
      setIsPreviewOpen(false);

      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(`Failed to download contract: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleVerify = async () => {
    if (!exportData) {
      setError('No export data available. Please export first.');
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      // Verify contract integrity
      const result = await verificationService.verifyContractIntegrity(buildId);
      setVerificationResult(result);

      if (result.valid) {
        setSuccess('Contract verification passed ✓');
      } else {
        setError('Contract verification failed. See details below.');
      }
    } catch (err) {
      setError(`Verification failed: ${err.message}`);
    } finally {
      setIsVerifying(false);
    }
  };

  const getExportStatus = () => {
    if (!buildComplete) {
      return {
        canExport: false,
        message: 'Build incomplete. All sections must be submitted before export.',
        severity: 'warning'
      };
    }

    if (!exportData) {
      return {
        canExport: true,
        message: 'Ready to export contract',
        severity: 'info'
      };
    }

    return {
      canExport: true,
      message: 'Contract exported and ready for download',
      severity: 'success'
    };
  };

  const status = getExportStatus();

  const formatYAML = (yaml) => {
    // Add syntax highlighting hints
    return yaml;
  };

  const getContractMetadata = () => {
    if (!exportData) return null;

    return {
      hash: exportData.contract_hash,
      size: exportData.contract_yaml?.length || 0,
      sections: exportData.sections?.length || 0,
      exportedAt: exportData.exported_at || new Date().toISOString()
    };
  };

  const metadata = getContractMetadata();

  return (
    <div className="contract-export">
      {error && (
        <InlineNotification
          kind="error"
          title="Error"
          subtitle={error}
          onCloseButtonClick={() => setError(null)}
          lowContrast
        />
      )}

      {success && (
        <InlineNotification
          kind="success"
          title="Success"
          subtitle={success}
          onCloseButtonClick={() => setSuccess(null)}
          lowContrast
        />
      )}

      <Tile className="export-tile">
        <div className="export-header">
          <div className="header-content">
            <DocumentExport size={24} />
            <h4>Contract Export</h4>
          </div>
          {exportData && (
            <Tag type="green" renderIcon={CheckmarkFilled}>
              Exported
            </Tag>
          )}
        </div>

        <InlineNotification
          kind={status.severity}
          title={status.canExport ? 'Ready' : 'Not Ready'}
          subtitle={status.message}
          lowContrast
          hideCloseButton
        />

        {metadata && (
          <div className="metadata">
            <div className="metadata-row">
              <span className="label">Contract Hash:</span>
              <CodeSnippet type="inline" feedback="Copied">
                {metadata.hash.substring(0, 16)}...
              </CodeSnippet>
            </div>
            <div className="metadata-row">
              <span className="label">Size:</span>
              <span>{(metadata.size / 1024).toFixed(2)} KB</span>
            </div>
            <div className="metadata-row">
              <span className="label">Sections:</span>
              <span>{metadata.sections}</span>
            </div>
            <div className="metadata-row">
              <span className="label">Exported:</span>
              <span>{new Date(metadata.exportedAt).toLocaleString()}</span>
            </div>
          </div>
        )}

        {verificationResult && (
          <div className="verification-result">
            <InlineNotification
              kind={verificationResult.valid ? 'success' : 'error'}
              title={verificationResult.valid ? 'Verification Passed' : 'Verification Failed'}
              subtitle={verificationResult.valid
                ? 'Contract integrity verified successfully'
                : `${verificationResult.errors?.length || 0} errors found`
              }
              lowContrast
            />
          </div>
        )}

        <div className="export-actions">
          <Button
            kind="primary"
            renderIcon={DocumentExport}
            onClick={handleExport}
            disabled={!status.canExport || loading}
          >
            {loading ? 'Exporting...' : exportData ? 'Re-export' : 'Export Contract'}
          </Button>

          <Button
            kind="secondary"
            renderIcon={View}
            onClick={handlePreview}
            disabled={!status.canExport}
          >
            Preview
          </Button>

          <Button
            kind="tertiary"
            renderIcon={CheckmarkFilled}
            onClick={handleVerify}
            disabled={!exportData || isVerifying}
          >
            {isVerifying ? 'Verifying...' : 'Verify'}
          </Button>
        </div>
      </Tile>

      <Modal
        open={isPreviewOpen}
        onRequestClose={() => setIsPreviewOpen(false)}
        modalHeading="Contract Preview"
        modalLabel={`Build ${buildId}`}
        primaryButtonText="Download & Acknowledge"
        secondaryButtonText="Close"
        onRequestSubmit={handleDownload}
        onSecondarySubmit={() => setIsPreviewOpen(false)}
        primaryButtonDisabled={isExporting}
        size="lg"
        hasScrollingContent
      >
        {isExporting && (
          <div className="exporting-overlay">
            <Loading description="Saving contract and generating signature..." withOverlay={false} />
            <ProgressBar label="Download Progress" helperText="Signing with your private key..." />
          </div>
        )}

        {exportData && (
          <div className="preview-content">
            <InlineNotification
              kind="info"
              title="Download Acknowledgment"
              subtitle="Downloading will create a cryptographic signature with your private key for non-repudiation."
              lowContrast
              hideCloseButton
            />

            <div className="contract-info">
              <h5>Contract Information</h5>
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">Build ID:</span>
                  <span className="info-value">{buildId}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Hash:</span>
                  <CodeSnippet type="inline" feedback="Copied">
                    {exportData.contract_hash}
                  </CodeSnippet>
                </div>
                <div className="info-item">
                  <span className="info-label">Sections:</span>
                  <span className="info-value">{exportData.sections?.length || 0}</span>
                </div>
              </div>
            </div>

            <div className="yaml-preview">
              <h5>Contract YAML</h5>
              <CodeSnippet
                type="multi"
                feedback="Copied to clipboard"
                wrapText
              >
                {formatYAML(exportData.contract_yaml)}
              </CodeSnippet>
            </div>

            {exportData.sections && exportData.sections.length > 0 && (
              <div className="sections-info">
                <h5>Included Sections</h5>
                <div className="sections-list">
                  {exportData.sections.map((section, index) => (
                    <Tile key={index} className="section-tile">
                      <div className="section-header">
                        <Tag type="blue">{section.persona_role}</Tag>
                        <span className="section-submitter">
                          by {section.submitted_by_name}
                        </span>
                      </div>
                      <div className="section-details">
                        <span className="section-hash">
                          Hash: {section.section_hash.substring(0, 16)}...
                        </span>
                        <span className="section-date">
                          {new Date(section.submitted_at).toLocaleDateString()}
                        </span>
                      </div>
                    </Tile>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <style>{`
        .contract-export {
          margin: 1rem 0;
        }
        
        .export-tile {
          padding: 1.5rem;
        }
        
        .export-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }
        
        .header-content {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .header-content h4 {
          margin: 0;
        }
        
        .metadata {
          margin: 1rem 0;
          padding: 1rem;
          background: var(--cds-layer-02);
          border-radius: 4px;
        }
        
        .metadata-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem 0;
          border-bottom: 1px solid var(--cds-border-subtle);
        }
        
        .metadata-row:last-child {
          border-bottom: none;
        }
        
        .metadata-row .label {
          font-weight: 600;
          color: var(--cds-text-secondary);
        }
        
        .verification-result {
          margin: 1rem 0;
        }
        
        .export-actions {
          display: flex;
          gap: 0.5rem;
          margin-top: 1rem;
        }
        
        .exporting-overlay {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          padding: 2rem;
        }
        
        .preview-content {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        
        .contract-info h5,
        .yaml-preview h5,
        .sections-info h5 {
          margin-bottom: 0.5rem;
        }
        
        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
        }
        
        .info-item {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        
        .info-label {
          font-size: 0.875rem;
          color: var(--cds-text-secondary);
        }
        
        .info-value {
          font-weight: 600;
        }
        
        .yaml-preview {
          max-height: 400px;
          overflow-y: auto;
        }
        
        .sections-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        
        .section-tile {
          padding: 1rem;
        }
        
        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }
        
        .section-submitter {
          font-size: 0.875rem;
          color: var(--cds-text-secondary);
        }
        
        .section-details {
          display: flex;
          justify-content: space-between;
          font-size: 0.875rem;
          color: var(--cds-text-secondary);
        }
      `}</style>
    </div>
  );
};

export default ContractExport;

