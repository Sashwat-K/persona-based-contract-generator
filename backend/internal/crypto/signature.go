package crypto

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/pem"
	"fmt"
)

// ComputePublicKeyFingerprint computes the SHA-256 fingerprint of a PEM-encoded public key.
func ComputePublicKeyFingerprint(publicKeyPEM string) (string, error) {
	// Decode PEM public key
	block, _ := pem.Decode([]byte(publicKeyPEM))
	if block == nil {
		return "", fmt.Errorf("failed to decode PEM block")
	}

	// Compute SHA-256 hash of the DER-encoded public key
	hash := sha256.Sum256(block.Bytes)
	return hex.EncodeToString(hash[:]), nil
}

// ValidatePublicKey validates that a PEM-encoded string is a valid RSA-4096 public key.
func ValidatePublicKey(publicKeyPEM string) error {
	block, _ := pem.Decode([]byte(publicKeyPEM))
	if block == nil {
		return fmt.Errorf("failed to decode PEM block")
	}

	pub, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return fmt.Errorf("failed to parse public key: %w", err)
	}

	rsaPub, ok := pub.(*rsa.PublicKey)
	if !ok {
		return fmt.Errorf("public key is not RSA")
	}

	// Verify key size is 4096 bits
	if rsaPub.N.BitLen() != 4096 {
		return fmt.Errorf("public key must be RSA-4096, got %d bits", rsaPub.N.BitLen())
	}

	return nil
}

// VerifySignature verifies an RSA-PSS signature against a hash using a PEM-encoded public key.
// The hash should be a hex-encoded SHA-256 hash of the data.
func VerifySignature(publicKeyPEM string, hashHex string, signatureBase64 string) error {
	// Decode PEM public key
	block, _ := pem.Decode([]byte(publicKeyPEM))
	if block == nil {
		return fmt.Errorf("failed to decode PEM block")
	}

	pub, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return fmt.Errorf("failed to parse public key: %w", err)
	}

	rsaPub, ok := pub.(*rsa.PublicKey)
	if !ok {
		return fmt.Errorf("public key is not RSA")
	}

	// Decode signature from base64
	sig, err := base64.StdEncoding.DecodeString(signatureBase64)
	if err != nil {
		return fmt.Errorf("failed to decode signature: %w", err)
	}

	// Decode the hash from hex
	hashBytes, err := hex.DecodeString(hashHex)
	if err != nil {
		return fmt.Errorf("failed to decode hash: %w", err)
	}

	if len(hashBytes) != 32 {
		return fmt.Errorf("invalid hash length: expected 32 bytes, got %d", len(hashBytes))
	}

	// Verify using RSA-PSS with SHA-256
	opts := &rsa.PSSOptions{
		SaltLength: rsa.PSSSaltLengthEqualsHash,
		Hash:       crypto.SHA256,
	}

	// Primary mode: RSA-SHA256 semantics (sign/verify over the hash string bytes).
	// This matches Node createSign/createVerify('RSA-SHA256') with PSS padding.
	digest := sha256.Sum256([]byte(hashHex))
	if err := rsa.VerifyPSS(rsaPub, crypto.SHA256, digest[:], sig, opts); err == nil {
		return nil
	}

	// Backward compatibility: verify against pre-hashed digest bytes directly.
	if err := rsa.VerifyPSS(rsaPub, crypto.SHA256, hashBytes, sig, opts); err == nil {
		return nil
	}

	return fmt.Errorf("signature verification failed")
}

// ParseCertificatePEM validates and parses a PEM-encoded X.509 certificate.
func ParseCertificatePEM(certPEM string) (*x509.Certificate, error) {
	block, _ := pem.Decode([]byte(certPEM))
	if block == nil {
		return nil, fmt.Errorf("failed to decode PEM block")
	}

	cert, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("failed to parse certificate: %w", err)
	}

	return cert, nil
}

// EncryptPrivateKeyPEM encrypts a PEM-encoded private key with a passphrase using x509.EncryptPEMBlock.
func EncryptPrivateKeyPEM(privateKeyPEM string, passphrase string) (string, error) {
	block, _ := pem.Decode([]byte(privateKeyPEM))
	if block == nil {
		return "", fmt.Errorf("failed to decode PEM block")
	}

	// Encrypt the private key using 3DES (compatible with x509.DecryptPEMBlock)
	encryptedBlock, err := x509.EncryptPEMBlock(
		rand.Reader,
		block.Type,
		block.Bytes,
		[]byte(passphrase),
		x509.PEMCipher3DES,
	)
	if err != nil {
		return "", fmt.Errorf("failed to encrypt PEM block: %w", err)
	}

	return string(pem.EncodeToMemory(encryptedBlock)), nil
}
