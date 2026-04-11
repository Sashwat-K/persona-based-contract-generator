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
  BreadcrumbItem
} from '@carbon/react';
import { ArrowLeft } from '@carbon/icons-react';
import BuildAssignments from '../components/BuildAssignments';
import ContractExport from '../components/ContractExport';
import AuditViewer from '../components/AuditViewer';
import SectionSubmit from '../components/SectionSubmit';
import FinaliseContract from '../components/FinaliseContract';

const TAB_LABELS = {
  assignments: 'Assignments',
  SOLUTION_PROVIDER: 'Add Workload',
  DATA_OWNER: 'Add Environment',
  AUDITOR: 'Sign & Add Attestation',
  finalise: 'Finalise Contract',
  export: 'Export Contract',
  audit: 'Audit Trail'
};

const ROLE_BUILD_TAB_KEYS = {
  ADMIN: ['assignments', 'audit'],
  SOLUTION_PROVIDER: ['assignments', 'SOLUTION_PROVIDER', 'audit'],
  DATA_OWNER: ['assignments', 'DATA_OWNER', 'audit'],
  AUDITOR: ['assignments', 'AUDITOR', 'finalise', 'audit'],
  ENV_OPERATOR: ['assignments', 'export', 'audit'],
  VIEWER: ['assignments', 'audit']
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

      {/* Tabbed Interface */}
      <Tabs selectedIndex={selectedTab} onChange={(e) => setSelectedTab(e.selectedIndex)}>
        <TabList aria-label="Build details tabs" contained>
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
                      />
                    )}
                    {(t.key === 'SOLUTION_PROVIDER' || t.key === 'DATA_OWNER' || t.key === 'AUDITOR') && (
                      <SectionSubmit
                        buildId={build.id}
                        buildStatus={currentStatus}
                        personaRole={t.key}
                        onStatusUpdate={handleStatusUpdate}
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
                      <ContractExport buildId={build.id} buildStatus={currentStatus} />
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
