import React, { useState, useEffect, useMemo } from 'react';
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
  Tag,
  Stack,
  OverflowMenu,
  OverflowMenuItem,
  Checkbox,
  ToastNotification
} from '@carbon/react';
import { Add, Renew } from '@carbon/icons-react';
import userService from '../services/userService';
import { ROLE_NAMES } from '../utils/constants';
import { FullPageLoader } from '../components/LoadingSpinner';
import { formatDateOnly } from '../utils/formatters';
import { ErrorStatePanel, StatePanel } from '../components/StatePanel';
import { useAuthStore } from '../store/authStore';
import { getPrimaryRole } from '../utils/roles';

const MIN_PASSWORD_LENGTH = 12;
const ACTIVE_TABLE_HEADERS = [
  { key: 'name', header: 'User Name' },
  { key: 'email', header: 'Email' },
  { key: 'role', header: 'Persona Role' },
  { key: 'keyStatus', header: 'Public Key Status' },
  { key: 'keyExpiresAt', header: 'Key Expiry' },
  { key: 'passwordStatus', header: 'Password Status' },
  { key: 'action', header: 'Actions' }
];

const INACTIVE_TABLE_HEADERS = [
  { key: 'name', header: 'User Name' },
  { key: 'email', header: 'Email' },
  { key: 'role', header: 'Persona Role' },
  { key: 'status', header: 'Status' },
  { key: 'action', header: 'Actions' }
];

const UserManagement = () => {
  const authUser = useAuthStore((state) => state.user);
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

  const headers = useMemo(() => ACTIVE_TABLE_HEADERS, []);

  const rows = useMemo(() => (
    users
      .filter((u) => u.is_active)
      .map((u) => {
        const keyExpired = u.public_key_expires_at && new Date(u.public_key_expires_at) < new Date();
        const passwordExpired = u.password_expires_at && new Date(u.password_expires_at) < new Date();

        return {
          id: u.id,
          name: u.name || u.full_name || u.email.split('@')[0],
          email: u.email,
          role: (
            <div className="user-management-role-tags">
              {u.roles && u.roles.length > 0 ? (
                u.roles.map((r) => {
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
          keyExpiresAt: formatDateOnly(u.public_key_expires_at),
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
            <div className="user-management-action-cell">
              <OverflowMenu
                size="sm"
                flipped
                menuOptionsClass="user-management-overflow-options"
              >
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
      })
  ), [users]);

  // Inactive user rows
  const inactiveRows = useMemo(() => (
    users
      .filter((u) => !u.is_active)
      .map((u) => ({
        id: u.id,
        name: u.name || u.full_name || u.email.split('@')[0],
        email: u.email,
        role: (
          <div className="user-management-role-tags">
            {u.roles && u.roles.length > 0 ? (
              u.roles.map((r) => (
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
          <div className="user-management-action-cell">
            <Button
              kind="tertiary"
              size="sm"
              onClick={() => handleReactivateClick(u)}
            >
              Reactivate
            </Button>
          </div>
        )
      }))
  ), [users]);

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

      // Keep current session role list in sync if admin edits their own account.
      if (authUser?.id && selectedUser.id === authUser.id) {
        const normalizedRoles = Array.from(new Set((formData.roles || []).filter(Boolean)));
        const safeRoles = normalizedRoles.length > 0 ? normalizedRoles : ['VIEWER'];
        const persistedRole = localStorage.getItem('user_role');
        const nextRole = safeRoles.includes(persistedRole) ? persistedRole : getPrimaryRole(safeRoles);
        const nextEmail = formData.email?.trim() || authUser.email || '';

        useAuthStore.getState().updateUser({
          name: formData.name,
          full_name: formData.name,
          email: nextEmail,
          roles: safeRoles
        });
        localStorage.setItem('user_roles', JSON.stringify(safeRoles));
        localStorage.setItem('user_role', nextRole);
        localStorage.setItem('user_email', nextEmail);
        window.dispatchEvent(new CustomEvent('auth:session-updated', {
          detail: {
            role: nextRole,
            rolesJson: JSON.stringify(safeRoles),
            email: nextEmail
          }
        }));
      }
      
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
           formData.password.length >= MIN_PASSWORD_LENGTH;
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
      <div className="app-page app-page--padded">
        <ErrorStatePanel
          title="Failed to Load Users"
          description={error}
          action={<Button onClick={loadUsers}>Retry</Button>}
        />
      </div>
    );
  }

  return (
    <div className="app-page user-management-page">
      {notification && (
        <div className="user-management-toast">
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

      <div className="app-page__header">
        <h1 className="app-page__title">User Management</h1>
        <div className="app-page__actions user-management-header-actions">
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
        <StatePanel
          title="No Users Found"
          description="Get started by creating your first user."
          action={(
            <Button renderIcon={Add} onClick={handleCreateClick}>
              Create First User
            </Button>
          )}
        />
      ) : (
        <DataTable rows={rows} headers={headers}>
        {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
          <TableContainer
            title="System Users"
            description="Manage users, roles, and cryptographic credentials."
          >
            <Table {...getTableProps()} className="user-management-table user-management-table--active">
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
        <div className="user-management-inactive">
          <div className="user-management-inactive__header">
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
              headers={INACTIVE_TABLE_HEADERS}
            >
              {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
                <TableContainer
                  title="Disabled Users"
                  description="Users that have been deactivated. Reactivate them to restore access."
                >
                  <Table {...getTableProps()} className="user-management-table user-management-table--inactive">
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
          <div className="user-management-role-editor">
            <label className="user-management-role-editor__label">
              Persona Roles
            </label>
            <div className="user-management-role-editor__box">
              <p className="user-management-role-editor__hint">
                Select one or more roles for this user
              </p>
              <div className="user-management-role-editor__list">
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
          <div className="user-management-role-editor">
            <label className="user-management-role-editor__label">
              Persona Roles
            </label>
            <div className="user-management-role-editor__box">
              <p className="user-management-role-editor__hint">
                Select one or more roles for this user
              </p>
              <div className="user-management-role-editor__list">
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
        <p className="user-management-modal-copy user-management-modal-copy--spaced">
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
        <p className="user-management-modal-copy user-management-modal-copy--spaced">
          The user will be required to generate a new RSA-4096 key pair on their next login:
        </p>
        <ul className="user-management-modal-list">
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
        <p className="user-management-modal-copy user-management-modal-copy--spaced">
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
        primaryButtonDisabled={resetPasswordValue.length < MIN_PASSWORD_LENGTH}
      >
        <p className="user-management-modal-copy user-management-modal-copy--lead">
          Set a new password for <strong>{selectedUser?.name}</strong>. The user will be required to change it on their next login.
        </p>
        <TextInput
          id="admin-reset-password"
          type="password"
          labelText="New Password"
          placeholder={`Minimum ${MIN_PASSWORD_LENGTH} characters`}
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
