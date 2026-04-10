import React, { useState, useEffect } from 'react';
import {
  DataTable,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
  Button,
  Modal,
  ComboBox,
  InlineNotification,
  Tag,
} from '@carbon/react';
import {
  Add,
  UserMultiple,
  CheckmarkFilled,
  WarningAlt,
  Renew
} from '@carbon/icons-react';
import { useAuthStore } from '../store/authStore';
import assignmentService from '../services/assignmentService';
import sectionService from '../services/sectionService';
import userService from '../services/userService';
import buildService from '../services/buildService';

/**
 * BuildAssignments Component
 * Manages user-to-build-to-role assignments for two-layer access control
 * Features: Assignment table, creation dialog, deletion, validation
 */
const BuildAssignments = ({ buildId, userRole, buildStatus }) => {
  const { user } = useAuthStore();

  const [assignments, setAssignments] = useState([]);
  const [sections, setSections] = useState([]);
  const [auditEvents, setAuditEvents] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);

  // Search state
  const [searchValue, setSearchValue] = useState('');

  const isAdmin = userRole === 'ADMIN' || user?.roles?.includes('ADMIN');
  const canManageAssignments = isAdmin;

  const personaRoles = [
    { id: 'SOLUTION_PROVIDER', label: 'Solution Provider', description: 'Submits workload section' },
    { id: 'DATA_OWNER', label: 'Data Owner', description: 'Submits environment section' },
    { id: 'AUDITOR', label: 'Auditor', description: 'Submits attestation section' },
    { id: 'ENV_OPERATOR', label: 'Environment Operator', description: 'Manages environment configuration' }
  ];

  useEffect(() => {
    loadAssignments();
    loadUsers();
  }, [buildId]);

  const loadAssignments = async () => {
    setLoading(true);
    setError(null);

    try {
      const [data, sectionData, eventData] = await Promise.all([
        assignmentService.getBuildAssignments(buildId),
        sectionService.getSections(buildId).catch(() => []),
        buildService.getAuditEvents(buildId).catch(() => []),
      ]);
      setAssignments(data);
      setSections(sectionData);
      setAuditEvents(Array.isArray(eventData) ? eventData : []);
    } catch (err) {
      setError(`Failed to load assignments: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await userService.listUsers();
      setUsers(data);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  const handleCreateAssignment = async () => {
    if (!selectedUser || !selectedRole) {
      setError('Please select both user and role');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await assignmentService.createAssignment(buildId, selectedUser.id, selectedRole.id);
      setSuccess(`Successfully assigned ${selectedUser.label} as ${selectedRole.label}`);

      // Reload assignments
      await loadAssignments();

      // Close modal
      setIsModalOpen(false);
      resetModal();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(`Failed to create assignment: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const resetModal = () => {
    setSelectedUser(null);
    setSelectedRole(null);
  };

  const handleOpenModal = () => {
    resetModal();
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    resetModal();
  };

  const getRoleTag = (role) => {
    const roleConfig = {
      SOLUTION_PROVIDER: { type: 'blue', label: 'Solution Provider' },
      DATA_OWNER: { type: 'green', label: 'Data Owner' },
      AUDITOR: { type: 'purple', label: 'Auditor' },
      ENV_OPERATOR: { type: 'teal', label: 'Environment Operator' },
      ADMIN: { type: 'red', label: 'Administrator' }
    };

    const config = roleConfig[role] || { type: 'gray', label: role };
    return <Tag type={config.type}>{config.label}</Tag>;
  };

  const getAssignmentStatus = (assignment) => {
    const role = assignment.role_name;
    const hasSubmittedSection = sections.some(s => s.persona_role === role);

    if (role === 'SOLUTION_PROVIDER' || role === 'DATA_OWNER') {
      if (hasSubmittedSection) {
        return <Tag type="green" renderIcon={CheckmarkFilled}>Submitted</Tag>;
      }
      return <Tag type="gray" renderIcon={WarningAlt}>Pending</Tag>;
    }

    if (role === 'AUDITOR') {
      const auditorComplete =
        hasSubmittedSection ||
        ['AUDITOR_KEYS_REGISTERED', 'CONTRACT_ASSEMBLED', 'FINALIZED'].includes(buildStatus);
      if (auditorComplete) {
        return <Tag type="green" renderIcon={CheckmarkFilled}>Completed</Tag>;
      }
      return <Tag type="gray" renderIcon={WarningAlt}>Pending</Tag>;
    }

    if (role === 'ENV_OPERATOR') {
      const downloadedByAssignee = auditEvents.some(
        (e) => e.event_type === 'CONTRACT_DOWNLOADED' && e.actor_user_id === assignment.user_id
      );
      if (downloadedByAssignee) {
        return <Tag type="green" renderIcon={CheckmarkFilled}>Downloaded</Tag>;
      }
      return <Tag type="teal">Assigned</Tag>;
    }

    return <Tag type="gray">Assigned</Tag>;
  };

  const getUserOptions = () => {
    return users.map(u => ({
      id: u.id,
      label: `${u.name} (${u.email})`,
      email: u.email
    }));
  };

  const getRoleOptions = () => {
    return personaRoles.map(r => ({
      id: r.id,
      label: r.label,
      description: r.description
    }));
  };

  const getFilteredAssignments = () => {
    if (!searchValue) return assignments;

    const search = searchValue.toLowerCase();
    return assignments.filter(a =>
      a.user_name?.toLowerCase().includes(search) ||
      a.user_email?.toLowerCase().includes(search) ||
      a.role_name?.toLowerCase().includes(search)
    );
  };

  const getAssignmentSummary = () => {
    const summary = {
      SOLUTION_PROVIDER: 0,
      DATA_OWNER: 0,
      AUDITOR: 0,
      ENV_OPERATOR: 0
    };

    assignments.forEach(a => {
      const role = a.role_name;
      if (summary.hasOwnProperty(role)) {
        summary[role]++;
      }
    });

    return summary;
  };

  const headers = [
    { key: 'user_name', header: 'User' },
    { key: 'user_email', header: 'Email' },
    { key: 'persona_role', header: 'Role' },
    { key: 'status', header: 'Status' },
    { key: 'assigned_at', header: 'Assigned At' }
  ];

  const roleOrder = ['SOLUTION_PROVIDER', 'DATA_OWNER', 'AUDITOR', 'ENV_OPERATOR'];

  const rows = getFilteredAssignments()
    .slice()
    .sort((a, b) => {
      const ai = roleOrder.indexOf(a.role_name);
      const bi = roleOrder.indexOf(b.role_name);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    })
    .map((assignment, index) => ({
    id: `${assignment.user_id}-${assignment.role_name}-${index}`,
    user_name: assignment.user_name,
    user_email: assignment.user_email,
    persona_role: getRoleTag(assignment.role_name),
    status: getAssignmentStatus(assignment),
    assigned_at: assignment.assigned_at ? new Date(assignment.assigned_at).toLocaleDateString() : 'N/A'
  }));

  const summary = getAssignmentSummary();

  return (
    <div className="build-assignments">
      {error && (
        <InlineNotification
          kind="error"
          title="Error"
          subtitle={error}
          onCloseButtonClick={() => setError(null)}
          lowContrast
        />
      )}

      {success && (
        <InlineNotification
          kind="success"
          title="Success"
          subtitle={success}
          onCloseButtonClick={() => setSuccess(null)}
          lowContrast
        />
      )}


      <div className="assignment-summary">
        <div className="summary-item">
          <UserMultiple size={20} />
          <span className="summary-label">Total Assignments:</span>
          <span className="summary-value">{assignments.length}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Solution Providers:</span>
          <span className="summary-value">{summary.SOLUTION_PROVIDER}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Data Owners:</span>
          <span className="summary-value">{summary.DATA_OWNER}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Auditors:</span>
          <span className="summary-value">{summary.AUDITOR}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Env Operators:</span>
          <span className="summary-value">{summary.ENV_OPERATOR}</span>
        </div>
      </div>

      <DataTable rows={rows} headers={headers}>
        {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
          <TableContainer title="Build Assignments" description="User-to-role assignments for this build">
            <TableToolbar>
              <TableToolbarContent>
                <TableToolbarSearch
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder="Search assignments..."
                />
                <Button
                  kind="tertiary"
                  renderIcon={Renew}
                  onClick={loadAssignments}
                  disabled={loading}
                >
                  Refresh
                </Button>
                {canManageAssignments && (
                  <Button
                    kind="primary"
                    renderIcon={Add}
                    onClick={handleOpenModal}
                  >
                    Add Assignment
                  </Button>
                )}
              </TableToolbarContent>
            </TableToolbar>
            <Table {...getTableProps()}>
              <TableHead>
                <TableRow>
                  {headers.map((header) => (
                    <TableHeader {...getHeaderProps({ header })} key={header.key}>
                      {header.header}
                    </TableHeader>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow {...getRowProps({ row })} key={row.id}>
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

      {assignments.length === 0 && !loading && (
        <div className="empty-state">
          <UserMultiple size={48} />
          <h4>No Assignments Yet</h4>
          <p>Add user assignments to allow section submissions.</p>
          {canManageAssignments && (
            <Button kind="primary" renderIcon={Add} onClick={handleOpenModal}>
              Add First Assignment
            </Button>
          )}
        </div>
      )}

      <Modal
        open={isModalOpen}
        onRequestClose={handleCloseModal}
        modalHeading="Add Build Assignment"
        modalLabel="Two-Layer Access Control"
        primaryButtonText="Add Assignment"
        secondaryButtonText="Cancel"
        onRequestSubmit={handleCreateAssignment}
        onSecondarySubmit={handleCloseModal}
        primaryButtonDisabled={!selectedUser || !selectedRole || loading}
        size="md"
      >
        <div className="modal-content">
          <p className="modal-description">
            Assign a user to a specific role for this build. Users must be assigned
            to submit sections for their role.
          </p>

          <ComboBox
            id="user-select"
            titleText="Select User"
            placeholder="Choose a user..."
            items={getUserOptions()}
            selectedItem={selectedUser}
            onChange={({ selectedItem }) => setSelectedUser(selectedItem)}
            itemToString={(item) => item ? item.label : ''}
          />

          <ComboBox
            id="role-select"
            titleText="Select Role"
            placeholder="Choose a role..."
            items={getRoleOptions()}
            selectedItem={selectedRole}
            onChange={({ selectedItem }) => setSelectedRole(selectedItem)}
            itemToString={(item) => item ? item.label : ''}
            helperText={selectedRole?.description}
          />

          {selectedUser && selectedRole && (
            <InlineNotification
              kind="info"
              title="Assignment Preview"
              subtitle={`${selectedUser.label} will be assigned as ${selectedRole.label}`}
              lowContrast
              hideCloseButton
            />
          )}
        </div>
      </Modal>

      <style>{`
        .build-assignments {
          margin: 1rem 0;
        }
        
        .assignment-summary {
          display: flex;
          gap: 2rem;
          padding: 1rem;
          background: var(--cds-layer-01);
          border-radius: 4px;
          margin-bottom: 1rem;
        }
        
        .summary-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .summary-label {
          font-weight: 600;
          color: var(--cds-text-secondary);
        }
        
        .summary-value {
          font-weight: 700;
          color: var(--cds-text-primary);
        }
        
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3rem;
          text-align: center;
          background: var(--cds-layer-01);
          border-radius: 4px;
          margin-top: 1rem;
        }
        
        .empty-state h4 {
          margin: 1rem 0 0.5rem;
        }
        
        .empty-state p {
          color: var(--cds-text-secondary);
          margin-bottom: 1.5rem;
        }
        
        .modal-content {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        
        .modal-description {
          color: var(--cds-text-secondary);
        }
      `}</style>
    </div>
  );
};

export default BuildAssignments;
