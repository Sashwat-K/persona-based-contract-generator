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
  CheckboxGroup,
  ToastNotification
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
  const [reactivateModalOpen, setReactivateModalOpen] = useState(false);
  const [adminResetModalOpen, setAdminResetModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [notification, setNotification] = useState(null);
  const [showInactive, setShowInactive] = useState(false);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  
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

  const rows = users
    .filter(u => u.is_active)
    .map(u => {
    const keyExpired = u.public_key_expires_at && new Date(u.public_key_expires_at) < new Date();
    const passwordExpired = u.password_expires_at && new Date(u.password_expires_at) < new Date();
    
    return {
      id: u.id,
      name: u.name || u.full_name || u.email.split('@')[0],
      email: u.email,
      role: (
        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', minHeight: '24px' }}>
          {u.roles && u.roles.length > 0 ? (
            u.roles.map(r => {
              const key = typeof r === 'string' ? r : (r.role_name || r.name || r);
              return (
                <Tag type="blue" key={key}>
                  {ROLE_NAMES[key] || key}
                </Tag>
              );
            })
          ) : (
            <Tag type="gray">None</Tag>
          )}
        </div>
      ),
      keyStatus: (
        u.public_key_fingerprint ? (
          <Tag type={keyExpired ? 'red' : 'green'}>
            {keyExpired ? 'Expired' : 'Active'}
          </Tag>
        ) : (
          <Tag type="gray">Not Registered</Tag>
        )
      ),
      keyExpiresAt: u.public_key_expires_at ? new Date(u.public_key_expires_at).toLocaleDateString() : 'N/A',
      passwordStatus: (
        u.must_change_password ? (
          <Tag type="yellow">Pending Reset</Tag>
        ) : (
          <Tag type={passwordExpired ? 'red' : 'green'}>
            {passwordExpired ? 'Expired' : 'Valid'}
          </Tag>
        )
      ),
      action: (
        <div style={{ minWidth: '200px' }}>
          <OverflowMenu size="sm" flipped>
            <OverflowMenuItem
              itemText="Edit User"
              onClick={() => handleEditClick(u)}
            />
            <OverflowMenuItem
              itemText="Reset Password"
              onClick={() => handleAdminResetPassword(u)}
            />
            <OverflowMenuItem
              itemText="Force Password Expiry"
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

  // Inactive user rows
  const inactiveRows = users
    .filter(u => !u.is_active)
    .map(u => ({
      id: u.id,
      name: u.name || u.full_name || u.email.split('@')[0],
      email: u.email,
      role: (
        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', minHeight: '24px' }}>
          {u.roles && u.roles.length > 0 ? (
            u.roles.map(r => (
              <Tag type="gray" key={r.role_id || r.id || r.name || r}>
                {r.role_name || r.name || r}
              </Tag>
            ))
          ) : (
            <Tag type="gray">None</Tag>
          )}
        </div>
      ),
      status: <Tag type="red">Disabled</Tag>,
      action: (
        <div style={{ minWidth: '200px' }}>
          <Button
            kind="tertiary"
            size="sm"
            onClick={() => handleReactivateClick(u)}
          >
            Reactivate
          </Button>
        </div>
      )
    }));

  const handleEditClick = (user) => {
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      roles: user.roles && Array.isArray(user.roles) 
        ? user.roles.map(r => r.role_id || r.id || r.name || r) 
        : Array.isArray(user.role) ? user.role : [user.role].filter(Boolean),
      password: ''
    });
    setEditModalOpen(true);
  };

  const handleDeleteClick = (user) => {
    setSelectedUser(user);
    setDeleteModalOpen(true);
  };

  const handleCreateClick = () => {
    setFormData({
      name: '',
      email: '',
      roles: [],
      password: ''
    });
    setCreateModalOpen(true);
  };

  const handleCreateUser = async () => {
    try {
      setLoading(true);
      await userService.createUser(formData.name, formData.email, formData.password, formData.roles);
      setNotification({
        kind: 'success',
        title: 'Success',
        subtitle: `User created successfully.`
      });
      setFormData({ name: '', email: '', roles: [], password: '' });
      setCreateModalOpen(false);
      await loadUsers();
    } catch (err) {
      console.error('Failed to create user:', err);
      setNotification({
        kind: 'error',
        title: 'Error Creating User',
        subtitle: err.message || 'An unexpected error occurred.'
      });
      setCreateModalOpen(false);
      setLoading(false);
    }
  };

  const handleUpdateUser = async () => {
    try {
      setLoading(true);
      
      // Update profile details if changed
      if (formData.name !== selectedUser.name || formData.email !== selectedUser.email) {
        await userService.updateUserProfile(selectedUser.id, formData.name, formData.email);
      }
      
      // Update roles
      await userService.updateUserRoles(selectedUser.id, formData.roles);
      
      setNotification({
        kind: 'success',
        title: 'Success',
        subtitle: 'User profile updated successfully.'
      });
      setEditModalOpen(false);
      setSelectedUser(null);
      
      await loadUsers();
    } catch (err) {
      console.error('Failed to update user:', err);
      setNotification({
        kind: 'error',
        title: 'Error Updating User',
        subtitle: err.message || 'Failed to update user'
      });
      setEditModalOpen(false);
      setLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    try {
      setLoading(true);
      await userService.deactivateUser(selectedUser.id);
      
      setNotification({
        kind: 'success',
        title: 'Success',
        subtitle: 'User suspended successfully.'
      });
      await loadUsers();
    } catch (err) {
      console.error('Failed to suspend/delete user:', err);
      setNotification({
        kind: 'error',
        title: 'Error Deleting User',
        subtitle: err.message || 'Failed to delete user.'
      });
    } finally {
      setDeleteModalOpen(false);
      setSelectedUser(null);
      setLoading(false);
    }
  };

  const handleForcePasswordReset = (user) => {
    setSelectedUser(user);
    setPasswordResetModalOpen(true);
  };
  
  const confirmPasswordReset = async () => {
    try {
      setLoading(true);
      await userService.forcePasswordChange(selectedUser.id);
      setNotification({
        kind: 'success',
        title: 'Success',
        subtitle: 'User will be forced to reset password upon next login.'
      });
      await loadUsers(); // Refresh UI
    } catch (err) {
      console.error('Failed to force password reset:', err);
      setNotification({
        kind: 'error',
        title: 'Error Resetting Password',
        subtitle: err.message || 'Failed to force password reset.'
      });
    } finally {
      setPasswordResetModalOpen(false);
      setSelectedUser(null);
      setLoading(false);
    }
  };

  const handleForceKeyRotation = (user) => {
    setSelectedUser(user);
    setKeyRotationModalOpen(true);
  };
  
  const confirmKeyRotation = async () => {
    try {
      setLoading(true);
      await userService.forceKeyRotation(selectedUser.id);
      setNotification({
        kind: 'success',
        title: 'Success',
        subtitle: 'Public key successfully revoked. User must rotate their key.'
      });
      await loadUsers(); // Refresh UI
    } catch (err) {
      console.error('Failed to force key rotation:', err);
      setNotification({
        kind: 'error',
        title: 'Error Revoking Key',
        subtitle: err.message || 'Failed to force key rotation.'
      });
    } finally {
      setKeyRotationModalOpen(false);
      setSelectedUser(null);
      setLoading(false);
    }
  };

  const handleReactivateClick = (user) => {
    setSelectedUser(user);
    setReactivateModalOpen(true);
  };

  const confirmReactivate = async () => {
    try {
      setLoading(true);
      await userService.reactivateUser(selectedUser.id);
      setNotification({
        kind: 'success',
        title: 'Success',
        subtitle: 'User reactivated successfully.'
      });
      await loadUsers();
    } catch (err) {
      console.error('Failed to reactivate user:', err);
      setNotification({
        kind: 'error',
        title: 'Error Reactivating User',
        subtitle: err.message || 'Failed to reactivate user.'
      });
    } finally {
      setReactivateModalOpen(false);
      setSelectedUser(null);
      setLoading(false);
    }
  };

  const handleAdminResetPassword = (user) => {
    setSelectedUser(user);
    setResetPasswordValue('');
    setAdminResetModalOpen(true);
  };

  const confirmAdminResetPassword = async () => {
    try {
      setLoading(true);
      await userService.adminResetPassword(selectedUser.id, resetPasswordValue);
      setNotification({
        kind: 'success',
        title: 'Success',
        subtitle: 'Password reset successfully. User must change it on next login.'
      });
      await loadUsers();
    } catch (err) {
      console.error('Failed to reset password:', err);
      setNotification({
        kind: 'error',
        title: 'Error Resetting Password',
        subtitle: err.message || 'Failed to reset password.'
      });
    } finally {
      setAdminResetModalOpen(false);
      setSelectedUser(null);
      setResetPasswordValue('');
      setLoading(false);
    }
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

      {notification && (
        <div style={{ position: 'fixed', top: '5rem', right: '1rem', zIndex: 9999 }}>
          <ToastNotification
            kind={notification.kind}
            title={notification.title}
            subtitle={notification.subtitle}
            caption=""
            timeout={3500}
            onClose={() => setNotification(null)}
          />
        </div>
      )}

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
            onClick={handleCreateClick}
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
            onClick={handleCreateClick}
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
                  {headers.map((header) => {
                    const { key, ...headerProps } = getHeaderProps({ header });
                    return (
                      <TableHeader key={key || header.key} {...headerProps}>
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
                    <TableRow key={key || row.id} {...rowProps}>
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

      {/* Inactive Users Section */}
      {inactiveRows.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3>Inactive Users ({inactiveRows.length})</h3>
            <Button
              kind="ghost"
              size="sm"
              onClick={() => setShowInactive(!showInactive)}
            >
              {showInactive ? 'Hide' : 'Show'} Inactive Users
            </Button>
          </div>
          {showInactive && (
            <DataTable
              rows={inactiveRows}
              headers={[
                { key: 'name', header: 'User Name' },
                { key: 'email', header: 'Email' },
                { key: 'role', header: 'Persona Role' },
                { key: 'status', header: 'Status' },
                { key: 'action', header: 'Actions' }
              ]}
            >
              {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
                <TableContainer
                  title="Disabled Users"
                  description="Users that have been deactivated. Reactivate them to restore access."
                >
                  <Table {...getTableProps()}>
                    <TableHead>
                      <TableRow>
                        {headers.map((header) => {
                          const { key, ...headerProps } = getHeaderProps({ header });
                          return (
                            <TableHeader key={key || header.key} {...headerProps}>
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
                          <TableRow key={key || row.id} {...rowProps}>
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
        </div>
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
            autoComplete="off"
          />
          <TextInput
            id="user-email"
            labelText="Email Address"
            placeholder="john.doe@example.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            autoComplete="new-email"
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
            autoComplete="new-password"
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

      {/* Reactivate User Modal */}
      <Modal
        open={reactivateModalOpen}
        modalHeading="Reactivate User"
        modalLabel="User Management"
        primaryButtonText="Reactivate"
        secondaryButtonText="Cancel"
        onRequestSubmit={confirmReactivate}
        onRequestClose={() => {
          setReactivateModalOpen(false);
          setSelectedUser(null);
        }}
      >
        <p>
          Are you sure you want to reactivate <strong>{selectedUser?.name}</strong>?
        </p>
        <p style={{ marginTop: '1rem' }}>
          This will restore their access to the system. Their roles and credentials will remain as they were before deactivation.
        </p>
      </Modal>

      {/* Admin Reset Password Modal */}
      <Modal
        open={adminResetModalOpen}
        modalHeading="Reset Password"
        modalLabel="User Management"
        primaryButtonText="Reset Password"
        secondaryButtonText="Cancel"
        onRequestSubmit={confirmAdminResetPassword}
        onRequestClose={() => {
          setAdminResetModalOpen(false);
          setSelectedUser(null);
          setResetPasswordValue('');
        }}
        primaryButtonDisabled={resetPasswordValue.length < 8}
      >
        <p style={{ marginBottom: '1.5rem' }}>
          Set a new password for <strong>{selectedUser?.name}</strong>. The user will be required to change it on their next login.
        </p>
        <TextInput
          id="admin-reset-password"
          type="password"
          labelText="New Password"
          placeholder="Minimum 8 characters"
          value={resetPasswordValue}
          onChange={(e) => setResetPasswordValue(e.target.value)}
          autoComplete="new-password"
          helperText="User will be forced to change this password on next login"
        />
      </Modal>
    </div>
  );
};

export default UserManagement;
