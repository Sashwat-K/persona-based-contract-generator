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
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
  TableToolbarMenu,
  TableToolbarAction,
  TableBatchActions,
  TableBatchAction,
  TableSelectAll,
  TableSelectRow,
  Button,
  Modal,
  TextInput,
  Select,
  SelectItem,
  Tag,
  Stack,
  InlineNotification,
  Pagination,
  FilterableMultiSelect,
  DatePicker,
  DatePickerInput,
  Dropdown,
  InlineLoading
} from '@carbon/react';
import { Add, WarningAlt, Renew, Download, Filter, Close, TrashCan, Export } from '@carbon/icons-react';
import { BUILD_STATUS_CONFIG, ROLES } from '../utils/constants';
import { formatDate } from '../utils/formatters';
import { validateBuildName } from '../utils/validators';
import userService from '../services/userService';
import buildService from '../services/buildService';
import assignmentService from '../services/assignmentService';
import { InlineLoader, DataTableSkeletonLoader } from '../components/LoadingSpinner';
import { useAuthStore } from '../store/authStore';
import { StatePanel } from '../components/StatePanel';
import FilterPresetManager from '../components/FilterPresetManager';
import BuildStatistics from '../components/BuildStatistics';

const COMPLETED_BUILD_STATUSES = new Set(['CONTRACT_DOWNLOADED', 'CANCELLED']);
const TABLE_PAGE_SIZES = [10, 20, 30, 50];

// Filter options for status
const STATUS_FILTER_OPTIONS = Object.entries(BUILD_STATUS_CONFIG).map(([key, config]) => ({
  id: key,
  label: config.label,
  value: key
}));

// Date range presets
const DATE_RANGE_PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'last7days', label: 'Last 7 Days' },
  { id: 'last30days', label: 'Last 30 Days' },
  { id: 'custom', label: 'Custom Range' }
];

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

