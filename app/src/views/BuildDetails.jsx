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
import { useBuildStore } from '../store/buildStore';
import BuildAssignments from '../components/BuildAssignments';
import ContractExport from '../components/ContractExport';
import AuditViewer from '../components/AuditViewer';

/**
 * BuildDetails View
 * Integrated view for build management with assignments, export, and audit
 * Features: Build assignments, contract export, audit trail visualization
 */
const BuildDetails = ({ buildId, onBack }) => {
  const { user } = useAuthStore();
  const { builds, getBuildById } = useBuildStore();
  const [selectedTab, setSelectedTab] = useState(0);
  const [build, setBuild] = useState(null);

  useEffect(() => {
    // Load build details
    const buildData = getBuildById(buildId);
    setBuild(buildData);
  }, [buildId, getBuildById]);

  if (!build) {
    return (
      <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '2rem' }}>
        <p>Loading build details...</p>
      </div>
    );
  }

  const isAdmin = user?.role === 'ADMIN';
  const canManageAssignments = isAdmin || user?.role === 'MANAGER';

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
            Build ID: {build.id} • Status: {build.status}
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
          {canManageAssignments && <Tab>Assignments</Tab>}
          <Tab>Export Contract</Tab>
          <Tab>Audit Trail</Tab>
        </TabList>

        <TabPanels>
          {/* Build Assignments Tab */}
          {canManageAssignments && (
            <TabPanel>
              <div style={{ padding: '2rem 0' }}>
                <Grid narrow>
                  <Column lg={16}>
                    <BuildAssignments buildId={buildId} />
                  </Column>
                </Grid>
              </div>
            </TabPanel>
          )}

          {/* Contract Export Tab */}
          <TabPanel>
            <div style={{ padding: '2rem 0' }}>
              <Grid narrow>
                <Column lg={16}>
                  <ContractExport buildId={buildId} />
                </Column>
              </Grid>
            </div>
          </TabPanel>

          {/* Audit Trail Tab */}
          <TabPanel>
            <div style={{ padding: '2rem 0' }}>
              <Grid narrow>
                <Column lg={16}>
                  <AuditViewer buildId={buildId} />
                </Column>
              </Grid>
            </div>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </div>
  );
};

export default BuildDetails;


