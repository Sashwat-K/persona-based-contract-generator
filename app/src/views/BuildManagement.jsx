import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Stack,
  InlineNotification
} from '@carbon/react';
import { Add, WarningAlt, Renew } from '@carbon/icons-react';
import { BUILD_STATUS_CONFIG, ROLES } from '../utils/constants';
import { formatDate } from '../utils/formatters';
import userService from '../services/userService';
import buildService from '../services/buildService';
import assignmentService from '../services/assignmentService';
import { InlineLoader } from '../components/LoadingSpinner';
import { useAuthStore } from '../store/authStore';
import { StatePanel } from '../components/StatePanel';

const TABLE_HEADERS = [
  { key: 'name', header: 'Build Name' },
  { key: 'status', header: 'Status' },
  { key: 'createdBy', header: 'Created By' },
  { key: 'createdAt', header: 'Created At' },
  { key: 'action', header: '' }
];

const BUILD_ASSIGNMENT_FIELDS = [
  { role: ROLES.SOLUTION_PROVIDER, id: 'solution-provider', label: 'Solution Provider' },
  { role: ROLES.DATA_OWNER,        id: 'data-owner',        label: 'Data Owner' },
  { role: ROLES.AUDITOR,           id: 'auditor',           label: 'Auditor' },
  { role: ROLES.ENV_OPERATOR,      id: 'env-operator',      label: 'Environment Operator' }
];

const EMPTY_ASSIGNMENTS = {
  [ROLES.SOLUTION_PROVIDER]: '',
  [ROLES.DATA_OWNER]: '',
  [ROLES.AUDITOR]: '',
  [ROLES.ENV_OPERATOR]: ''
};

const BuildManagement = ({ builds, onSelectBuild, userRole, onBuildCreated }) => {
  const isAdmin = userRole === 'ADMIN';
  const isSetupRequired = useAuthStore((state) => state.isSetupRequired());
  const setupPending = useAuthStore((state) => state.getSetupPending());
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [buildName, setBuildName] = useState('');
  const [assignments, setAssignments] = useState(EMPTY_ASSIGNMENTS);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notification, setNotification] = useState(null);

  const loadUsers = useCallback(async () => {
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
  }, []);

  // Load users when modal opens
  useEffect(() => {
    if (createModalOpen && users.length === 0) {
      loadUsers();
    }
  }, [createModalOpen, users.length, loadUsers]);

  const rows = useMemo(() => builds.map(b => ({
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
  })), [builds, onSelectBuild]);

  // Get users by role for assignment dropdowns
  const isUserReady = (u) =>
    u.is_active &&
    !u.must_change_password &&
    u.public_key_fingerprint != null;

  // Show all ready users in every role dropdown — one person can cover multiple roles.
  // The build assignment (not system role) controls access per build.
  const readyUsers = useMemo(() => users.filter(isUserReady), [users]);
  const notReadyCount = useMemo(
    () => users.filter(u => u.is_active && !isUserReady(u)).length,
    [users]
  );

  const handleCreateBuild = useCallback(async () => {
    if (creating) return;

    if (isSetupRequired) {
      setNotification({
        kind: 'warning',
        title: 'Setup Required',
        subtitle: `Account setup is required before creating builds. Pending: ${setupPending.join(', ')}`
      });
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
      setAssignments(EMPTY_ASSIGNMENTS);
      setCreateModalOpen(false);
      if (onBuildCreated) await onBuildCreated();
      setNotification({
        kind: 'success',
        title: 'Build Created',
        subtitle: `Build "${buildName}" created successfully.`
      });

    } catch (err) {
      console.error('Failed to create build:', err);
      setNotification({
        kind: 'error',
        title: 'Failed to Create Build',
        subtitle: err.message || 'Unexpected error while creating build.'
      });
    } finally {
      setCreating(false);
    }
  }, [assignments, buildName, creating, isSetupRequired, onBuildCreated, setupPending]);

  const isFormValid = useMemo(() => {
    return Boolean(buildName.trim() &&
           assignments[ROLES.SOLUTION_PROVIDER] &&
           assignments[ROLES.DATA_OWNER] &&
           assignments[ROLES.AUDITOR] &&
           assignments[ROLES.ENV_OPERATOR]);
  }, [assignments, buildName]);

  const handleRefresh = useCallback(async () => {
    if (!onBuildCreated) return;
    setRefreshing(true);
    try {
      await onBuildCreated();
    } finally {
      setRefreshing(false);
    }
  }, [onBuildCreated]);

  return (
    <div className="app-page">
      {notification && (
        <InlineNotification
          kind={notification.kind}
          title={notification.title}
          subtitle={notification.subtitle}
          lowContrast
          className="build-management-notification"
          onCloseButtonClick={() => setNotification(null)}
        />
      )}

      <div className="app-page__header">
        <h1 className="app-page__title">Build Management</h1>
        <div className="app-page__actions">
          <Button
            kind="tertiary"
            size="md"
            renderIcon={Renew}
            iconDescription="Refresh"
            disabled={refreshing}
            onClick={handleRefresh}
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
        <div className="build-management-setup-alert">
          Account setup is incomplete. Complete password change and public key registration in Account Settings before creating builds.
        </div>
      )}

      {builds.length === 0 ? (
        <StatePanel
          title="No Builds Found"
          description={
            isAdmin
              ? 'Get started by creating your first build.'
              : 'No builds have been created yet. Contact your administrator.'
          }
          action={
            isAdmin ? (
              <Button
                renderIcon={Add}
                disabled={isSetupRequired || creating}
                onClick={() => setCreateModalOpen(true)}
              >
                {isSetupRequired ? 'Complete Setup First' : 'Create First Build'}
              </Button>
            ) : null
          }
        />
      ) : (
        <DataTable rows={rows} headers={TABLE_HEADERS}>
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
        primaryButtonDisabled={!isFormValid || creating || loadingUsers}
        preventCloseOnClickOutside={creating}
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

          <div className="build-management-modal-section">
            <h4 className="build-management-modal-title">Assign Users to Roles</h4>
            <p className="build-management-modal-description">
              Each role must be assigned to a user. The same user can be assigned to multiple roles. Only users who have completed their initial login and registered a public key are eligible.
            </p>

            {loadingUsers ? (
              <div className="build-management-users-loading">
                <InlineLoader size="sm" message="Loading users..." />
              </div>
            ) : users.length === 0 ? (
              <div className="build-management-users-error">
                <div className="build-management-users-error__content">
                  <WarningAlt size={20} className="build-management-users-error__icon" />
                  <span>Failed to load users. Please try again.</span>
                </div>
              </div>
            ) : (
              <Stack gap={5}>
              {BUILD_ASSIGNMENT_FIELDS.map(({ role, id, label }) => {
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
                    onChange={(e) => setAssignments(prev => ({ ...prev, [role]: e.target.value }))}
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
