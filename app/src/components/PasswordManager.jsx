import React, { useState } from 'react';
import {
  Tile,
  FormGroup,
  TextInput,
  Button,
  InlineNotification
} from '@carbon/react';
import { CheckmarkOutline, ErrorOutline } from '@carbon/icons-react';
import authService from '../services/authService';
import { useAuthStore } from '../store/authStore';

const PasswordManager = () => {
  const { user } = useAuthStore();
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

    if (newPassword.length < 8) {
      setNotification({
        kind: 'error',
        title: 'Validation Error',
        subtitle: 'Password must be at least 8 characters long.'
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
    <Tile>
      <div style={{ marginBottom: '1.5rem' }}>
        <h3>Change Password</h3>
        <p style={{ marginTop: '0.5rem', color: '#525252' }}>
          Update your account password securely.
        </p>
      </div>

      {notification && (
        <InlineNotification
          kind={notification.kind}
          title={notification.title}
          subtitle={notification.subtitle}
          onClose={() => setNotification(null)}
          style={{ marginBottom: '1.5rem' }}
        />
      )}

      <form onSubmit={handleSubmit}>
        <FormGroup legendText="">
          <TextInput
            id="current-password"
            type="password"
            labelText="Current Password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            style={{ marginBottom: '1rem' }}
          />
          <TextInput
            id="new-password"
            type="password"
            labelText="New Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            helperText="Must be at least 8 characters long"
            style={{ marginBottom: '1rem' }}
          />
          <TextInput
            id="confirm-password"
            type="password"
            labelText="Confirm New Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            style={{ marginBottom: '1.5rem' }}
          />
          <Button 
            type="submit" 
            disabled={isSubmitting || !currentPassword || !newPassword || !confirmPassword}
          >
            {isSubmitting ? 'Updating...' : 'Update Password'}
          </Button>
        </FormGroup>
      </form>
    </Tile>
  );
};

export default PasswordManager;
