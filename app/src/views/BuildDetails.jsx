import React, { useState, useEffect } from 'react';
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
import { useAuthStore } from '../store/authStore';
import BuildAssignments from '../components/BuildAssignments';
import ContractExport from '../components/ContractExport';
import AuditViewer from '../components/AuditViewer';
import SectionSubmit from '../components/SectionSubmit';
import FinaliseContract from '../components/FinaliseContract';
import assignmentService from '../services/assignmentService';

/**
 * BuildDetails View
 * Integrated view for build management with assignments, section submission, export, and audit
 */
const BuildDetails = ({ build, onBack, userRole, userRoles = [], advanceBuildState }) => {
  const { user } = useAuthStore();
  const [selectedTab, setSelectedTab] = useState(0);
  const [myRolesInBuild, setMyRolesInBuild] = useState([]);
  const [currentStatus, setCurrentStatus] = useState(build?.status);

  useEffect(() => { setCurrentStatus(build?.status); }, [build?.status]);

  const handleStatusUpdate = (newStatus) => {
    setCurrentStatus(newStatus);
    advanceBuildState?.(build.id, newStatus);
  };

  const isAdmin = userRole === 'ADMIN' || user?.roles?.includes('ADMIN');
  const allRoles = userRoles.length > 0 ? userRoles : [userRole];
  const isEnvOperator = allRoles.includes('ENV_OPERATOR');

  useEffect(() => {
    if (!build) return;
    loadMyAssignments();
  }, [build?.id]);

  const loadMyAssignments = async () => {
    try {
      const assignments = await assignmentService.getBuildAssignments(build.id);
      const userId = user?.id;
      const myAssignments = assignments
        .filter(a => a.user_id === userId)
        .map(a => a.role_name);
      setMyRolesInBuild(myAssignments);
    } catch (err) {
      console.error('Failed to load assignments:', err);
    }
  };

  if (!build) {
    return (
      <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '2rem' }}>
        <p>Loading build details...</p>
      </div>
    );
  }

  const isAuditor = allRoles.includes('AUDITOR');

  // Determine which section tabs to show based on user's assignment in this build
  const sectionTabs = [
    { role: 'SOLUTION_PROVIDER', label: 'Add Workload' },
    { role: 'DATA_OWNER',        label: 'Add Environment' },
    { role: 'AUDITOR',           label: 'Sign & Add Attestation' },
  ].filter(t => myRolesInBuild.includes(t.role));

  // Build tab list dynamically
  const tabs = [
    ...(isAdmin ? [{ key: 'assignments', label: 'Assignments' }] : []),
    ...sectionTabs.map(t => ({ key: t.role, label: t.label })),
    ...(isAuditor || isAdmin ? [{ key: 'finalise', label: 'Finalise Contract' }] : []),
    ...(isEnvOperator || isAdmin ? [{ key: 'export', label: 'Export Contract' }] : []),
    { key: 'audit', label: 'Audit Trail' },
  ];

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '2rem' }}>
      {/* Breadcrumb Navigation */}
      <Breadcrumb noTrailingSlash style={{ marginBottom: '1rem' }}>
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
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem'
      }}>
        <div>
          <h1 style={{ marginBottom: '0.5rem' }}>{build.name}</h1>
          <p style={{ color: 'var(--cds-text-secondary)' }}>
            Build ID: {build.id} • Status: {currentStatus}
          </p>
        </div>
        <Button
          kind="ghost"
          renderIcon={ArrowLeft}
          onClick={onBack}
        >
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
              <div style={{ padding: '2rem 0' }}>
                <Grid narrow>
                  <Column lg={16}>
                    {t.key === 'assignments' && (
                      <BuildAssignments
                        buildId={build.id}
                        userRole={userRole}
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
                      <AuditViewer buildId={build.id} />
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
