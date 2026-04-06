import React, { useState } from 'react';
import {
  DataTable,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  TableContainer,
  Button,
  Modal,
  TextInput,
  Select,
  SelectItem,
  Tag,
  Stack
} from '@carbon/react';
import { Add } from '@carbon/icons-react';
import { BUILD_STATUS_CONFIG, ROLES, ROLE_NAMES } from '../utils/constants';
import { formatDate } from '../utils/formatters';
import { mockUsers } from '../store/mockData';

const BuildManagement = ({ builds, onSelectBuild, userRole }) => {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [buildName, setBuildName] = useState('');
  const [assignments, setAssignments] = useState({
    [ROLES.SOLUTION_PROVIDER]: '',
    [ROLES.DATA_OWNER]: '',
    [ROLES.AUDITOR]: '',
    [ROLES.ENV_OPERATOR]: ''
  });

  const headers = [
    { key: 'name', header: 'Build Name' },
    { key: 'status', header: 'Status' },
    { key: 'createdBy', header: 'Created By' },
    { key: 'createdAt', header: 'Created At' },
    { key: 'action', header: '' }
  ];

  const rows = builds.map(b => ({
    id: b.id,
    name: b.name,
    status: (
      <Tag type={BUILD_STATUS_CONFIG[b.status]?.kind || 'gray'}>
        {BUILD_STATUS_CONFIG[b.status]?.label || b.status}
      </Tag>
    ),
    createdBy: b.createdBy || 'Admin',
    createdAt: formatDate(b.createdAt),
    action: <Button size="sm" onClick={() => onSelectBuild(b.id)}>View Details</Button>
  }));

  // Get users by role for assignment dropdowns
  const getUsersByRole = (role) => {
    return mockUsers.filter(u => u.role === role);
  };

  const handleCreateBuild = () => {
    // TODO: Integrate with buildService.createBuild()
    console.log('Creating build:', {
      name: buildName,
      assignments
    });
    
    // Reset form
    setBuildName('');
    setAssignments({
      [ROLES.SOLUTION_PROVIDER]: '',
      [ROLES.DATA_OWNER]: '',
      [ROLES.AUDITOR]: '',
      [ROLES.ENV_OPERATOR]: ''
    });
    setCreateModalOpen(false);
  };

  const isFormValid = () => {
    return buildName.trim() &&
           assignments[ROLES.SOLUTION_PROVIDER] &&
           assignments[ROLES.DATA_OWNER] &&
           assignments[ROLES.AUDITOR] &&
           assignments[ROLES.ENV_OPERATOR];
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1>Build Management</h1>
        {userRole === 'ADMIN' && (
          <Button
            renderIcon={Add}
            onClick={() => setCreateModalOpen(true)}
          >
            Create New Build
          </Button>
        )}
      </div>

      {builds.length === 0 ? (
        <div style={{
          padding: '4rem 2rem',
          textAlign: 'center',
          backgroundColor: 'var(--cds-layer-01)',
          borderRadius: '4px'
        }}>
          <h3 style={{ marginBottom: '1rem' }}>No Builds Found</h3>
          <p style={{ color: 'var(--cds-text-secondary)', marginBottom: '2rem' }}>
            {userRole === 'ADMIN'
              ? 'Get started by creating your first build.'
              : 'No builds have been created yet. Contact your administrator.'}
          </p>
          {userRole === 'ADMIN' && (
            <Button
              renderIcon={Add}
              onClick={() => setCreateModalOpen(true)}
            >
              Create First Build
            </Button>
          )}
        </div>
      ) : (
        <DataTable rows={rows} headers={headers}>
          {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
            <TableContainer
              title="Contract Builds"
              description="List of all encrypted userdata contract builds in the system."
            >
              <Table {...getTableProps()}>
                <TableHead>
                  <TableRow>
                    {headers.map((header) => (
                      <TableHeader key={header.key} {...getHeaderProps({ header })}>
                        {header.header}
                      </TableHeader>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id} {...getRowProps({ row })}>
                      {row.cells.map((cell) => (
                        <TableCell key={cell.id}>{cell.value}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DataTable>
      )}

      {/* Create Build Modal */}
      <Modal
        open={createModalOpen}
        modalHeading="Create New Build"
        modalLabel="Build Management"
        primaryButtonText="Create Build"
        secondaryButtonText="Cancel"
        onRequestSubmit={handleCreateBuild}
        onRequestClose={() => setCreateModalOpen(false)}
        primaryButtonDisabled={!isFormValid()}
        size="lg"
      >
        <Stack gap={6}>
          <TextInput
            id="build-name"
            labelText="Build Name"
            placeholder="e.g., prod-v2.1, staging-test"
            value={buildName}
            onChange={(e) => setBuildName(e.target.value)}
            helperText="Enter a unique name for this build"
          />

          <div style={{ marginTop: '1rem' }}>
            <h4 style={{ marginBottom: '1rem' }}>Assign Users to Roles</h4>
            <p style={{ marginBottom: '1rem', color: 'var(--cds-text-secondary)', fontSize: '0.875rem' }}>
              Each role must be assigned to a specific user for this build.
            </p>

            <Stack gap={5}>
              <Select
                id="solution-provider"
                labelText="Solution Provider"
                value={assignments[ROLES.SOLUTION_PROVIDER]}
                onChange={(e) => setAssignments({
                  ...assignments,
                  [ROLES.SOLUTION_PROVIDER]: e.target.value
                })}
              >
                <SelectItem value="" text="Select a user" />
                {getUsersByRole(ROLES.SOLUTION_PROVIDER).map(user => (
                  <SelectItem key={user.id} value={user.id} text={user.name} />
                ))}
              </Select>

              <Select
                id="data-owner"
                labelText="Data Owner"
                value={assignments[ROLES.DATA_OWNER]}
                onChange={(e) => setAssignments({
                  ...assignments,
                  [ROLES.DATA_OWNER]: e.target.value
                })}
              >
                <SelectItem value="" text="Select a user" />
                {getUsersByRole(ROLES.DATA_OWNER).map(user => (
                  <SelectItem key={user.id} value={user.id} text={user.name} />
                ))}
              </Select>

              <Select
                id="auditor"
                labelText="Auditor"
                value={assignments[ROLES.AUDITOR]}
                onChange={(e) => setAssignments({
                  ...assignments,
                  [ROLES.AUDITOR]: e.target.value
                })}
              >
                <SelectItem value="" text="Select a user" />
                {getUsersByRole(ROLES.AUDITOR).map(user => (
                  <SelectItem key={user.id} value={user.id} text={user.name} />
                ))}
              </Select>

              <Select
                id="env-operator"
                labelText="Environment Operator"
                value={assignments[ROLES.ENV_OPERATOR]}
                onChange={(e) => setAssignments({
                  ...assignments,
                  [ROLES.ENV_OPERATOR]: e.target.value
                })}
              >
                <SelectItem value="" text="Select a user" />
                {getUsersByRole(ROLES.ENV_OPERATOR).map(user => (
                  <SelectItem key={user.id} value={user.id} text={user.name} />
                ))}
              </Select>
            </Stack>
          </div>
        </Stack>
      </Modal>
    </div>
  );
};

export default BuildManagement;
