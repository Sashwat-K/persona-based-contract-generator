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
  Stack,
  OverflowMenu,
  OverflowMenuItem,
  Checkbox,
  CheckboxGroup
} from '@carbon/react';
import { Add, Edit, TrashCan, Renew, WarningAlt } from '@carbon/icons-react';
import userService from '../services/userService';
import { ROLES, ROLE_NAMES } from '../utils/constants';
import { formatDate } from '../utils/formatters';
import { FullPageLoader } from '../components/LoadingSpinner';

// Add CSS to prevent truncation in overflow menu
const overflowMenuStyles = `
  .cds--overflow-menu-options__option-content {
    white-space: nowrap !important;
    overflow: visible !important;
    text-overflow: clip !important;
  }
  .cds--overflow-menu-options {
    min-width: 220px !important;
  }
`;

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [passwordResetModalOpen, setPasswordResetModalOpen] = useState(false);
  const [keyRotationModalOpen, setKeyRotationModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    roles: [], // Changed from role to roles array
    password: ''
  });

  // Load users on mount
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const usersData = await userService.listUsers();
      setUsers(usersData);
    } catch (err) {
      console.error('Failed to load users:', err);
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };
  
  const handleRoleToggle = (roleKey) => {
    setFormData(prev => ({
      ...prev,
      roles: prev.roles.includes(roleKey)
        ? prev.roles.filter(r => r !== roleKey)
        : [...prev.roles, roleKey]
    }));
  };

  const headers = [
    { key: 'name', header: 'User Name' },
    { key: 'email', header: 'Email' },
    { key: 'role', header: 'Persona Role' },
    { key: 'keyStatus', header: 'Public Key Status' },
    { key: 'keyExpiresAt', header: 'Key Expiry' },
    { key: 'passwordStatus', header: 'Password Status' },
    { key: 'action', header: 'Actions' }
  ];

  const rows = users.map(u => {
    const keyExpired = u.public_key_expires_at && new Date(u.public_key_expires_at) < new Date();
    const passwordExpired = u.password_expires_at && new Date(u.password_expires_at) < new Date();
    
    return {
      id: u.id,
      name: u.full_name || u.email.split('@')[0],
      email: u.email,
      role: <Tag type="blue">{u.role}</Tag>,
      keyStatus: (
        <Tag type={keyExpired ? 'red' : 'green'}>
          {keyExpired ? 'Expired' : 'Active'}
        </Tag>
      ),
      keyExpiresAt: u.public_key_expires_at ? new Date(u.public_key_expires_at).toLocaleDateString() : 'N/A',
      passwordStatus: (
        <Tag type={passwordExpired ? 'red' : 'green'}>
          {passwordExpired ? 'Expired' : 'Valid'}
        </Tag>
      ),
      action: (
        <div style={{ minWidth: '200px' }}>
          <OverflowMenu size="sm" flipped>
            <OverflowMenuItem
              itemText="Edit User"
              onClick={() => handleEditClick(u)}
            />
            <OverflowMenuItem
              itemText="Force Password Reset"
              onClick={() => handleForcePasswordReset(u)}
            />
            <OverflowMenuItem
              itemText="Force Key Rotation"
              onClick={() => handleForceKeyRotation(u)}
            />
            <OverflowMenuItem
              itemText="Delete User"
              onClick={() => handleDeleteClick(u)}
              hasDivider
              isDelete
            />
          </OverflowMenu>
        </div>
      )
    };
  });

  const handleEditClick = (user) => {
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      roles: Array.isArray(user.role) ? user.role : [user.role], // Handle both array and string
      password: ''
    });
    setEditModalOpen(true);
  };

  const handleDeleteClick = (user) => {
    setSelectedUser(user);
    setDeleteModalOpen(true);
  };

  const handleCreateUser = () => {
    // TODO: Integrate with userService.createUser()
    console.log('Creating user:', formData);
    
    // Reset form
    setFormData({ name: '', email: '', roles: [], password: '' });
    setCreateModalOpen(false);
  };

  const handleUpdateUser = () => {
    // TODO: Integrate with userService.updateUser()
    console.log('Updating user:', selectedUser.id, formData);
    
    setEditModalOpen(false);
    setSelectedUser(null);
  };

  const handleDeleteUser = () => {
    // TODO: Integrate with userService.deleteUser()
    console.log('Deleting user:', selectedUser.id);
    
    setDeleteModalOpen(false);
    setSelectedUser(null);
  };

  const handleForcePasswordReset = (user) => {
    setSelectedUser(user);
    setPasswordResetModalOpen(true);
  };
  
  const confirmPasswordReset = () => {
    // TODO: Integrate with userService.forcePasswordReset()
    console.log('Forcing password reset for:', selectedUser.id);
    setPasswordResetModalOpen(false);
    setSelectedUser(null);
  };

  const handleForceKeyRotation = (user) => {
    setSelectedUser(user);
    setKeyRotationModalOpen(true);
  };
  
  const confirmKeyRotation = () => {
    // TODO: Integrate with userService.forceKeyRotation()
    console.log('Forcing key rotation for:', selectedUser.id);
    setKeyRotationModalOpen(false);
    setSelectedUser(null);
  };

  const isCreateFormValid = () => {
    return formData.name.trim() &&
           formData.email.trim() &&
           formData.roles.length > 0 &&
           formData.password.length >= 12;
  };

  const isEditFormValid = () => {
    return formData.name.trim() &&
           formData.email.trim() &&
           formData.roles.length > 0;
  };

  // Show loading state
  if (loading) {
    return <FullPageLoader description="Loading users..." />;
  }

  // Show error state
  if (error) {
    return (
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem' }}>
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: 'var(--cds-layer-01)',
          borderRadius: '4px'
        }}>
          <WarningAlt size={48} style={{ color: 'var(--cds-support-error)', marginBottom: '1rem' }} />
          <h3 style={{ marginBottom: '0.5rem' }}>Failed to Load Users</h3>
          <p style={{ color: 'var(--cds-text-secondary)', marginBottom: '1.5rem' }}>
            {error}
          </p>
          <Button onClick={loadUsers}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <style>{overflowMenuStyles}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1>User Management</h1>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <Button
            kind="tertiary"
            size="md"
            renderIcon={Renew}
            onClick={loadUsers}
          >
            Refresh
          </Button>
          <Button
            renderIcon={Add}
            onClick={() => setCreateModalOpen(true)}
          >
            Create New User
          </Button>
        </div>
      </div>

      {users.length === 0 ? (
        <div style={{
          padding: '4rem 2rem',
          textAlign: 'center',
          backgroundColor: 'var(--cds-layer-01)',
          borderRadius: '4px'
        }}>
          <h3 style={{ marginBottom: '1rem' }}>No Users Found</h3>
          <p style={{ color: 'var(--cds-text-secondary)', marginBottom: '2rem' }}>
            Get started by creating your first user.
          </p>
          <Button
            renderIcon={Add}
            onClick={() => setCreateModalOpen(true)}
          >
            Create First User
          </Button>
        </div>
      ) : (
        <DataTable rows={rows} headers={headers}>
        {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
          <TableContainer
            title="System Users"
            description="Manage users, roles, and cryptographic credentials."
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

      {/* Create User Modal */}
      <Modal
        open={createModalOpen}
        modalHeading="Create New User"
        modalLabel="User Management"
        primaryButtonText="Create User"
        secondaryButtonText="Cancel"
        onRequestSubmit={handleCreateUser}
        onRequestClose={() => setCreateModalOpen(false)}
        primaryButtonDisabled={!isCreateFormValid()}
      >
        <Stack gap={6}>
          <TextInput
            id="user-name"
            labelText="Full Name"
            placeholder="John Doe"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
          <TextInput
            id="user-email"
            labelText="Email Address"
            placeholder="john.doe@example.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.75rem',
              fontWeight: 400,
              color: 'var(--cds-text-secondary)',
              letterSpacing: '0.32px'
            }}>
              Persona Roles
            </label>
            <div style={{
              padding: '1rem',
              backgroundColor: 'var(--cds-field)',
              border: '1px solid var(--cds-border-subtle)',
              borderRadius: '0'
            }}>
              <p style={{
                fontSize: '0.75rem',
                color: 'var(--cds-text-secondary)',
                marginBottom: '0.75rem'
              }}>
                Select one or more roles for this user
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {Object.entries(ROLE_NAMES).map(([key, name]) => (
                  <Checkbox
                    key={key}
                    id={`create-role-${key}`}
                    labelText={name}
                    checked={formData.roles.includes(key)}
                    onChange={() => handleRoleToggle(key)}
                  />
                ))}
              </div>
            </div>
          </div>
          <TextInput
            id="user-password"
            type="password"
            labelText="Initial Password"
            placeholder="Minimum 12 characters"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            helperText="User will be required to change this on first login"
          />
        </Stack>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        open={editModalOpen}
        modalHeading="Edit User"
        modalLabel="User Management"
        primaryButtonText="Save Changes"
        secondaryButtonText="Cancel"
        onRequestSubmit={handleUpdateUser}
        onRequestClose={() => setEditModalOpen(false)}
        primaryButtonDisabled={!isEditFormValid()}
      >
        <Stack gap={6}>
          <TextInput
            id="edit-user-name"
            labelText="Full Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
          <TextInput
            id="edit-user-email"
            labelText="Email Address"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.75rem',
              fontWeight: 400,
              color: 'var(--cds-text-secondary)',
              letterSpacing: '0.32px'
            }}>
              Persona Roles
            </label>
            <div style={{
              padding: '1rem',
              backgroundColor: 'var(--cds-field)',
              border: '1px solid var(--cds-border-subtle)',
              borderRadius: '0'
            }}>
              <p style={{
                fontSize: '0.75rem',
                color: 'var(--cds-text-secondary)',
                marginBottom: '0.75rem'
              }}>
                Select one or more roles for this user
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {Object.entries(ROLE_NAMES).map(([key, name]) => (
                  <Checkbox
                    key={key}
                    id={`edit-role-${key}`}
                    labelText={name}
                    checked={formData.roles.includes(key)}
                    onChange={() => handleRoleToggle(key)}
                  />
                ))}
              </div>
            </div>
          </div>
        </Stack>
      </Modal>

      {/* Delete User Modal */}
      <Modal
        open={deleteModalOpen}
        danger
        modalHeading="Delete User"
        modalLabel="User Management"
        primaryButtonText="Delete"
        secondaryButtonText="Cancel"
        onRequestSubmit={handleDeleteUser}
        onRequestClose={() => setDeleteModalOpen(false)}
      >
        <p>
          Are you sure you want to delete user <strong>{selectedUser?.name}</strong>?
          This action cannot be undone.
        </p>
      </Modal>
      
      {/* Force Password Reset Modal */}
      <Modal
        open={passwordResetModalOpen}
        modalHeading="Force Password Reset"
        modalLabel="User Management"
        primaryButtonText="Force Reset"
        secondaryButtonText="Cancel"
        onRequestSubmit={confirmPasswordReset}
        onRequestClose={() => {
          setPasswordResetModalOpen(false);
          setSelectedUser(null);
        }}
        danger
      >
        <p>
          Are you sure you want to force a password reset for <strong>{selectedUser?.name}</strong>?
        </p>
        <p style={{ marginTop: '1rem' }}>
          The user will be required to change their password on their next login.
        </p>
      </Modal>
      
      {/* Force Key Rotation Modal */}
      <Modal
        open={keyRotationModalOpen}
        modalHeading="Force Key Rotation"
        modalLabel="User Management"
        primaryButtonText="Force Rotation"
        secondaryButtonText="Cancel"
        onRequestSubmit={confirmKeyRotation}
        onRequestClose={() => {
          setKeyRotationModalOpen(false);
          setSelectedUser(null);
        }}
        danger
      >
        <p>
          Are you sure you want to force key rotation for <strong>{selectedUser?.name}</strong>?
        </p>
        <p style={{ marginTop: '1rem' }}>
          The user will be required to generate a new RSA-4096 key pair on their next login:
        </p>
        <ul style={{ marginTop: '0.5rem', marginLeft: '1.5rem' }}>
          <li>Generate new RSA-4096 key pair</li>
          <li>Register the new public key</li>
          <li>Old key will be invalidated</li>
        </ul>
      </Modal>
    </div>
  );
};

export default UserManagement;