const BuildManagement = ({ builds, onSelectBuild, userRole, onBuildCreated, loading = false }) => {
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
  
  // Separate search for each table
  const [activeSearchValue, setActiveSearchValue] = useState('');
  const [completedSearchValue, setCompletedSearchValue] = useState('');
  
  // Shared filter and sort state
  const [sortInfo, setSortInfo] = useState({ columnKey: 'createdAt', direction: 'DESC' });
  const [buildNameTouched, setBuildNameTouched] = useState(false);
  const [buildNameError, setBuildNameError] = useState('');
  
  // Advanced filter state (shared between tables)
  const [showFilters, setShowFilters] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [selectedCreator, setSelectedCreator] = useState('');
  const [dateRangePreset, setDateRangePreset] = useState('');
  const [customDateRange, setCustomDateRange] = useState({ start: null, end: null });
  
  // Bulk actions state
  const [selectedBuildIds, setSelectedBuildIds] = useState([]);
  const [bulkActionInProgress, setBulkActionInProgress] = useState(false);
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [bulkExportInProgress, setBulkExportInProgress] = useState(false);

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

  // Load users on component mount
  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Helper function to get user name from ID
  const getUserName = useCallback((userId) => {
    if (!userId) return 'Unknown';
    const user = users.find(u => u.id === userId || u.user_id === userId);
    return user ? (user.name || user.username || user.email || 'Unknown') : userId;
  }, [users]);

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
    createdBy: getUserName(b.created_by || b.createdBy),
    createdAt: formatDate(b.created_at || b.createdAt),
    // Store raw values for sorting
    _rawStatus: (b.status || '').toUpperCase(),
    _rawCreatedAt: new Date(b.created_at || b.createdAt).getTime(),
    _rawCreatedBy: getUserName(b.created_by || b.createdBy),
    action: <Button size="sm" onClick={() => onSelectBuild(b.id)}>View Details</Button>
  })), [getBuildStatusMeta, onSelectBuild, getUserName]);

  // Filter builds based on search
  const filterBuilds = useCallback((buildList, searchValue) => {
    if (!searchValue.trim()) return buildList;
    const searchLower = searchValue.toLowerCase();
    return buildList.filter((build) =>
      (build.name || '').toLowerCase().includes(searchLower) ||
      (build.status || '').toLowerCase().includes(searchLower) ||
      getUserName(build.created_by || build.createdBy).toLowerCase().includes(searchLower)
    );
  }, [getUserName]);

  // Sort builds
  const sortBuilds = useCallback((buildList) => {
    if (!sortInfo.columnKey) return buildList;
    
    return [...buildList].sort((a, b) => {
      let aVal, bVal;
      
      switch (sortInfo.columnKey) {
        case 'name':
          aVal = (a.name || '').toLowerCase();
          bVal = (b.name || '').toLowerCase();
          break;
        case 'status':
          aVal = (a.status || '').toUpperCase();
          bVal = (b.status || '').toUpperCase();
          break;
        case 'createdBy':
          aVal = getUserName(a.created_by || a.createdBy).toLowerCase();
          bVal = getUserName(b.created_by || b.createdBy).toLowerCase();
          break;
        case 'createdAt':
          aVal = new Date(a.created_at || a.createdAt).getTime();
          bVal = new Date(b.created_at || b.createdAt).getTime();
          break;
        default:
          return 0;
      }
      
      if (aVal < bVal) return sortInfo.direction === 'ASC' ? -1 : 1;
      if (aVal > bVal) return sortInfo.direction === 'ASC' ? 1 : -1;
      return 0;
    });
  }, [sortInfo]);

  // Advanced filter: Apply status filter
  const applyStatusFilter = useCallback((buildList) => {
    if (selectedStatuses.length === 0) return buildList;
    return buildList.filter((build) =>
      selectedStatuses.includes((build.status || '').toUpperCase())
    );
  }, [selectedStatuses]);

  // Advanced filter: Apply creator filter
  const applyCreatorFilter = useCallback((buildList) => {
    if (!selectedCreator) return buildList;
    return buildList.filter((build) =>
      getUserName(build.created_by || build.createdBy) === selectedCreator
    );
  }, [selectedCreator, getUserName]);

  // Advanced filter: Apply date range filter
  const applyDateRangeFilter = useCallback((buildList) => {
    const { start, end } = customDateRange;
    if (!start && !end) return buildList;
    
    return buildList.filter((build) => {
      const buildDate = new Date(build.created_at || build.createdAt);
      if (start && buildDate < new Date(start)) return false;
      if (end) {
        const endDate = new Date(end);
        endDate.setHours(23, 59, 59, 999); // Include entire end day
        if (buildDate > endDate) return false;
      }
      return true;
    });
  }, [customDateRange]);

  // Get unique creators from builds
  const creatorOptions = useMemo(() => {
    const creators = new Set();
    builds.forEach((build) => {
      const creator = getUserName(build.created_by || build.createdBy);
      creators.add(creator);
    });
    return Array.from(creators).sort().map((creator) => ({
      id: creator,
      label: creator,
      value: creator
    }));
  }, [builds]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedStatuses.length > 0) count++;
    if (selectedCreator) count++;
    if (customDateRange.start || customDateRange.end) count++;
    return count;
  }, [selectedStatuses, selectedCreator, customDateRange]);
  
  // Bulk action handlers
  const handleBulkExport = useCallback(async () => {
    if (selectedBuildIds.length === 0) return;
    
    try {
      setBulkExportInProgress(true);
      
      // Get selected builds data
      const selectedBuilds = builds.filter(b => selectedBuildIds.includes(b.id));
      
      // Export as CSV
      const headers = ['Build Name', 'Status', 'Created By', 'Created At'];
      const csvContent = [
        headers.join(','),
        ...selectedBuilds.map(build => [
          `"${build.name}"`,
          `"${(build.status || '').toUpperCase()}"`,
          `"${build.created_by || build.createdBy || 'Admin'}"`,
          `"${formatDate(build.created_at || build.createdAt)}"`
        ].join(','))
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `bulk-export-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setNotification({
        kind: 'success',
        title: 'Export Successful',
        subtitle: `Exported ${selectedBuildIds.length} build(s) to CSV`
      });
      
      // Clear selection
      setSelectedBuildIds([]);
    } catch (error) {
      console.error('Bulk export failed:', error);
      setNotification({
        kind: 'error',
        title: 'Export Failed',
        subtitle: error.message || 'Failed to export selected builds'
      });
    } finally {
      setBulkExportInProgress(false);
    }
  }, [selectedBuildIds, builds]);
  
  const handleBulkDelete = useCallback(async () => {
    if (selectedBuildIds.length === 0) return;
    
    try {
      setBulkActionInProgress(true);
      
      // Delete builds one by one
      const deletePromises = selectedBuildIds.map(buildId =>
        buildService.cancelBuild(buildId)
      );
      
      await Promise.all(deletePromises);
      
      setNotification({
        kind: 'success',
        title: 'Builds Cancelled',
        subtitle: `Successfully cancelled ${selectedBuildIds.length} build(s)`
      });
      
      // Clear selection and refresh
      setSelectedBuildIds([]);
      setBulkDeleteModalOpen(false);
      
      // Trigger refresh
      if (onBuildCreated) {
        onBuildCreated();
      }
    } catch (error) {
      console.error('Bulk delete failed:', error);
      setNotification({
        kind: 'error',
        title: 'Cancellation Failed',
        subtitle: error.message || 'Failed to cancel selected builds'
      });
    } finally {
      setBulkActionInProgress(false);
    }
  }, [selectedBuildIds, onBuildCreated]);
  
  const getSelectedBuildsInfo = useCallback(() => {
    const selectedBuilds = builds.filter(b => selectedBuildIds.includes(b.id));
    return {
      count: selectedBuilds.length,
      names: selectedBuilds.map(b => b.name).join(', ')
    };
  }, [selectedBuildIds, builds]);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setSelectedStatuses([]);
    setSelectedCreator('');
    setDateRangePreset('');
    setCustomDateRange({ start: null, end: null });
  }, []);

  // Apply filter preset
  const handleApplyFilterPreset = useCallback((filters) => {
    setSelectedStatuses(filters.selectedStatuses || []);
    setSelectedCreator(filters.selectedCreator || '');
    setDateRangePreset(filters.dateRangePreset || '');
    setCustomDateRange(filters.customDateRange || { start: null, end: null });
    
    // Show filters panel if not already visible
    if (!showFilters) {
      setShowFilters(true);
    }
    
    setNotification({
      kind: 'success',
      title: 'Filter Preset Applied',
      subtitle: 'Your saved filter preset has been applied successfully'
    });
  }, [showFilters]);

  // Get current filter state for saving
  const getCurrentFilters = useCallback(() => ({
    selectedStatuses,
    selectedCreator,
    dateRangePreset,
    customDateRange
  }), [selectedStatuses, selectedCreator, dateRangePreset, customDateRange]);

  // Handle date range preset selection
  const handleDateRangePreset = useCallback((presetId) => {
    setDateRangePreset(presetId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    switch (presetId) {
      case 'today':
        setCustomDateRange({ start: today.toISOString(), end: today.toISOString() });
        break;
      case 'last7days':
        const last7 = new Date(today);
        last7.setDate(last7.getDate() - 7);
        setCustomDateRange({ start: last7.toISOString(), end: today.toISOString() });
        break;
      case 'last30days':
        const last30 = new Date(today);
        last30.setDate(last30.getDate() - 30);
        setCustomDateRange({ start: last30.toISOString(), end: today.toISOString() });
        break;
      case 'custom':
        // User will set custom dates
        break;
      default:
        setCustomDateRange({ start: null, end: null });
    }
  }, []);

  const activeBuilds = useMemo(
    () => {
      let filtered = builds.filter((build) => !COMPLETED_BUILD_STATUSES.has((build.status || '').toUpperCase()));
      
      // Apply advanced filters
      filtered = applyStatusFilter(filtered);
      filtered = applyCreatorFilter(filtered);
      filtered = applyDateRangeFilter(filtered);
      
      // Apply search (active table specific)
      filtered = filterBuilds(filtered, activeSearchValue);
      
      // Apply sorting
      return sortBuilds(filtered);
    },
    [builds, applyStatusFilter, applyCreatorFilter, applyDateRangeFilter, filterBuilds, sortBuilds, activeSearchValue]
  );
  
  const completedBuilds = useMemo(
    () => {
      let filtered = builds.filter((build) => COMPLETED_BUILD_STATUSES.has((build.status || '').toUpperCase()));
      
      // Apply advanced filters
      filtered = applyStatusFilter(filtered);
      filtered = applyCreatorFilter(filtered);
      filtered = applyDateRangeFilter(filtered);
      
      // Apply search (completed table specific)
      filtered = filterBuilds(filtered, completedSearchValue);
      
      // Apply sorting
      return sortBuilds(filtered);
    },
    [builds, applyStatusFilter, applyCreatorFilter, applyDateRangeFilter, filterBuilds, sortBuilds, completedSearchValue]
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

  // Validate build name
  const validateBuildNameField = useCallback((value) => {
    if (!buildNameTouched) return;
    const result = validateBuildName(value);
    setBuildNameError(result.valid ? '' : result.error);
  }, [buildNameTouched]);

  // Handle build name change
  const handleBuildNameChange = useCallback((e) => {
    const value = e.target.value;
    setBuildName(value);
    if (buildNameTouched) {
      const result = validateBuildName(value);
      setBuildNameError(result.valid ? '' : result.error);
    }
  }, [buildNameTouched]);

  const isFormValid = useMemo(() => {
    const nameValidation = validateBuildName(buildName);
    return Boolean(
      nameValidation.valid &&
      assignments[ROLES.SOLUTION_PROVIDER] &&
      assignments[ROLES.DATA_OWNER] &&
      assignments[ROLES.AUDITOR] &&
      assignments[ROLES.ENV_OPERATOR]
    );
  }, [assignments, buildName]);

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


  const handleRefresh = useCallback(async () => {
    if (!onBuildCreated) return;
    setRefreshing(true);
    try {
      await onBuildCreated();
    } finally {
      setRefreshing(false);
    }
  }, [onBuildCreated]);

  const handleExportCSV = useCallback((rows, filename) => {
    const headers = TABLE_HEADERS.filter(h => h.key !== 'action').map(h => h.header);
    const csvContent = [
      headers.join(','),
      ...rows.map(row =>
        TABLE_HEADERS.filter(h => h.key !== 'action')
          .map(h => {
            const value = h.key === 'status' ? row._rawStatus : row[h.key];
            return `"${String(value || '').replace(/"/g, '""')}"`;
          })
          .join(',')
      )
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }, []);

  const handleSort = useCallback((headerKey) => {
    setSortInfo(prev => ({
      columnKey: headerKey,
      direction: prev.columnKey === headerKey && prev.direction === 'ASC' ? 'DESC' : 'ASC'
    }));
  }, []);

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

      {/* Build Statistics */}
      {!loading && builds.length > 0 && (
        <BuildStatistics builds={builds} loading={loading} />
      )}

      {loading ? (
        <div className="build-management-loading">
          <DataTableSkeletonLoader
            rows={5}
            columns={5}
            showHeader={true}
            showToolbar={true}
          />
        </div>
      ) : builds.length === 0 ? (
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
            <DataTable
              rows={paginatedActiveRows}
              headers={TABLE_HEADERS}
              isSortable
              radio={false}
              selectedRows={selectedBuildIds}
              onSelectionChange={(selectedRows) => {
                setSelectedBuildIds(selectedRows.map(row => row.id));
              }}
              aria-label="Active and in-progress builds table"
            >
              {({
                rows,
                headers,
                getTableProps,
                getHeaderProps,
                getRowProps,
                getSelectionProps,
                getBatchActionProps,
                selectedRows
              }) => {
                const batchActionProps = getBatchActionProps();
                
                return (
                  <TableContainer
                    title="Active & In-Progress Builds"
                    description="Builds that are still in progress or awaiting final actions."
                    aria-label="Active builds container"
                  >
                    <TableToolbar>
                      <TableBatchActions
                        {...batchActionProps}
                        onCancel={() => setSelectedBuildIds([])}
                      >
                        <TableBatchAction
                          renderIcon={Export}
                          iconDescription="Export selected builds"
                          onClick={handleBulkExport}
                          disabled={bulkExportInProgress}
                          aria-label="Export selected builds to CSV"
                        >
                          {bulkExportInProgress ? 'Exporting...' : 'Export Selected'}
                        </TableBatchAction>
                        {canManageBuilds && (
                          <TableBatchAction
                            renderIcon={TrashCan}
                            iconDescription="Cancel selected builds"
                            onClick={() => setBulkDeleteModalOpen(true)}
                            disabled={bulkActionInProgress}
                            aria-label="Cancel selected builds"
                          >
                            Cancel Selected
                          </TableBatchAction>
                        )}
                      </TableBatchActions>
                      <TableToolbarContent>
                        <TableToolbarSearch
                          persistent
                          placeholder="Search active builds..."
                          onChange={(e) => setActiveSearchValue(e.target.value)}
                          value={activeSearchValue}
                          aria-label="Search active builds"
                        />
                        <Button
                          kind="ghost"
                          size="sm"
                          className="build-management-toolbar-filter"
                          renderIcon={Filter}
                          iconDescription="Toggle filters"
                          hasIconOnly={!activeFilterCount}
                          onClick={() => setShowFilters(!showFilters)}
                          aria-label={showFilters ? 'Hide filters' : 'Show filters'}
                          aria-expanded={showFilters}
                        >
                          {activeFilterCount > 0 && `Filters (${activeFilterCount})`}
                        </Button>
                        {activeFilterCount > 0 && (
                          <Button
                            kind="ghost"
                            size="sm"
                            renderIcon={Close}
                            iconDescription="Clear all filters"
                            onClick={clearAllFilters}
                            aria-label="Clear all active filters"
                          >
                            Clear Filters
                          </Button>
                        )}
                        <TableToolbarMenu className="build-management-toolbar-menu">
                          <TableToolbarAction onClick={() => handleExportCSV(activeRows, 'active-builds')}>
                            Export as CSV
                          </TableToolbarAction>
                        </TableToolbarMenu>
                        <Button
                          kind="primary"
                          size="sm"
                          className="build-management-toolbar-export"
                          renderIcon={Download}
                          onClick={() => handleExportCSV(activeRows, 'active-builds')}
                          aria-label="Export active builds to CSV"
                        >
                          Export
                        </Button>
                      </TableToolbarContent>
                    </TableToolbar>
                  
                  {showFilters && (
                    <div className="build-management-filters" role="region" aria-label="Build filters">
                      <FilterPresetManager
                        currentFilters={getCurrentFilters()}
                        onApplyPreset={handleApplyFilterPreset}
                        storageKey="build_management_filter_presets"
                      />
                      
                      <div className="build-management-filters__row">
                        <FilterableMultiSelect
                          id="status-filter"
                          titleText="Status"
                          label="Filter by status"
                          items={STATUS_FILTER_OPTIONS}
                          itemToString={(item) => item ? item.label : ''}
                          selectedItems={STATUS_FILTER_OPTIONS.filter(opt => selectedStatuses.includes(opt.id))}
                          onChange={({ selectedItems }) => {
                            setSelectedStatuses(selectedItems.map(item => item.id));
                          }}
                          size="sm"
                        />
                        
                        <Dropdown
                          id="creator-filter"
                          titleText="Creator"
                          label="Filter by creator"
                          items={[{ id: '', label: 'All Creators', value: '' }, ...creatorOptions]}
                          itemToString={(item) => item ? item.label : ''}
                          selectedItem={creatorOptions.find(opt => opt.id === selectedCreator) || { id: '', label: 'All Creators', value: '' }}
                          onChange={({ selectedItem }) => {
                            setSelectedCreator(selectedItem?.id || '');
                          }}
                          size="sm"
                        />
                        
                        <Select
                          id="date-preset"
                          labelText="Date Range"
                          value={dateRangePreset}
                          onChange={(e) => handleDateRangePreset(e.target.value)}
                          size="sm"
                        >
                          <SelectItem value="" text="All Dates" />
                          {DATE_RANGE_PRESETS.map((preset) => (
                            <SelectItem key={preset.id} value={preset.id} text={preset.label} />
                          ))}
                        </Select>
                        
                        {dateRangePreset === 'custom' && (
                          <DatePicker
                            datePickerType="range"
                            onChange={(dates) => {
                              setCustomDateRange({
                                start: dates[0] ? dates[0].toISOString() : null,
                                end: dates[1] ? dates[1].toISOString() : null
                              });
                            }}
                          >
                            <DatePickerInput
                              id="date-start"
                              placeholder="mm/dd/yyyy"
                              labelText="Start Date"
                              size="sm"
                            />
                            <DatePickerInput
                              id="date-end"
                              placeholder="mm/dd/yyyy"
                              labelText="End Date"
                              size="sm"
                            />
                          </DatePicker>
                        )}
                      </div>
                    </div>
                  )}
                    <Table {...getTableProps()}>
                      <TableHead>
                        <TableRow>
                          <TableSelectAll {...getSelectionProps()} />
                          {headers.map((header) => {
                            const { key, ...headerProps } = getHeaderProps({ header });
                            const isSortable = header.key !== 'action';
                            return (
                              <TableHeader
                                key={header.key}
                                {...headerProps}
                                isSortable={isSortable}
                                isSortHeader={sortInfo.columnKey === header.key}
                                sortDirection={sortInfo.columnKey === header.key ? sortInfo.direction : 'NONE'}
                                onClick={isSortable ? () => handleSort(header.key) : undefined}
                              >
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
                              <TableSelectRow {...getSelectionProps({ row })} />
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
                );
              }}
            </DataTable>
          )}

          {completedRows.length > 0 && (
            <DataTable rows={paginatedCompletedRows} headers={TABLE_HEADERS} isSortable>
              {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
                <TableContainer
                  title="Completed Builds"
                  description="Downloaded and cancelled builds."
                >
                  <TableToolbar>
                    <TableToolbarContent>
                      <TableToolbarSearch
                        persistent
                        placeholder="Search completed builds..."
                        onChange={(e) => setCompletedSearchValue(e.target.value)}
                        value={completedSearchValue}
                        aria-label="Search completed builds"
                      />
                      <Button
                        kind="ghost"
                        size="sm"
                        className="build-management-toolbar-filter"
                        renderIcon={Filter}
                        iconDescription="Toggle filters"
                        hasIconOnly={!activeFilterCount}
                        onClick={() => setShowFilters(!showFilters)}
                      >
                        {activeFilterCount > 0 && `Filters (${activeFilterCount})`}
                      </Button>
                      {activeFilterCount > 0 && (
                        <Button
                          kind="ghost"
                          size="sm"
                          renderIcon={Close}
                          iconDescription="Clear all filters"
                          onClick={clearAllFilters}
                        >
                          Clear Filters
                        </Button>
                      )}
                      <TableToolbarMenu className="build-management-toolbar-menu">
                        <TableToolbarAction onClick={() => handleExportCSV(completedRows, 'completed-builds')}>
                          Export as CSV
                        </TableToolbarAction>
                      </TableToolbarMenu>
                      <Button
                        kind="primary"
                        size="sm"
                        className="build-management-toolbar-export"
                        renderIcon={Download}
                        onClick={() => handleExportCSV(completedRows, 'completed-builds')}
                      >
                        Export
                      </Button>
                    </TableToolbarContent>
                  </TableToolbar>
                  
                  {showFilters && (
                    <div className="build-management-filters">
                      <div className="build-management-filters__row">
                        <FilterableMultiSelect
                          id="status-filter-completed"
                          titleText="Status"
                          label="Filter by status"
                          items={STATUS_FILTER_OPTIONS}
                          itemToString={(item) => item ? item.label : ''}
                          selectedItems={STATUS_FILTER_OPTIONS.filter(opt => selectedStatuses.includes(opt.id))}
                          onChange={({ selectedItems }) => {
                            setSelectedStatuses(selectedItems.map(item => item.id));
                          }}
                          size="sm"
                        />
                        
                        <Dropdown
                          id="creator-filter-completed"
                          titleText="Creator"
                          label="Filter by creator"
                          items={[{ id: '', label: 'All Creators', value: '' }, ...creatorOptions]}
                          itemToString={(item) => item ? item.label : ''}
                          selectedItem={creatorOptions.find(opt => opt.id === selectedCreator) || { id: '', label: 'All Creators', value: '' }}
                          onChange={({ selectedItem }) => {
                            setSelectedCreator(selectedItem?.id || '');
                          }}
                          size="sm"
                        />
                        
                        <Select
                          id="date-preset-completed"
                          labelText="Date Range"
                          value={dateRangePreset}
                          onChange={(e) => handleDateRangePreset(e.target.value)}
                          size="sm"
                        >
                          <SelectItem value="" text="All Dates" />
                          {DATE_RANGE_PRESETS.map((preset) => (
                            <SelectItem key={preset.id} value={preset.id} text={preset.label} />
                          ))}
                        </Select>
                        
                        {dateRangePreset === 'custom' && (
                          <DatePicker
                            datePickerType="range"
                            onChange={(dates) => {
                              setCustomDateRange({
                                start: dates[0] ? dates[0].toISOString() : null,
                                end: dates[1] ? dates[1].toISOString() : null
                              });
                            }}
                          >
                            <DatePickerInput
                              id="date-start-completed"
                              placeholder="mm/dd/yyyy"
                              labelText="Start Date"
                              size="sm"
                            />
                            <DatePickerInput
                              id="date-end-completed"
                              placeholder="mm/dd/yyyy"
                              labelText="End Date"
                              size="sm"
                            />
                          </DatePicker>
                        )}
                      </div>
                    </div>
                  )}
                  <Table {...getTableProps()}>
                    <TableHead>
                      <TableRow>
                        {headers.map((header) => {
                          const { key, ...headerProps } = getHeaderProps({ header });
                          const isSortable = header.key !== 'action';
                          return (
                            <TableHeader
                              key={header.key}
                              {...headerProps}
                              isSortable={isSortable}
                              isSortHeader={sortInfo.columnKey === header.key}
                              sortDirection={sortInfo.columnKey === header.key ? sortInfo.direction : 'NONE'}
                              onClick={isSortable ? () => handleSort(header.key) : undefined}
                            >
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
        size="lg"
      >
        <Stack gap={6}>
          <TextInput
            id="build-name"
            labelText="Build Name *"
            placeholder="e.g., prod-v2.1, staging-test"
            value={buildName}
            onChange={handleBuildNameChange}
            onBlur={() => {
              setBuildNameTouched(true);
              validateBuildNameField(buildName);
            }}
            invalid={buildNameTouched && !!buildNameError}
            invalidText={buildNameError}
            helperText={!buildNameError ? "3-100 characters, letters, numbers, spaces, hyphens, and underscores only" : undefined}
            disabled={creating}
            required
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

      {/* Bulk Delete Confirmation Modal */}
      <Modal
        open={bulkDeleteModalOpen}
        danger
        modalHeading="Cancel Selected Builds"
        modalLabel="Bulk Action"
        primaryButtonText={bulkActionInProgress ? "Cancelling..." : "Cancel Builds"}
        secondaryButtonText="Go Back"
        onRequestSubmit={handleBulkDelete}
        onRequestClose={() => {
          if (!bulkActionInProgress) setBulkDeleteModalOpen(false);
        }}
        onSecondarySubmit={() => {
          if (!bulkActionInProgress) setBulkDeleteModalOpen(false);
        }}
        primaryButtonDisabled={bulkActionInProgress}
        size="sm"
      >
        <p>
          Are you sure you want to cancel <strong>{getSelectedBuildsInfo().count}</strong> build(s)?
        </p>
        <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#525252' }}>
          Selected builds: {getSelectedBuildsInfo().names}
        </p>
        <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#da1e28' }}>
          <strong>Warning:</strong> This action cannot be undone. Cancelled builds will be moved to the completed section.
        </p>
      </Modal>
    </div>
  );
};

export default BuildManagement;
