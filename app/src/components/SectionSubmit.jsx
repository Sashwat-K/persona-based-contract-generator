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
import { Upload, CheckmarkFilled, Document, View, Download } from '@carbon/icons-react';
import sectionService from '../services/sectionService';
import buildService from '../services/buildService';
import { PLATFORMS, getCertsByPlatform, getCertById } from '../data/builtinCerts';
import AuditorSection from './AuditorSection';
import { formatDate } from '../utils/formatters';

// ── Workload templates ────────────────────────────────────────────────────────

const WORKLOAD_TEMPLATES = {
  default: {
    label: 'Workload Template',
    templateType: 'workload',
  },
};

// ── Environment templates ─────────────────────────────────────────────────────

const ENV_TEMPLATES = {
  default: {
    label: 'Environment Template',
    templateType: 'env',
  },
};

// ── Role config ───────────────────────────────────────────────────────────────

const ROLE_CONFIG = {
  SOLUTION_PROVIDER: {
    title: 'Encrypted Workload',
    description: 'Upload plaintext workload YAML and certificate PEM. Backend performs encryption and stores only encrypted payload.',
    requiredBuildStatus: 'SIGNING_KEY_REGISTERED',
    needsCert: true,
    templates: WORKLOAD_TEMPLATES,
    fileLabel: 'workload',
    addYamlButtonLabel: 'Add Workload YAML',
  },
  DATA_OWNER: {
    title: 'Add Environment',
    description: 'Upload plaintext environment YAML and certificate PEM. Backend performs encryption and stores only encrypted payload.',
    requiredBuildStatus: 'WORKLOAD_SUBMITTED',
    needsCert: true,
    templates: ENV_TEMPLATES,
    fileLabel: 'environment',
    addYamlButtonLabel: 'Add Environment YAML',
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

const SectionSubmit = ({ buildId, buildStatus: buildStatusProp, personaRole, onStatusUpdate }) => {
  const config = ROLE_CONFIG[personaRole];
  const supportsBackendTemplate = personaRole === 'SOLUTION_PROVIDER' || personaRole === 'DATA_OWNER';

  // Workload file
  const [workloadContent, setWorkloadContent] = useState('');
  const [workloadFileName, setWorkloadFileName] = useState('');

  // Certificate source: 'builtin' | 'custom'
  const [certSource, setCertSource] = useState('custom');
  const [selectedPlatformId, setSelectedPlatformId] = useState(PLATFORMS[0].id);
  const [selectedCertId, setSelectedCertId] = useState('');
  const [customCertContent, setCustomCertContent] = useState('');
  const [customCertFileName, setCustomCertFileName] = useState('');

  // Submission preparation
  const [encrypting, setEncrypting] = useState(false);
  const [encryptedResult, setEncryptedResult] = useState(null);
  const [wrappedSymmetricKey, setWrappedSymmetricKey] = useState(null);
  const topRef = useRef(null);
  const uploadEditorLineRef = useRef(null);

  // Preview modal
  const [showPreview, setShowPreview] = useState(false);
  const [showSubmittedPreview, setShowSubmittedPreview] = useState(false);
  const [showUploadEditor, setShowUploadEditor] = useState(false);
  const [uploadDraftContent, setUploadDraftContent] = useState('');
  const [uploadDraftFileName, setUploadDraftFileName] = useState('');
  const [uploadEditorLabel, setUploadEditorLabel] = useState('Editable file preview');
  const [loadingTemplateKey, setLoadingTemplateKey] = useState('');

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [submittedSectionHash, setSubmittedSectionHash] = useState('');
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
  }, [buildId, personaRole]);

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
    reader.onload = (ev) => {
      const content = typeof ev.target?.result === 'string' ? ev.target.result : '';
      setWorkloadContent(content);
      setUploadDraftContent(content);
      setUploadDraftFileName(file.name);
      setUploadEditorLabel('Editable file preview');
      setEncryptedResult(null);
      setWrappedSymmetricKey(null);
      setShowUploadEditor(true);
    };
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

  const downloadTemplate = async (key) => {
    const tpl = config.templates?.[key];
    if (!tpl) return;

    if (supportsBackendTemplate) {
      setError(null);
      setSuccess(null);
      setLoadingTemplateKey(key);
      try {
        const templateType = tpl.templateType || (personaRole === 'DATA_OWNER' ? 'env' : 'workload');
        const result = await buildService.getContractTemplate(templateType);
        const content = typeof result?.content === 'string' ? result.content : '';
        if (!content.trim()) {
          setError('Template content is empty.');
          return;
        }
        setUploadDraftContent(content);
        setUploadDraftFileName(`${config.fileLabel}-template.yaml`);
        setUploadEditorLabel('Template preview from contract-go');
        setShowUploadEditor(true);
      } catch (err) {
        setError(`Failed to load contract template: ${err.message}`);
      } finally {
        setLoadingTemplateKey('');
      }
      return;
    }

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

  const openUploadEditor = () => {
    if (!workloadContent) return;
    setUploadDraftContent(workloadContent);
    setUploadDraftFileName(workloadFileName || `${config.fileLabel}.yaml`);
    setUploadEditorLabel('Editable file preview');
    setShowUploadEditor(true);
  };

  const openAddYamlEditor = () => {
    setUploadDraftContent(workloadContent || '');
    setUploadDraftFileName(workloadFileName || `${config.fileLabel}.yaml`);
    setUploadEditorLabel('Paste content');
    setShowUploadEditor(true);
  };

  const closeUploadEditor = () => {
    setShowUploadEditor(false);
    setUploadDraftContent(workloadContent);
  };

  const applyUploadEditorChanges = () => {
    setWorkloadContent(uploadDraftContent);
    setWorkloadFileName(uploadDraftFileName || workloadFileName || `${config.fileLabel}.yaml`);
    setEncryptedResult(null);
    setWrappedSymmetricKey(null);
    setShowUploadEditor(false);
  };

  const handleUploadEditorKeyDown = (event) => {
    if (event.key !== 'Tab') return;
    event.preventDefault();

    const { selectionStart, selectionEnd, value } = event.target;
    const updatedValue = `${value.slice(0, selectionStart)}\t${value.slice(selectionEnd)}`;
    setUploadDraftContent(updatedValue);
    setEncryptedResult(null);
    setWrappedSymmetricKey(null);

    requestAnimationFrame(() => {
      event.target.selectionStart = selectionStart + 1;
      event.target.selectionEnd = selectionStart + 1;
    });
  };

  const syncUploadEditorScroll = (event) => {
    if (!uploadEditorLineRef.current) return;
    uploadEditorLineRef.current.scrollTop = event.target.scrollTop;
  };

  const handleEncrypt = async () => {
    if (!workloadContent) { setError(`Please upload a ${config.fileLabel} YAML file.`); return; }
    const certContent = getActiveCertContent();
    if (!certContent || certContent.includes('PASTE_')) {
      setError('Please select or upload a valid encryption certificate.'); return;
    }

    setEncrypting(true);
    setEncryptedResult(null);
    setWrappedSymmetricKey(null);
    setError(null);
    setSuccess(null);

    try {
      setEncryptedResult('__READY_FOR_V2_SUBMIT__');
      setSuccess('Submission prepared. Continue to the Submit step.');
    } catch (err) {
      setError(`Preparation failed: ${err.message}`);
    } finally {
      setEncrypting(false);
    }
  };

  const handleSubmit = async () => {
    if (!encryptedResult) { setError('Please prepare the submission first.'); return; }
    setSubmitting(true);
    setError(null);
    setSubmittedSectionHash('');
    try {
      const certContent = getActiveCertContent();
      if (!certContent || certContent.includes('PASTE_')) {
        throw new Error('Valid certificate PEM is required.');
      }

      let submitResult = null;
      if (personaRole === 'SOLUTION_PROVIDER') {
        submitResult = await buildService.submitWorkloadV2(buildId, {
          plaintext: workloadContent,
          certificate_pem: certContent,
        });
      } else if (personaRole === 'DATA_OWNER') {
        submitResult = await buildService.submitEnvironmentV2(buildId, {
          plaintext: workloadContent,
          certificate_pem: certContent,
        });
      } else {
        submitResult = await sectionService.submitEncryptedSection(buildId, personaRole, encryptedResult, wrappedSymmetricKey);
      }

      const responseHash = submitResult?.section_hash || submitResult?.sectionHash || '';
      if (responseHash) {
        setSubmittedSectionHash(responseHash);
      }
      setEncryptedResult(null);
      setWrappedSymmetricKey(null);
      await loadExistingSection();
      // Fetch updated build status and notify parent + update local state
      const updatedBuild = await buildService.getBuild(buildId);
      if (updatedBuild?.status) setLiveStatus(updatedBuild.status);
      onStatusUpdate?.(updatedBuild.status);
      setSuccess(responseHash
        ? `Section submitted successfully. Encrypted payload hash (SHA-256): ${responseHash}`
        : 'Section submitted successfully.');
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
  const bodyClassName = `workflow-body${isDisabled ? ' workflow-body--disabled' : ''}`;
  const sectionHashToDisplay = existingSection?.section_hash || submittedSectionHash;
  const submittedEncryptedPayload = existingSection?.encrypted_payload || '';

  return (
    <div ref={topRef}>
      <h3 className="workflow-title">{config.title}</h3>
      <p className="workflow-description">
        {config.description}
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
              <strong>Section already submitted</strong>
              <div className="workflow-complete-tile__meta">
                Submitted at: {existingSection.submitted_at
                  ? formatDate(existingSection.submitted_at, { second: '2-digit', timeZoneName: 'short' }) : 'N/A'}
              </div>
              {sectionHashToDisplay && (
                <div className="workflow-complete-tile__meta">
                  Encrypted Payload Hash (SHA-256): <code className="workflow-hash-inline">{sectionHashToDisplay}</code>
                </div>
              )}
              {sectionHashToDisplay && (
                <div className="workflow-complete-tile__meta">
                  This hash is computed from the encrypted payload (not plaintext {config.fileLabel} YAML).
                </div>
              )}
              {!!submittedEncryptedPayload && (
                <Button
                  kind="ghost"
                  size="sm"
                  renderIcon={View}
                  onClick={() => setShowSubmittedPreview(true)}
                  className="workflow-complete-tile__preview-button"
                >
                  Preview Encrypted {config.fileLabel.charAt(0).toUpperCase() + config.fileLabel.slice(1)}
                </Button>
              )}
            </div>
            <Tag type="green" className="workflow-complete-tile__tag">Submitted</Tag>
          </div>
        </Tile>
      )}

      {!isCorrectStatus && !existingSection && (
        <InlineNotification kind="info" title="Not yet available"
          subtitle={`This section requires build status "${config.requiredBuildStatus}". Current: ${liveStatus}.`}
          lowContrast hideCloseButton className="workflow-notification" />
      )}

      <div className={bodyClassName}>

        {/* ── Step 1: Upload YAML ───────────────────────────────────────── */}
        <div>
          <h4 className="workflow-step-heading">
            <Document size={18} /> Step 1 — Upload {config.fileLabel.charAt(0).toUpperCase() + config.fileLabel.slice(1)} YAML
          </h4>

          {/* Template buttons — shown when templates are configured */}
          {config.templates && (
            <div className="workflow-template-row">
              <span className="workflow-template-row__label">
                Download template:
              </span>
              {Object.entries(config.templates).map(([key, tpl]) => (
                <Button
                  key={key}
                  kind="ghost"
                  size="sm"
                  renderIcon={Download}
                  onClick={() => downloadTemplate(key)}
                  disabled={loadingTemplateKey === key}
                >
                  {loadingTemplateKey === key ? 'Loading...' : tpl.label}
                </Button>
              ))}
            </div>
          )}

          <div className="workflow-file-row">
            <div className="workflow-file-row__uploader">
              <FileUploader
                labelDescription={`Upload ${config.fileLabel} YAML file (.yaml / .yml)`}
                buttonLabel="Choose file"
                filenameStatus="edit"
                accept={['.yaml', '.yml']}
                onChange={handleWorkloadUpload}
              />
            </div>
            {config.addYamlButtonLabel && (
              <Button
                kind="ghost"
                size="sm"
                onClick={openAddYamlEditor}
                className="workflow-file-row__add-button"
              >
                {config.addYamlButtonLabel}
              </Button>
            )}
          </div>
          {workloadContent && (
            <div>
              <p className="workflow-upload-meta">
                {workloadFileName} — {workloadContent.length} bytes loaded
              </p>
              <Button
                kind="ghost"
                size="sm"
                renderIcon={View}
                onClick={openUploadEditor}
                className="workflow-upload-preview-button"
              >
                Preview / Edit {config.fileLabel} YAML
              </Button>
            </div>
          )}
        </div>

        {/* ── Step 2: Certificate (only when encryption is needed) ─────── */}
        {config.needsCert && (
          <div>
            <h4 className="workflow-step-title">Step 2 — HPCR Encryption Certificate</h4>

            <RadioButtonGroup
              name={`cert-source-${personaRole}`}
              valueSelected={certSource}
              onChange={(val) => { setCertSource(val); setEncryptedResult(null); }}
              className="workflow-radio-group"
            >
              <RadioButton labelText="Upload custom certificate" value="custom" id={`cert-custom-${personaRole}`} />
              <RadioButton labelText="Use built-in certificate" value="builtin" id={`cert-builtin-${personaRole}`} />
            </RadioButtonGroup>

            {certSource === 'builtin' ? (
              <div className="workflow-form-row">
                <Select
                  id={`cert-platform-${personaRole}`}
                  labelText="Platform"
                  value={selectedPlatformId}
                  onChange={(e) => { setSelectedPlatformId(e.target.value); setEncryptedResult(null); }}
                  className="workflow-select workflow-select--platform"
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
                  className="workflow-select workflow-select--version"
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
                  <p className="workflow-upload-meta">
                    {customCertFileName} loaded
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Step 2/3: Prepare ─────────────────────────────────────────── */}
        <div>
          <h4 className="workflow-step-heading">
            <CheckmarkFilled size={18} /> Step {config.needsCert ? 3 : 2} — Prepare Submission
          </h4>

          <Button
            kind="secondary"
            onClick={handleEncrypt}
            disabled={encrypting || !workloadContent}
            className="workflow-step-action"
          >
            {encrypting ? 'Preparing...' : 'Prepare Submission'}
          </Button>

          <p className="workflow-help-text">
            Preparation validates your inputs and readies a backend-native submission payload.
          </p>

          {encryptedResult && (
            <div className="workflow-result-banner">
              <div>
                <div className="workflow-result-banner__title">
                  Submission prepared
                </div>
                <div className="workflow-result-banner__preview">
                  Plaintext + certificate are ready for backend-native encryption.
                </div>
              </div>
              <Button
                kind="ghost"
                size="sm"
                renderIcon={View}
                onClick={() => setShowPreview(true)}
                className="workflow-result-banner__preview-button"
              >
                Preview
              </Button>
            </div>
          )}
        </div>

        {/* ── Step 3/4: Submit ──────────────────────────────────────────── */}
        <div>
          <h4 className="workflow-step-title">Step {config.needsCert ? 4 : 3} — Submit</h4>
          <Button
            renderIcon={Upload}
            onClick={handleSubmit}
            disabled={submitting || !encryptedResult}
          >
            {submitting ? 'Submitting...' : `Submit ${config.title}`}
          </Button>
          {!encryptedResult && (
            <p className="workflow-help-text">
              Complete Step {config.needsCert ? 3 : 2} before submitting.
            </p>
          )}
        </div>

      </div>

      <Modal
        open={showUploadEditor}
        modalHeading={`${config.fileLabel.charAt(0).toUpperCase() + config.fileLabel.slice(1)} YAML Editor`}
        modalLabel={uploadEditorLabel}
        primaryButtonText="Apply Changes"
        secondaryButtonText="Cancel"
        onRequestSubmit={applyUploadEditorChanges}
        onSecondarySubmit={closeUploadEditor}
        onRequestClose={closeUploadEditor}
        size="lg"
      >
        <p className="workflow-modal-copy workflow-modal-copy--tight">
          Review and edit the uploaded YAML before submission. Use <code>Tab</code> to indent.
        </p>
        {uploadDraftFileName && (
          <p className="workflow-upload-meta">Editing: {uploadDraftFileName}</p>
        )}
        <div className="workflow-code-editor">
          <pre ref={uploadEditorLineRef} className="workflow-code-editor__line-numbers" aria-hidden="true">
            {Array.from(
              { length: Math.max(uploadDraftContent.split('\n').length, 1) },
              (_, index) => index + 1
            ).join('\n')}
          </pre>
          <textarea
            value={uploadDraftContent}
            onChange={(event) => {
              setUploadDraftContent(event.target.value);
              setEncryptedResult(null);
              setWrappedSymmetricKey(null);
            }}
            onKeyDown={handleUploadEditorKeyDown}
            onScroll={syncUploadEditorScroll}
            className="workflow-code-editor__textarea"
            spellCheck={false}
            wrap="soft"
            aria-label={`${config.fileLabel} yaml editor`}
          />
        </div>
      </Modal>

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
        <p className="workflow-modal-copy">
          Backend-native flow: this plaintext YAML is submitted with the selected certificate, and encryption is performed on the backend.
        </p>
        <CodeSnippet type="multi" feedback="Copied to clipboard" wrapText>
          {workloadContent || ''}
        </CodeSnippet>
      </Modal>

      <Modal
        open={showSubmittedPreview}
        modalHeading={`Encrypted ${config.fileLabel.charAt(0).toUpperCase() + config.fileLabel.slice(1)} Preview`}
        modalLabel="Submitted payload"
        primaryButtonText="Close"
        onRequestSubmit={() => setShowSubmittedPreview(false)}
        onRequestClose={() => setShowSubmittedPreview(false)}
        size="lg"
        passiveModal
      >
        <p className="workflow-modal-copy">
          This is the encrypted payload stored after submission.
        </p>
        <CodeSnippet type="multi" feedback="Copied to clipboard" wrapText>
          {submittedEncryptedPayload}
        </CodeSnippet>
      </Modal>
    </div>
  );
};

export default SectionSubmit;
