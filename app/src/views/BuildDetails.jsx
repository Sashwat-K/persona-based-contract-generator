import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Grid,
  Column,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Button,
  Breadcrumb,
  BreadcrumbItem,
  ProgressIndicator,
  ProgressStep,
  Tag,
  Tile
} from '@carbon/react';
import { ArrowLeft } from '@carbon/icons-react';
import BuildAssignments from '../components/BuildAssignments';
import AuditorSection from '../components/AuditorSection';
import ContractExport from '../components/ContractExport';
import SectionSubmit from '../components/SectionSubmit';
import FinaliseContract from '../components/FinaliseContract';
import AuditViewer from '../components/AuditViewer';
import AttestationEvidenceSection from '../components/AttestationEvidenceSection';
import { BUILD_PROGRESS_STEPS, BUILD_STATUS_CONFIG, ROLE_NAMES } from '../utils/constants';

const TAB_LABELS = {
  assignments: 'Assignments',
  signingKey: 'Add Signing Key',
  workload: 'Add workload',
  environment: 'Add environment',
  attestationKey: 'Add attestation key',
  finalise: 'Finalise contract',
  export: 'Export contract',
  attestationRecords: 'Attestation records',
  verifyAttestation: 'Verify attestation',
  audit: 'Audit Trail'
};

const ROLE_BUILD_TAB_KEYS = {
  ADMIN: ['assignments', 'audit'],
  AUDITOR: ['assignments', 'signingKey', 'attestationKey', 'finalise', 'verifyAttestation', 'audit'],
  SOLUTION_PROVIDER: ['assignments', 'workload', 'audit'],
  DATA_OWNER: ['assignments', 'environment', 'attestationRecords', 'audit'],
  ENV_OPERATOR: ['assignments', 'export', 'attestationRecords', 'audit'],
  VIEWER: ['assignments', 'audit']
};

const STAGE_STATUS_TO_INDEX = {
  CREATED: 0,
  SIGNING_KEY_REGISTERED: 1,
  WORKLOAD_SUBMITTED: 2,
  ENVIRONMENT_STAGED: 3,
  ATTESTATION_KEY_REGISTERED: 4,
  AUDITOR_KEYS_REGISTERED: 4,
  CONTRACT_ASSEMBLED: 5,
  FINALIZED: 5,
  CONTRACT_DOWNLOADED: 5,
  CANCELLED: 0
};

/**
 * BuildDetails View
 * Integrated view for build management with assignments, section submission, export, and audit
 */
