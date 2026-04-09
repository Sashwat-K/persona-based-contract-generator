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
  OverflowMenu,
  OverflowMenuItem
} from '@carbon/react';
import {
  Add,
  TrashCan,
  UserMultiple,
  CheckmarkFilled,
  WarningAlt
} from '@carbon/icons-react';
import { useBuildStore } from '../store/buildStore';
import { useAuthStore } from '../store/authStore';
import assignmentService from '../services/assignmentService';
import userService from '../services/userService';

/**
 * BuildAssignments Component
 * Manages user-to-build-to-role assignments for two-layer access control
 * Features: Assignment table, creation dialog, deletion, validation
 */
const BuildAssignments = ({ buildId }) => {
  const { user } = useAuthStore();
  const { getBuildAssignments } = useBuildStore();

  const [assignments, setAssignments] = useState([]);
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

  const isAdmin = userService.isAdmin();
  const isArchitect = userService.isArchitect();
  const canManageAssignments = isAdmin || isArchitect;

  const personaRoles = [
    { id: 'workload_owner', label: 'Workload Owner', description: 'Submits workload section' },
    { id: 'data_owner', label: 'Data Owner', description: 'Submits environment section' },
    { id: 'auditor', label: 'Auditor', description: 'Submits attestation section' }
  ];

  useEffect(() => {
    loadAssignments();
    if (canManageAssignments) {
      loadUsers();
    }
  }, [buildId]);

  const loadAssignments = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await assignmentService.getBuildAssignments(buildId);
      setAssignments(data);
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

  const handleDeleteAssignment = async (userId, personaRole) => {
    if (!confirm(`Are you sure you want to remove this assignment?`)) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await assignmentService.deleteAssignment(buildId, userId, personaRole);
      setSuccess('Assignment removed successfully');

      // Reload assignments
      await loadAssignments();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(`Failed to delete assignment: ${err.message}`);
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
      workload_owner: { type: 'blue', label: 'Workload Owner' },
      data_owner: { type: 'green', label: 'Data Owner' },
      auditor: { type: 'purple', label: 'Auditor' }
    };

    const config = roleConfig[role] || { type: 'gray', label: role };
    return <Tag type={config.type}>{config.label}</Tag>;
  };

  const getAssignmentStatus = (assignment) => {
    // Check if section already submitted
    const sections = useBuildStore.getState().sections[buildId] || [];
    const hasSubmitted = sections.some(s => s.persona_role === assignment.persona_role);

    if (hasSubmitted) {
      return <Tag type="green" renderIcon={CheckmarkFilled}>Submitted</Tag>;
    } else {
      return <Tag type="gray" renderIcon={WarningAlt}>Pending</Tag>;
    }
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
      a.persona_role?.toLowerCase().includes(search)
    );
  };

  const getAssignmentSummary = () => {
    const summary = {
      workload_owner: 0,
      data_owner: 0,
      auditor: 0
    };

    assignments.forEach(a => {
      if (summary.hasOwnProperty(a.persona_role)) {
        summary[a.persona_role]++;
      }
    });

    return summary;
  };

  const headers = [
    { key: 'user_name', header: 'User' },
    { key: 'user_email', header: 'Email' },
    { key: 'persona_role', header: 'Role' },
    { key: 'status', header: 'Status' },
    { key: 'assigned_at', header: 'Assigned At' },
    { key: 'actions', header: 'Actions' }
  ];

  const rows = getFilteredAssignments().map((assignment, index) => ({
    id: `${assignment.user_id}-${assignment.persona_role}`,
    user_name: assignment.user_name,
    user_email: assignment.user_email,
    persona_role: getRoleTag(assignment.persona_role),
    status: getAssignmentStatus(assignment),
    assigned_at: new Date(assignment.assigned_at).toLocaleDateString(),
    actions: canManageAssignments ? (
      <OverflowMenu size="sm" flipped>
        <OverflowMenuItem
          itemText="Remove Assignment"
          onClick={() => handleDeleteAssignment(assignment.user_id, assignment.persona_role)}
          isDelete
        />
      </OverflowMenu>
    ) : null
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
          <span className="summary-label">Workload Owners:</span>
          <span className="summary-value">{summary.workload_owner}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Data Owners:</span>
          <span className="summary-value">{summary.data_owner}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Auditors:</span>
          <span className="summary-value">{summary.auditor}</span>
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

