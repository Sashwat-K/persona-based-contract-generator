import React from 'react';
import { Modal } from '@carbon/react';
import { WarningAlt, TrashCan, Renew, Locked } from '@carbon/icons-react';

/**
 * ConfirmDialog Component
 * Reusable confirmation dialog for destructive or important actions
 * Supports different types: danger, warning, info
 */

const ConfirmDialog = ({
  open,
  title,
  message,
  type = 'danger', // danger, warning, info
  primaryButtonText = 'Confirm',
  secondaryButtonText = 'Cancel',
  onConfirm,
  onCancel,
  loading = false,
  children
}) => {
  const getIcon = () => {
    switch (type) {
      case 'danger':
        return <TrashCan size={32} style={{ color: 'var(--cds-support-error)' }} />;
      case 'warning':
        return <WarningAlt size={32} style={{ color: 'var(--cds-support-warning)' }} />;
      case 'rotate':
        return <Renew size={32} style={{ color: 'var(--cds-support-warning)' }} />;
      case 'lock':
        return <Locked size={32} style={{ color: 'var(--cds-support-info)' }} />;
      default:
        return null;
    }
  };

  return (
    <Modal
      open={open}
      modalHeading={title}
      primaryButtonText={primaryButtonText}
      secondaryButtonText={secondaryButtonText}
      onRequestSubmit={onConfirm}
      onRequestClose={onCancel}
      onSecondarySubmit={onCancel}
      danger={type === 'danger'}
      preventCloseOnClickOutside={loading}
      primaryButtonDisabled={loading}
      secondaryButtonDisabled={loading}
    >
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
        {getIcon()}
        <div style={{ flex: 1 }}>
          {message && (
            <p style={{ marginBottom: children ? '1rem' : 0 }}>
              {message}
            </p>
          )}
          {children}
        </div>
      </div>
    </Modal>
  );
};

/**
 * Preset confirmation dialogs for common actions
 */

export const DeleteConfirmDialog = ({
  open,
  itemName,
  itemType = 'item',
  onConfirm,
  onCancel,
  loading = false
}) => (
  <ConfirmDialog
    open={open}
    title={`Delete ${itemType}`}
    message={`Are you sure you want to delete "${itemName}"? This action cannot be undone.`}
    type="danger"
    primaryButtonText="Delete"
    secondaryButtonText="Cancel"
    onConfirm={onConfirm}
    onCancel={onCancel}
    loading={loading}
  />
);

export const RevokeConfirmDialog = ({
  open,
  itemName,
  onConfirm,
  onCancel,
  loading = false
}) => (
  <ConfirmDialog
    open={open}
    title="Revoke Token"
    message={`Are you sure you want to revoke the token "${itemName}"? This will immediately invalidate the token and cannot be undone.`}
    type="danger"
    primaryButtonText="Revoke"
    secondaryButtonText="Cancel"
    onConfirm={onConfirm}
    onCancel={onCancel}
    loading={loading}
  />
);

export const RotateKeyConfirmDialog = ({
  open,
  onConfirm,
  onCancel,
  loading = false
}) => (
  <ConfirmDialog
    open={open}
    title="Rotate Keypair"
    type="rotate"
    primaryButtonText="Generate New Keypair"
    secondaryButtonText="Cancel"
    onConfirm={onConfirm}
    onCancel={onCancel}
    loading={loading}
  >
    <div>
      <p style={{ marginBottom: '1rem' }}>
        This will generate a new RSA-4096 keypair and register the public key with the server.
      </p>
      <p style={{ marginBottom: '1rem', fontWeight: 600 }}>
        Important:
      </p>
      <ul style={{ marginLeft: '1.5rem', marginBottom: '1rem' }}>
        <li>Your old private key will no longer be valid</li>
        <li>You will need to re-sign any pending contracts</li>
        <li>The new private key will be encrypted with your passphrase</li>
      </ul>
      <p style={{ color: 'var(--cds-text-secondary)', fontSize: '0.875rem' }}>
        Make sure you have your passphrase ready before proceeding.
      </p>
    </div>
  </ConfirmDialog>
);

export const FinalizeContractConfirmDialog = ({
  open,
  buildName,
  onConfirm,
  onCancel,
  loading = false
}) => (
  <ConfirmDialog
    open={open}
    title="Finalize Contract"
    type="lock"
    primaryButtonText="Finalize"
    secondaryButtonText="Cancel"
    onConfirm={onConfirm}
    onCancel={onCancel}
    loading={loading}
  >
    <div>
      <p style={{ marginBottom: '1rem' }}>
        You are about to finalize the contract for build "{buildName}".
      </p>
      <p style={{ marginBottom: '1rem', fontWeight: 600 }}>
        After finalization:
      </p>
      <ul style={{ marginLeft: '1.5rem', marginBottom: '1rem' }}>
        <li>The contract will be locked and cannot be modified</li>
        <li>All signatures will be verified and recorded</li>
        <li>The contract will be ready for deployment</li>
        <li>An audit trail entry will be created</li>
      </ul>
      <p style={{ color: 'var(--cds-text-secondary)', fontSize: '0.875rem' }}>
        Please ensure all sections are complete and reviewed before finalizing.
      </p>
    </div>
  </ConfirmDialog>
);

export const BulkActionConfirmDialog = ({
  open,
  action,
  count,
  onConfirm,
  onCancel,
  loading = false
}) => (
  <ConfirmDialog
    open={open}
    title={`Bulk ${action}`}
    message={`Are you sure you want to ${action.toLowerCase()} ${count} item${count !== 1 ? 's' : ''}?`}
    type="warning"
    primaryButtonText={action}
    secondaryButtonText="Cancel"
    onConfirm={onConfirm}
    onCancel={onCancel}
    loading={loading}
  />
);

export const RemoveAssignmentConfirmDialog = ({
  open,
  userName,
  buildName,
  onConfirm,
  onCancel,
  loading = false
}) => (
  <ConfirmDialog
    open={open}
    title="Remove Assignment"
    message={`Are you sure you want to remove ${userName}'s assignment from "${buildName}"? They will lose access to this build.`}
    type="warning"
    primaryButtonText="Remove"
    secondaryButtonText="Cancel"
    onConfirm={onConfirm}
    onCancel={onCancel}
    loading={loading}
  />
);

export const ChangeRoleConfirmDialog = ({
  open,
  userName,
  oldRole,
  newRole,
  onConfirm,
  onCancel,
  loading = false
}) => (
  <ConfirmDialog
    open={open}
    title="Change User Role"
    type="warning"
    primaryButtonText="Change Role"
    secondaryButtonText="Cancel"
    onConfirm={onConfirm}
    onCancel={onCancel}
    loading={loading}
  >
    <div>
      <p style={{ marginBottom: '1rem' }}>
        You are about to change {userName}'s role from <strong>{oldRole}</strong> to <strong>{newRole}</strong>.
      </p>
      <p style={{ marginBottom: '1rem' }}>
        This will affect their permissions and access to builds.
      </p>
      <p style={{ color: 'var(--cds-text-secondary)', fontSize: '0.875rem' }}>
        The user will be notified of this change.
      </p>
    </div>
  </ConfirmDialog>
);

export default ConfirmDialog;


