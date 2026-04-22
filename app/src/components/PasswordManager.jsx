import React, { useState } from 'react';
import {
  Tile,
  FormGroup,
  PasswordInput,
  Button,
  InlineNotification
} from '@carbon/react';
import authService from '../services/authService';
import { PasswordStrengthMeter, isPasswordValid } from './PasswordStrengthMeter';

const MIN_PASSWORD_LENGTH = 12;

const PasswordManager = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setNotification(null);

    if (newPassword !== confirmPassword) {
      setNotification({
        kind: 'error',
        title: 'Validation Error',
        subtitle: 'New passwords do not match.'
      });
      return;
    }

    if (!isPasswordValid(newPassword)) {
      setNotification({
        kind: 'error',
        title: 'Validation Error',
        subtitle: 'Password does not meet all security requirements.'
      });
      return;
    }

    try {
      setIsSubmitting(true);
      // Wait, endpoint takes old_password? 
      // The backend Go code (ChangePassword handler) only looks at req.NewPassword.
      // But the frontend authService passes oldPassword and newPassword.
      await authService.changePassword(currentPassword, newPassword);
      
      setNotification({
        kind: 'success',
        title: 'Success',
        subtitle: 'Your password has been changed successfully.'
      });
      
      // Clear form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
    } catch (err) {
      setNotification({
        kind: 'error',
        title: 'Error',
        subtitle: err.message || 'Failed to change password. Please try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Tile className="password-manager__tile">
      <div className="password-manager-header">
        <h3>Change Password</h3>
        <p className="password-manager-subtitle">
          Update your account password securely.
        </p>
      </div>

      {notification && (
        <InlineNotification
          kind={notification.kind}
          title={notification.title}
          subtitle={notification.subtitle}
          onClose={() => setNotification(null)}
          className="password-manager-notification"
        />
      )}

      <form onSubmit={handleSubmit}>
        <FormGroup legendText="">
          <PasswordInput
            id="current-password"
            labelText="Current Password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            className="password-manager-field"
          />
          <div>
            <PasswordInput
              id="new-password"
              labelText="New Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="password-manager-field"
            />
            <PasswordStrengthMeter password={newPassword} showCriteria={true} />
          </div>
          <PasswordInput
            id="confirm-password"
            labelText="Confirm New Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="password-manager-field password-manager-field--last"
          />
          <Button
            type="submit"
            disabled={isSubmitting || !currentPassword || !newPassword || !confirmPassword || !isPasswordValid(newPassword)}
          >
            {isSubmitting ? 'Updating...' : 'Update Password'}
          </Button>
        </FormGroup>
      </form>
    </Tile>
  );
};

export default PasswordManager;
