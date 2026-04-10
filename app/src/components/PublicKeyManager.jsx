import React, { useState, useEffect } from 'react';
import {
  Modal,
  Button,
  InlineNotification,
  ProgressIndicator,
  ProgressStep,
  TextInput,
  CodeSnippet,
  Tile,
  Tag
} from '@carbon/react';
import {
  Locked,
  Unlocked,
  Renew,
  CheckmarkFilled,
  WarningAlt,
  ErrorFilled
} from '@carbon/icons-react';
import { useAuthStore } from '../store/authStore';
import authService from '../services/authService';
import cryptoService from '../services/cryptoService';

/**
 * PublicKeyManager Component
 * Manages RSA-4096 public key registration, display, and rotation
 * Features: Key generation, registration, expiry display, rotation workflow
 */
const PublicKeyManager = ({ userId, isAdmin = false }) => {
  const { user, publicKeyFingerprint, publicKeyExpiry } = useAuthStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Key generation state
  const [generatedKeyPair, setGeneratedKeyPair] = useState(null);
  const [keyFingerprint, setKeyFingerprint] = useState('');

  // Key info state
  const [keyInfo, setKeyInfo] = useState(null);
  const [keyStatus, setKeyStatus] = useState(null);

  const targetUserId = userId || user?.id;
  const isCurrentUser = !userId || userId === user?.id;

  useEffect(() => {
    if (targetUserId) {
      loadKeyInfo();
    }
  }, [targetUserId]);

  const loadKeyInfo = async () => {
    try {
      const info = isCurrentUser
        ? await authService.getMyPublicKey()
        : await authService.getPublicKey(targetUserId);
      setKeyInfo(info);
      computeKeyStatus(info);
    } catch (err) {
      // Key not registered yet - this is expected for new users
      // Only log if it's not the "not registered" error
      if (!err.message?.includes('not registered') && err.status !== 400) {
        console.error('Error loading key info:', err);
      }
      setKeyInfo(null);
      setKeyStatus({ isExpired: true, daysUntilExpiry: 0, expiresAt: null, fingerprint: null });
    }
  };

  const computeKeyStatus = (info) => {
    if (!info || !info.expires_at) {
      setKeyStatus({ isExpired: true, daysUntilExpiry: 0, expiresAt: null, fingerprint: null });
      return;
    }
    const expiresAt = new Date(info.expires_at);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
    setKeyStatus({
      isExpired: daysUntilExpiry <= 0,
      daysUntilExpiry,
      expiresAt: info.expires_at,
      fingerprint: info.fingerprint
    });
  };

  const checkKeyStatus = async () => {
    // Status is derived from keyInfo (API response), not the stale auth store.
    // computeKeyStatus is called inside loadKeyInfo; this is a no-op kept for compatibility.
  };

  const handleGenerateKey = async () => {
    setLoading(true);
    setError(null);

    try {
      // Generate RSA-4096 key pair
      const keyPair = await cryptoService.generateIdentityKeyPair();

      // Compute fingerprint
      const fingerprint = await cryptoService.computeFingerprint(keyPair.publicKey);

      setGeneratedKeyPair(keyPair);
      setKeyFingerprint(fingerprint);
      setCurrentStep(1);
    } catch (err) {
      setError(`Failed to generate key pair: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterKey = async () => {
    setLoading(true);
    setError(null);

    try {
      // Store private key securely
      await cryptoService.storePrivateKey(targetUserId, generatedKeyPair.privateKey);

      // Register public key with backend
      const result = isCurrentUser
        ? await authService.registerPublicKey(generatedKeyPair.publicKey)
        : await authService.registerPublicKeyForUser(targetUserId, generatedKeyPair.publicKey);

      setSuccess(`Public key registered successfully! Fingerprint: ${result.fingerprint.substring(0, 16)}...`);
      setCurrentStep(2);

      // Reload key info
      await loadKeyInfo();
      await checkKeyStatus();

      // Close modal after 2 seconds
      setTimeout(() => {
        setIsModalOpen(false);
        resetModal();
      }, 2000);
    } catch (err) {
      setError(`Failed to register public key: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const resetModal = () => {
    setCurrentStep(0);
    setGeneratedKeyPair(null);
    setKeyFingerprint('');
    setError(null);
    setSuccess(null);
  };

  const handleOpenModal = () => {
    resetModal();
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    resetModal();
  };

  const getKeyStatusTag = () => {
    if (!keyStatus) return null;

    if (keyStatus.isExpired) {
      return <Tag type="red" renderIcon={ErrorFilled}>Expired</Tag>;
    } else if (keyStatus.daysUntilExpiry <= 7) {
      return <Tag type="yellow" renderIcon={WarningAlt}>Expiring Soon</Tag>;
    } else {
      return <Tag type="green" renderIcon={CheckmarkFilled}>Active</Tag>;
    }
  };

  const formatFingerprint = (fingerprint) => {
    if (!fingerprint) return 'N/A';
    // If already formatted with colons, return as-is
    if (fingerprint.includes(':')) return fingerprint;
    // Format plain hex as XX:XX:XX:...
    return fingerprint.match(/.{1,2}/g)?.join(':') || fingerprint;
  };

  return (
    <div className="public-key-manager">
      <Tile className="key-info-tile">
        <div className="key-header">
          <h4>
            {keyInfo ? <Locked size={20} /> : <Unlocked size={20} />}
            {' '}Public Key Status
          </h4>
          {getKeyStatusTag()}
        </div>

        {keyInfo ? (
          <div className="key-details">
            <div className="key-detail-row">
              <span className="label">Fingerprint:</span>
              <CodeSnippet type="inline" feedback="Copied to clipboard">
                {formatFingerprint(keyInfo.fingerprint)}
              </CodeSnippet>
            </div>

            <div className="key-detail-row">
              <span className="label">Registered:</span>
              <span>{new Date(keyInfo.created_at).toLocaleDateString()}</span>
            </div>

            <div className="key-detail-row">
              <span className="label">Expires:</span>
              <span>
                {new Date(keyInfo.expires_at).toLocaleDateString()}
                {keyStatus && (
                  <span className="expiry-info">
                    {' '}({keyStatus.daysUntilExpiry} days remaining)
                  </span>
                )}
              </span>
            </div>

            {keyStatus?.isExpired && (
              <InlineNotification
                kind="error"
                title="Key Expired"
                subtitle="Your public key has expired. Please register a new key to continue operations."
                lowContrast
              />
            )}

            {keyStatus && keyStatus.daysUntilExpiry <= 7 && !keyStatus.isExpired && (
              <InlineNotification
                kind="warning"
                title="Key Expiring Soon"
                subtitle={`Your public key will expire in ${keyStatus.daysUntilExpiry} days. Consider rotating your key.`}
                lowContrast
              />
            )}

            <Button
              kind="tertiary"
              renderIcon={Renew}
              onClick={handleOpenModal}
              className="rotate-key-button"
            >
              Rotate Key
            </Button>
          </div>
        ) : (
          <div className="no-key">
            <InlineNotification
              kind="warning"
              title="No Public Key Registered"
              subtitle="You must register a public key to perform cryptographic operations."
              lowContrast
            />

            <Button
              kind="primary"
              renderIcon={Locked}
              onClick={handleOpenModal}
            >
              Register Public Key
            </Button>
          </div>
        )}
      </Tile>

      <Modal
        open={isModalOpen}
        onRequestClose={handleCloseModal}
        modalHeading={keyInfo ? "Rotate Public Key" : "Register Public Key"}
        modalLabel="RSA-4096 Key Management"
        primaryButtonText={currentStep === 1 ? "Register Key" : "Generate Key"}
        secondaryButtonText="Cancel"
        onRequestSubmit={currentStep === 0 ? handleGenerateKey : handleRegisterKey}
        onSecondarySubmit={handleCloseModal}
        primaryButtonDisabled={loading || currentStep === 2}
        size="md"
      >
        <ProgressIndicator currentIndex={currentStep} spaceEqually>
          <ProgressStep
            label="Generate Key Pair"
            description="Create RSA-4096 key pair"
          />
          <ProgressStep
            label="Register Public Key"
            description="Store and register key"
          />
          <ProgressStep
            label="Complete"
            description="Key registered successfully"
          />
        </ProgressIndicator>

        <div className="modal-content">
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
              lowContrast
            />
          )}

          {currentStep === 0 && (
            <div className="step-content">
              <p>
                This will generate a new RSA-4096 key pair for cryptographic operations.
                The private key will be stored securely on your device, and the public key
                will be registered with the server.
              </p>

              {keyInfo && (
                <InlineNotification
                  kind="info"
                  title="Key Rotation"
                  subtitle="Your existing key will be replaced. All future operations will use the new key."
                  lowContrast
                />
              )}
            </div>
          )}

          {currentStep === 1 && generatedKeyPair && (
            <div className="step-content">
              <p>Key pair generated successfully!</p>

              <div className="key-info-display">
                <TextInput
                  id="fingerprint"
                  labelText="Public Key Fingerprint"
                  value={formatFingerprint(keyFingerprint)}
                  readOnly
                />

                <InlineNotification
                  kind="info"
                  title="Secure Storage"
                  subtitle="Your private key will be stored securely in your system's keychain. Never share your private key."
                  lowContrast
                />
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="step-content">
              <InlineNotification
                kind="success"
                title="Registration Complete"
                subtitle="Your public key has been registered successfully. You can now perform cryptographic operations."
                lowContrast
              />
            </div>
          )}
        </div>
      </Modal>

      <style>{`
        .public-key-manager {
          margin: 1rem 0;
        }
        
        .key-info-tile {
          padding: 1.5rem;
        }
        
        .key-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }
        
        .key-header h4 {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin: 0;
        }
        
        .key-details {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        
        .key-detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .key-detail-row .label {
          font-weight: 600;
          color: var(--cds-text-secondary);
        }
        
        .expiry-info {
          color: var(--cds-text-secondary);
          font-size: 0.875rem;
        }
        
        .no-key {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        
        .rotate-key-button {
          margin-top: 1rem;
        }
        
        .modal-content {
          margin-top: 2rem;
        }
        
        .step-content {
          margin-top: 1.5rem;
        }
        
        .key-info-display {
          margin-top: 1rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
      `}</style>
    </div>
  );
};

export default PublicKeyManager;

