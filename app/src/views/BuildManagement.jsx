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
  InlineNotification,
  Pagination
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

const COMPLETED_BUILD_STATUSES = new Set(['CONTRACT_DOWNLOADED', 'CANCELLED']);
const TABLE_PAGE_SIZES = [10, 20, 30, 50];

const TABLE_HEADERS = [
  { key: 'name', header: 'Build Name' },
  { key: 'status', header: 'Status' },
  { key: 'createdBy', header: 'Created By' },
  { key: 'createdAt', header: 'Created At' },
  { key: 'action', header: '' }
];

const BUILD_ASSIGNMENT_FIELDS = [
  { role: ROLES.AUDITOR,           id: 'auditor',           label: 'Auditor' },
  { role: ROLES.SOLUTION_PROVIDER, id: 'solution-provider', label: 'Solution Provider' },
  { role: ROLES.DATA_OWNER,        id: 'data-owner',        label: 'Data Owner' },
  { role: ROLES.ENV_OPERATOR,      id: 'env-operator',      label: 'Environment Operator' }
];

const ROLE_LABEL_BY_KEY = BUILD_ASSIGNMENT_FIELDS.reduce((acc, field) => {
  acc[field.role] = field.label;
  return acc;
}, {});

const EMPTY_ASSIGNMENTS = {
  [ROLES.SOLUTION_PROVIDER]: '',
  [ROLES.DATA_OWNER]: '',
  [ROLES.AUDITOR]: '',
  [ROLES.ENV_OPERATOR]: ''
};

const normalizeUserRole = (role) => {
  if (!role) return '';
  if (typeof role === 'string') return role.toUpperCase();
  return String(role.role_name || role.name || role).toUpperCase();
};

const userHasRole = (user, roleName) => {
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  return roles.some((role) => normalizeUserRole(role) === roleName);
};

