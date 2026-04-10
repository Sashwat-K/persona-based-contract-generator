import React, { useState, useEffect } from 'react';
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
import { Add, WarningAlt, Renew } from '@carbon/icons-react';
import { BUILD_STATUS_CONFIG, ROLES, ROLE_NAMES } from '../utils/constants';
import { formatDate } from '../utils/formatters';
import userService from '../services/userService';
import buildService from '../services/buildService';
import assignmentService from '../services/assignmentService';
import { InlineLoader } from '../components/LoadingSpinner';
import { useAuthStore } from '../store/authStore';

const BuildManagement = ({ builds, onSelectBuild, userRole, userRoles = [], onBuildCreated }) => {
  const allRoles = userRoles.length > 0 ? userRoles : [userRole];
  const isAdmin = allRoles.includes('ADMIN');
  const isSetupRequired = useAuthStore((state) => state.isSetupRequired());
  const setupPending = useAuthStore((state) => state.getSetupPending());
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [buildName, setBuildName] = useState('');
  const [assignments, setAssignments] = useState({
    [ROLES.SOLUTION_PROVIDER]: '',
    [ROLES.DATA_OWNER]: '',
    [ROLES.AUDITOR]: '',
    [ROLES.ENV_OPERATOR]: ''
  });
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Load users when modal opens
  useEffect(() => {
    if (createModalOpen && users.length === 0) {
      loadUsers();
    }
  }, [createModalOpen]);

  const loadUsers = async () => {
    try {
      setLoadingUsers(true);
      const usersData = await userService.listUsers();
      setUsers(usersData);
    } catch (err) {
      console.error('Failed to load users:', err);
      // Keep empty array, modal will show error
    } finally {
      setLoadingUsers(false);
    }
  };

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
    createdBy: b.created_by || b.createdBy || 'Admin',
    createdAt: formatDate(b.created_at || b.createdAt),
    action: <Button size="sm" onClick={() => onSelectBuild(b.id)}>View Details</Button>
  }));

  // Get users by role for assignment dropdowns
  const isUserReady = (u) =>
    u.is_active &&
    !u.must_change_password &&
    u.public_key_fingerprint != null;

  // Show all ready users in every role dropdown — one person can cover multiple roles.
  // The build assignment (not system role) controls access per build.
  const getUsersByRole = (_role) => {
    return users.filter(u => isUserReady(u));
  };

  const getNotReadyCountByRole = (_role) => {
    return users.filter(u => u.is_active && !isUserReady(u)).length;
  };

  const handleCreateBuild = async () => {
    if (creating) return;

    if (isSetupRequired) {
      alert(`Account setup is required before creating builds. Pending: ${setupPending.join(', ')}`);
      return;
    }
    try {
      setCreating(true);

      // Step 1: Create the build (backend only accepts name)
      const build = await buildService.createBuild(buildName);

      // Step 2: Create assignments for each role
      const roleAssignments = [
        { role: ROLES.SOLUTION_PROVIDER, userId: assignments[ROLES.SOLUTION_PROVIDER] },
        { role: ROLES.DATA_OWNER,        userId: assignments[ROLES.DATA_OWNER] },
        { role: ROLES.AUDITOR,           userId: assignments[ROLES.AUDITOR] },
        { role: ROLES.ENV_OPERATOR,      userId: assignments[ROLES.ENV_OPERATOR] }
      ].filter(a => a.userId);

      await Promise.all(
        roleAssignments.map(a =>
          assignmentService.createAssignment(build.id, a.userId, a.role)
        )
      );

      // Reset form
      setBuildName('');
      setAssignments({
        [ROLES.SOLUTION_PROVIDER]: '',
        [ROLES.DATA_OWNER]: '',
        [ROLES.AUDITOR]: '',
        [ROLES.ENV_OPERATOR]: ''
      });
      setCreateModalOpen(false);
      if (onBuildCreated) await onBuildCreated();

    } catch (err) {
      console.error('Failed to create build:', err);
      alert(`Failed to create build: ${err.message}`);
    } finally {
      setCreating(false);
    }
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
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button
            kind="ghost"
            renderIcon={Renew}
            iconDescription="Refresh"
            disabled={refreshing}
            onClick={async () => {
              setRefreshing(true);
              if (onBuildCreated) await onBuildCreated();
              setRefreshing(false);
            }}
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          {isAdmin && (
            <Button
              renderIcon={Add}
              disabled={isSetupRequired || creating}
              onClick={() => setCreateModalOpen(true)}
            >
              {isSetupRequired ? 'Complete Setup First' : 'Create New Build'}
            </Button>
          )}
        </div>
      </div>

      {isSetupRequired && (
        <div style={{
          marginBottom: '1rem',
          padding: '0.75rem 1rem',
          borderLeft: '4px solid var(--cds-support-warning)',
          background: 'var(--cds-layer-01)'
        }}>
          Account setup is incomplete. Complete password change and public key registration in Account Settings before creating builds.
        </div>
      )}

      {builds.length === 0 ? (
        <div style={{
          padding: '4rem 2rem',
          textAlign: 'center',
          backgroundColor: 'var(--cds-layer-01)',
          borderRadius: '4px'
        }}>
          <h3 style={{ marginBottom: '1rem' }}>No Builds Found</h3>
          <p style={{ color: 'var(--cds-text-secondary)', marginBottom: '2rem' }}>
            {isAdmin
              ? 'Get started by creating your first build.'
              : 'No builds have been created yet. Contact your administrator.'}
          </p>
          {isAdmin && (
            <Button
              renderIcon={Add}
              disabled={isSetupRequired || creating}
              onClick={() => setCreateModalOpen(true)}
            >
              {isSetupRequired ? 'Complete Setup First' : 'Create First Build'}
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
                    {headers.map((header) => {
                      const { key, ...headerProps } = getHeaderProps({ header });
                      return (
                        <TableHeader key={header.key} {...headerProps}>
                          {header.header}
                        </TableHeader>
                      );
                    })}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => {
                    const { key, ...rowProps } = getRowProps({ row });
                    return (
                      <TableRow key={row.id} {...rowProps}>
                        {row.cells.map((cell) => (
                          <TableCell key={cell.id}>{cell.value}</TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
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
        primaryButtonText={creating ? "Creating..." : "Create Build"}
        secondaryButtonText="Cancel"
        onRequestSubmit={handleCreateBuild}
        onRequestClose={() => {
          if (!creating) setCreateModalOpen(false);
        }}
        onSecondarySubmit={() => {
          if (!creating) setCreateModalOpen(false);
        }}
        primaryButtonDisabled={!isFormValid() || creating || loadingUsers}
        secondaryButtonDisabled={creating}
        preventCloseOnClickOutside={creating}
        preventCloseOnEscape={creating}
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
            disabled={creating}
          />

          <div style={{ marginTop: '1rem' }}>
            <h4 style={{ marginBottom: '1rem' }}>Assign Users to Roles</h4>
            <p style={{ marginBottom: '1rem', color: 'var(--cds-text-secondary)', fontSize: '0.875rem' }}>
              Each role must be assigned to a user. The same user can be assigned to multiple roles. Only users who have completed their initial login and registered a public key are eligible.
            </p>

            {loadingUsers ? (
              <div style={{ padding: '2rem', textAlign: 'center' }}>
                <InlineLoader size="sm" message="Loading users..." />
              </div>
            ) : users.length === 0 ? (
              <div style={{
                padding: '1rem',
                backgroundColor: 'var(--cds-layer-01)',
                borderLeft: '4px solid var(--cds-support-error)',
                marginBottom: '1rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <WarningAlt size={20} style={{ color: 'var(--cds-support-error)' }} />
                  <span>Failed to load users. Please try again.</span>
                </div>
              </div>
            ) : (
              <Stack gap={5}>
              {[
                { role: ROLES.SOLUTION_PROVIDER, id: 'solution-provider', label: 'Solution Provider' },
                { role: ROLES.DATA_OWNER,        id: 'data-owner',        label: 'Data Owner' },
                { role: ROLES.AUDITOR,           id: 'auditor',           label: 'Auditor' },
                { role: ROLES.ENV_OPERATOR,      id: 'env-operator',      label: 'Environment Operator' }
              ].map(({ role, id, label }) => {
                const readyUsers = getUsersByRole(role);
                const notReadyCount = getNotReadyCountByRole(role);
                const helperText = notReadyCount > 0
                  ? `${notReadyCount} user(s) excluded — pending initial login or public key registration.`
                  : readyUsers.length === 0
                  ? 'No eligible users. Users must complete initial login and register a public key.'
                  : undefined;

                return (
                  <Select
                    key={role}
                    id={id}
                    labelText={label}
                    value={assignments[role]}
                    helperText={helperText}
                    onChange={(e) => setAssignments({ ...assignments, [role]: e.target.value })}
                    disabled={creating || loadingUsers}
                  >
                    <SelectItem value="" text="Select a user" />
                    {readyUsers.map(user => (
                      <SelectItem key={user.id} value={user.id} text={user.name} />
                    ))}
                  </Select>
                );
              })}
              </Stack>
            )}
          </div>
        </Stack>
      </Modal>
    </div>
  );
};

export default BuildManagement;