const BuildDetails = ({ build, onBack, userRole, advanceBuildState }) => {
  const [selectedTab, setSelectedTab] = useState(0);
  const [currentStatus, setCurrentStatus] = useState(build?.status);

  useEffect(() => { setCurrentStatus(build?.status); }, [build?.status]);

  const handleStatusUpdate = useCallback((newStatus) => {
    setCurrentStatus(newStatus);
    advanceBuildState?.(build.id, newStatus);
  }, [advanceBuildState, build?.id]);

  const normalizedStatus = useMemo(
    () => String(currentStatus || '').toUpperCase(),
    [currentStatus]
  );

  const stageStatusMeta = useMemo(
    () => BUILD_STATUS_CONFIG[normalizedStatus] || { label: normalizedStatus || 'Unknown', kind: 'gray' },
    [normalizedStatus]
  );

  const progressIndex = useMemo(
    () => STAGE_STATUS_TO_INDEX[normalizedStatus] ?? 0,
    [normalizedStatus]
  );

  const pendingStepLabel = useMemo(() => {
    if (normalizedStatus === 'CANCELLED' || normalizedStatus === 'CONTRACT_DOWNLOADED') {
      return 'No pending step.';
    }
    if (normalizedStatus === 'FINALIZED') {
      return 'Export contract (Environment Operator)';
    }

    const nextStep = BUILD_PROGRESS_STEPS[progressIndex + 1];
    if (!nextStep) {
      return 'No pending step.';
    }

    const roleLabel = ROLE_NAMES[nextStep.role] || nextStep.role || 'Unassigned role';
    return `${nextStep.label} (${roleLabel})`;
  }, [normalizedStatus, progressIndex]);

  const tabs = useMemo(() => {
    const tabKeys = ROLE_BUILD_TAB_KEYS[userRole] || ROLE_BUILD_TAB_KEYS.VIEWER;
    return tabKeys.map((key) => ({
      key,
      label: TAB_LABELS[key] || key
    }));
  }, [userRole]);

  useEffect(() => {
    if (selectedTab >= tabs.length) {
      setSelectedTab(0);
    }
  }, [selectedTab, tabs.length]);

  if (!build) {
    return (
      <div className="app-page app-page--wide app-page--padded">
        <p>Loading build details...</p>
      </div>
    );
  }

  return (
    <div className="app-page app-page--wide app-page--padded">
      {/* Breadcrumb Navigation */}
      <Breadcrumb noTrailingSlash className="build-details-breadcrumb">
        <BreadcrumbItem>
          <a href="#" onClick={(e) => { e.preventDefault(); onBack?.(); }}>
            Builds
          </a>
        </BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>
          {build.name}
        </BreadcrumbItem>
      </Breadcrumb>

      {/* Header */}
      <div className="app-page__header">
        <div>
          <h1 className="app-page__title">{build.name}</h1>
          <p className="app-page__subtitle">
            Build ID: {build.id} • Status: {currentStatus}
          </p>
        </div>
        <Button
          kind="tertiary"
          size="md"
          onClick={onBack}
          className="build-details-back-button"
        >
          <ArrowLeft size={16} className="build-details-back-button__icon" />
          Back to Builds
        </Button>
      </div>

      <Tile className="build-details-stage">
        <div className="build-details-stage__header">
          <div>
            <h3 className="build-details-stage__title">Build Stage</h3>
            <p className="build-details-stage__description">
              {stageStatusMeta.description || 'Track current stage progression for this build.'}
            </p>
          </div>
          <Tag type={stageStatusMeta.kind || 'gray'}>
            {stageStatusMeta.label || normalizedStatus || 'Unknown'}
          </Tag>
        </div>
        <ProgressIndicator currentIndex={progressIndex} spaceEqually>
          {BUILD_PROGRESS_STEPS.map((step) => (
            <ProgressStep key={step.status} label={step.label} />
          ))}
        </ProgressIndicator>
        <p className="build-details-stage__pending">
          Pending Step: <strong>{pendingStepLabel}</strong>
        </p>
        {normalizedStatus === 'CANCELLED' && (
          <p className="build-details-stage__cancelled">
            This build was cancelled and is no longer progressing through workflow stages.
          </p>
        )}
      </Tile>

      {/* Tabbed Interface */}
      <Tabs selectedIndex={selectedTab} onChange={(e) => setSelectedTab(e.selectedIndex)}>
        <TabList aria-label="Build info tabs" contained>
          {tabs.map(t => <Tab key={t.key}>{t.label}</Tab>)}
        </TabList>

        <TabPanels>
          {tabs.map(t => (
            <TabPanel key={t.key}>
              <div className="build-details-tab-content">
                <Grid narrow>
                  <Column lg={16}>
                    {t.key === 'assignments' && (
                      <BuildAssignments
                        buildId={build.id}
                        buildStatus={currentStatus}
                        userRole={userRole}
                        onStatusUpdate={handleStatusUpdate}
                      />
                    )}
                    {t.key === 'signingKey' && (
                      <AuditorSection
                        buildId={build.id}
                        buildStatus={currentStatus}
                        onStatusUpdate={handleStatusUpdate}
                        mode="signing"
                      />
                    )}
                    {(t.key === 'workload' || t.key === 'environment') && (
                      <SectionSubmit
                        buildId={build.id}
                        buildStatus={currentStatus}
                        personaRole={t.key === 'workload' ? 'SOLUTION_PROVIDER' : 'DATA_OWNER'}
                        onStatusUpdate={handleStatusUpdate}
                      />
                    )}
                    {t.key === 'attestationKey' && (
                      <AuditorSection
                        buildId={build.id}
                        buildStatus={currentStatus}
                        onStatusUpdate={handleStatusUpdate}
                        mode="attestation"
                      />
                    )}
                    {t.key === 'finalise' && (
                      <FinaliseContract
                        buildId={build.id}
                        buildStatus={currentStatus}
                        onStatusUpdate={handleStatusUpdate}
                      />
                    )}
                    {t.key === 'export' && (
                      <ContractExport
                        buildId={build.id}
                        buildStatus={currentStatus}
                        onStatusUpdate={handleStatusUpdate}
                      />
                    )}
                    {t.key === 'attestationRecords' && (
                      <AttestationEvidenceSection
                        buildId={build.id}
                        buildStatus={currentStatus}
                        mode="upload"
                      />
                    )}
                    {t.key === 'verifyAttestation' && (
                      <AttestationEvidenceSection
                        buildId={build.id}
                        buildStatus={currentStatus}
                        mode="verify"
                      />
                    )}
                    {t.key === 'audit' && (
                      <AuditViewer buildId={build.id} userRole={userRole} />
                    )}
                  </Column>
                </Grid>
              </div>
            </TabPanel>
          ))}
        </TabPanels>
      </Tabs>
    </div>
  );
};

export default BuildDetails;