const BuildManagement = ({ builds, onSelectBuild, userRole, onBuildCreated }) => {
  const isAdmin = userRole === 'ADMIN';
  const canManageBuilds = isAdmin || userRole === 'AUDITOR';
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
  const [activePage, setActivePage] = useState(1);
  const [activePageSize, setActivePageSize] = useState(TABLE_PAGE_SIZES[0]);
  const [completedPage, setCompletedPage] = useState(1);
  const [completedPageSize, setCompletedPageSize] = useState(TABLE_PAGE_SIZES[0]);

  const loadUsers = useCallback(async () => {
    if (!canManageBuilds) return;
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
  }, [canManageBuilds]);

  // Load users when modal opens
  useEffect(() => {
    if (canManageBuilds && createModalOpen && users.length === 0) {
      loadUsers();
    }
  }, [canManageBuilds, createModalOpen, users.length, loadUsers]);

  const getBuildStatusMeta = useCallback((build) => {
    const statusKey = (build.status || '').toUpperCase();
    const statusConfig = BUILD_STATUS_CONFIG[statusKey] || BUILD_STATUS_CONFIG[build.status];
    return {
      kind: statusConfig?.kind || 'gray',
      label: statusConfig?.label || statusKey || 'Unknown'
    };
  }, []);

  const mapBuildRows = useCallback((list) => list.map((b) => ({
    id: b.id,
    name: b.name,
    status: (() => {
      const statusMeta = getBuildStatusMeta(b);
      return (
        <Tag type={statusMeta.kind}>
          {statusMeta.label}
        </Tag>
      );
    })(),
    createdBy: b.created_by || b.createdBy || 'Admin',
    createdAt: formatDate(b.created_at || b.createdAt),
    action: <Button size="sm" onClick={() => onSelectBuild(b.id)}>View Details</Button>
  })), [getBuildStatusMeta, onSelectBuild]);

  const activeBuilds = useMemo(
    () => builds.filter((build) => !COMPLETED_BUILD_STATUSES.has((build.status || '').toUpperCase())),
    [builds]
  );
  const completedBuilds = useMemo(
    () => builds.filter((build) => COMPLETED_BUILD_STATUSES.has((build.status || '').toUpperCase())),
    [builds]
  );

  const activeRows = useMemo(() => mapBuildRows(activeBuilds), [activeBuilds, mapBuildRows]);
  const completedRows = useMemo(() => mapBuildRows(completedBuilds), [completedBuilds, mapBuildRows]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(activeRows.length / activePageSize));
    if (activePage > maxPage) {
      setActivePage(maxPage);
    }
  }, [activeRows.length, activePage, activePageSize]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(completedRows.length / completedPageSize));
    if (completedPage > maxPage) {
      setCompletedPage(maxPage);
    }
  }, [completedRows.length, completedPage, completedPageSize]);

  const paginatedActiveRows = useMemo(() => {
    const startIndex = (activePage - 1) * activePageSize;
    return activeRows.slice(startIndex, startIndex + activePageSize);
  }, [activeRows, activePage, activePageSize]);

  const paginatedCompletedRows = useMemo(() => {
    const startIndex = (completedPage - 1) * completedPageSize;
    return completedRows.slice(startIndex, startIndex + completedPageSize);
  }, [completedRows, completedPage, completedPageSize]);

  // Get users by role for assignment dropdowns
  const isUserReady = (u) =>
    u.is_active &&
    !u.must_change_password &&
    u.public_key_fingerprint != null;

  const readyUsers = useMemo(() => users.filter(isUserReady), [users]);
  const eligibleUsersByRole = useMemo(
    () => BUILD_ASSIGNMENT_FIELDS.reduce((acc, { role }) => {
      acc[role] = readyUsers.filter((user) => userHasRole(user, role));
      return acc;
    }, {}),
    [readyUsers]
  );
  const notReadyCount = useMemo(
    () => users.filter((u) => u.is_active && !isUserReady(u)).length,
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
      if (canManageBuilds) {
        const roleAssignments = [
          { role: ROLES.AUDITOR,           userId: assignments[ROLES.AUDITOR] },
          { role: ROLES.SOLUTION_PROVIDER, userId: assignments[ROLES.SOLUTION_PROVIDER] },
          { role: ROLES.DATA_OWNER,        userId: assignments[ROLES.DATA_OWNER] },
          { role: ROLES.ENV_OPERATOR,      userId: assignments[ROLES.ENV_OPERATOR] }
        ].filter(a => a.userId);

        for (const assignment of roleAssignments) {
          const selectedUser = users.find((user) => user.id === assignment.userId);
          const roleLabel = ROLE_LABEL_BY_KEY[assignment.role] || assignment.role;
          if (!selectedUser) {
            throw new Error(`Selected user not found for ${roleLabel}.`);
          }
          if (!userHasRole(selectedUser, assignment.role)) {
            throw new Error(`${selectedUser.name} does not have ${roleLabel} role.`);
          }
          try {
            await assignmentService.createAssignment(build.id, assignment.userId, assignment.role);
          } catch (err) {
            throw new Error(`Failed to assign ${roleLabel}: ${err.message}`);
          }
        }
      }

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
  }, [assignments, buildName, canManageBuilds, creating, isSetupRequired, onBuildCreated, setupPending, users]);

  const isFormValid = useMemo(() => {
    return Boolean(
      buildName.trim() &&
      assignments[ROLES.SOLUTION_PROVIDER] &&
      assignments[ROLES.DATA_OWNER] &&
      assignments[ROLES.AUDITOR] &&
      assignments[ROLES.ENV_OPERATOR]
    );
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
          {canManageBuilds && (
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
              : canManageBuilds
              ? 'Get started by creating your first build.'
              : 'No builds have been created yet. Contact your administrator.'
          }
          action={
            canManageBuilds ? (
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
        <div className="build-management-table-stack">
          {activeRows.length > 0 && (
            <DataTable rows={paginatedActiveRows} headers={TABLE_HEADERS}>
              {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
                <TableContainer
                  title="Active & In-Progress Builds"
                  description="Builds that are still in progress or awaiting final actions."
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

                  <div className="build-management-pagination">
                    <Pagination
                      page={activePage}
                      pageSize={activePageSize}
                      pageSizes={TABLE_PAGE_SIZES}
                      totalItems={activeRows.length}
                      size="sm"
                      onChange={({ page, pageSize }) => {
                        setActivePage(page);
                        setActivePageSize(pageSize);
                      }}
                    />
                  </div>
                </TableContainer>
              )}
            </DataTable>
          )}

          {completedRows.length > 0 && (
            <DataTable rows={paginatedCompletedRows} headers={TABLE_HEADERS}>
              {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
                <TableContainer
                  title="Completed Builds"
                  description="Downloaded and cancelled builds."
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

                  <div className="build-management-pagination">
                    <Pagination
                      page={completedPage}
                      pageSize={completedPageSize}
                      pageSizes={TABLE_PAGE_SIZES}
                      totalItems={completedRows.length}
                      size="sm"
                      onChange={({ page, pageSize }) => {
                        setCompletedPage(page);
                        setCompletedPageSize(pageSize);
                      }}
                    />
                  </div>
                </TableContainer>
              )}
            </DataTable>
          )}
        </div>
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
        preventCloseOnClickOutside
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

          {canManageBuilds ? (
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
                    const roleEligibleUsers = eligibleUsersByRole[role] || [];
                    const helperText = (notReadyCount > 0 || roleEligibleUsers.length === 0)
                      ? [
                        notReadyCount > 0
                          ? `${notReadyCount} user(s) excluded — pending initial login, password reset, or public key registration`
                          : null,
                        roleEligibleUsers.length === 0
                          ? `No eligible users with ${label} role`
                          : null
                      ].filter(Boolean).join('; ')
                      : readyUsers.length === 0
                      ? 'No eligible users. Users must complete initial setup.'
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
                        {roleEligibleUsers.map(user => (
                          <SelectItem key={user.id} value={user.id} text={user.name} />
                        ))}
                      </Select>
                    );
                  })}
                </Stack>
              )}
            </div>
          ) : null}
        </Stack>
      </Modal>
    </div>
  );
};

export default BuildManagement;
