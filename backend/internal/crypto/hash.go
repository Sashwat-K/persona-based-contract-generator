package crypto

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
)

// SHA256Hex computes the SHA256 hash of data and returns it as a hex string.
func SHA256Hex(data []byte) string {
	hash := sha256.Sum256(data)
	return hex.EncodeToString(hash[:])
}

// SHA256HexString computes the SHA256 hash of a string.
func SHA256HexString(s string) string {
	return SHA256Hex([]byte(s))
}

// SHA256File computes the SHA256 hash of a file's contents.
func SHA256File(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", fmt.Errorf("open file: %w", err)
	}
	defer f.Close()

	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", fmt.Errorf("read file: %w", err)
	}

	return hex.EncodeToString(h.Sum(nil)), nil
}

// ComputeGenesisHash computes the genesis hash for a build's audit chain.
func ComputeGenesisHash(buildID string) string {
	seed := fmt.Sprintf("IBM_CC:%s", buildID)
	return SHA256Hex([]byte(seed))
}

// ComputeEventHash computes the hash of an audit event.
func ComputeEventHash(eventDataJSON []byte, previousHash string) string {
	payload := append(eventDataJSON, []byte(previousHash)...)
	return SHA256Hex(payload)
}
