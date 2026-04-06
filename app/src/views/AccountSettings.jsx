import React, { useState } from 'react';
import {
  Grid,
  Column,
  Tile,
  PasswordInput,
  Button,
  Form,
  Modal,
  InlineNotification
} from '@carbon/react';
import { Renew } from '@carbon/icons-react';

const AccountSettings = ({ userRole }) => {
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showKeypairModal, setShowKeypairModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passphraseError, setPassphraseError] = useState('');
  
  const handlePasswordUpdate = () => {
    setPasswordError('');
    
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All fields are required');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    
    if (newPassword.length < 12) {
      setPasswordError('Password must be at least 12 characters');
      return;
    }
    
    // Simulate password update
    setShowPasswordModal(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    alert('Password updated successfully!');
  };
  
  const handleKeypairRotation = () => {
    setPassphraseError('');
    
    if (!passphrase) {
      setPassphraseError('Passphrase is required to encrypt the private key');
      return;
    }
    
    if (passphrase.length < 8) {
      setPassphraseError('Passphrase must be at least 8 characters');
      return;
    }
    
    // Simulate keypair generation
    setShowKeypairModal(false);
    setPassphrase('');
    alert('New RSA-4096 keypair generated and encrypted with your passphrase!');
  };
  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>Account Settings</h1>
      
      <Grid narrow style={{ marginBottom: '2rem' }}>
        <Column lg={8}>
          <Tile>
            <h3 style={{ marginBottom: '1rem' }}>Change Password</h3>
            <p style={{ marginBottom: '1rem', color: 'var(--cds-text-secondary)' }}>
              Update your account password. Password must be at least 12 characters.
            </p>
            <Button size="sm" onClick={() => setShowPasswordModal(true)}>
              Update Password
            </Button>
          </Tile>
        </Column>

        {userRole !== 'VIEWER' && (
          <Column lg={8}>
            <Tile>
              <h3 style={{ marginBottom: '1rem' }}>Cryptographic Identity</h3>
              <p style={{ marginBottom: '1rem', color: 'var(--cds-text-secondary)' }}>
                Your RSA-4096 public key is actively registered.
              </p>
              <div style={{ padding: '1rem', backgroundColor: 'var(--cds-field-01)', marginBottom: '1rem', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                 Fingerprint: SHA256:abcd1234efgh5678ijkl9012mnop3456
              </div>
              <Button kind="danger--tertiary" renderIcon={Renew} onClick={() => setShowKeypairModal(true)}>
                Rotate Local Keypair
              </Button>
            </Tile>
          </Column>
        )}
      </Grid>
      
      {/* Password Update Modal */}
      <Modal
        open={showPasswordModal}
        modalHeading="Update Password"
        primaryButtonText="Update Password"
        secondaryButtonText="Cancel"
        onRequestClose={() => {
          setShowPasswordModal(false);
          setPasswordError('');
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
        }}
        onRequestSubmit={handlePasswordUpdate}
      >
        {passwordError && (
          <InlineNotification
            kind="error"
            title="Error"
            subtitle={passwordError}
            hideCloseButton
            style={{ marginBottom: '1rem' }}
          />
        )}
        <div style={{ marginBottom: '1rem' }}>
          <PasswordInput
            id="current-password"
            labelText="Current Password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <PasswordInput
            id="new-password"
            labelText="New Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            helperText="Minimum 12 characters"
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <PasswordInput
            id="confirm-password"
            labelText="Confirm New Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
      </Modal>
      
      {/* Keypair Rotation Modal */}
      <Modal
        open={showKeypairModal}
        modalHeading="Rotate Local Keypair"
        primaryButtonText="Generate Keypair"
        secondaryButtonText="Cancel"
        onRequestClose={() => {
          setShowKeypairModal(false);
          setPassphraseError('');
          setPassphrase('');
        }}
        onRequestSubmit={handleKeypairRotation}
        danger
      >
        <p style={{ marginBottom: '1rem' }}>
          This will generate a new RSA-4096 keypair. Your private key will be encrypted with the passphrase you provide.
        </p>
        {passphraseError && (
          <InlineNotification
            kind="error"
            title="Error"
            subtitle={passphraseError}
            hideCloseButton
            style={{ marginBottom: '1rem' }}
          />
        )}
        <div style={{ marginBottom: '1rem' }}>
          <PasswordInput
            id="passphrase"
            labelText="Passphrase to Encrypt Private Key"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            helperText="Minimum 8 characters. This passphrase will be required to use your private key."
          />
        </div>
      </Modal>
    </div>
  );
};

export default AccountSettings;
