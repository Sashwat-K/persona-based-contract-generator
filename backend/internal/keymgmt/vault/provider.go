package vault

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	appcrypto "github.com/Sashwat-K/persona-based-contract-generator/backend/internal/crypto"
	"github.com/Sashwat-K/persona-based-contract-generator/backend/internal/keymgmt"
	"github.com/Sashwat-K/persona-based-contract-generator/backend/internal/model"
)

// Config defines Vault provider runtime settings.
type Config struct {
	Addr           string
	Namespace      string
	AuthMethod     string
	RoleID         string
	SecretID       string
	Token          string
	TransitMount   string
	KVMount        string
	RequestTimeout time.Duration
}

// Provider implements KeyProvider on top of Vault Transit.
type Provider struct {
	cfg        Config
	httpClient *http.Client

	mu    sync.Mutex
	token string
}

// New creates a Vault-backed key provider.
func New(cfg Config) (*Provider, error) {
	if strings.TrimSpace(cfg.Addr) == "" {
		return nil, fmt.Errorf("vault address is required")
	}
	if cfg.RequestTimeout <= 0 {
		cfg.RequestTimeout = 10 * time.Second
	}
	if strings.TrimSpace(cfg.TransitMount) == "" {
		cfg.TransitMount = "transit"
	}
	if strings.TrimSpace(cfg.KVMount) == "" {
		cfg.KVMount = "secret"
	}
	if strings.TrimSpace(cfg.AuthMethod) == "" {
		cfg.AuthMethod = "approle"
	}

	p := &Provider{
		cfg: cfg,
		httpClient: &http.Client{
			Timeout: cfg.RequestTimeout,
		},
		token: strings.TrimSpace(cfg.Token),
	}
	if err := p.HealthCheck(context.Background()); err != nil {
		return nil, err
	}
	if err := p.ensureTransitMount(context.Background()); err != nil {
		return nil, err
	}
	if err := p.ensureKVMount(context.Background()); err != nil {
		return nil, err
	}
	return p, nil
}

func (p *Provider) CreateSigningKey(ctx context.Context, buildID, actorID uuid.UUID, mode model.BuildKeyMode, publicKeyPEM *string, passphrase *string) (keymgmt.KeyRecord, error) {
	return p.createKey(ctx, buildID, actorID, model.BuildKeyTypeSigning, mode, publicKeyPEM, passphrase)
}

func (p *Provider) CreateAttestationKey(ctx context.Context, buildID, actorID uuid.UUID, mode model.BuildKeyMode, publicKeyPEM *string, passphrase *string) (keymgmt.KeyRecord, *keymgmt.OneTimePrivateExport, error) {
	record, err := p.createKey(ctx, buildID, actorID, model.BuildKeyTypeAttestation, mode, publicKeyPEM, passphrase)
	if err != nil {
		return keymgmt.KeyRecord{}, nil, err
	}
	// Export is intentionally disabled by default; attestation private key is not returned.
	return record, nil, nil
}

func (p *Provider) GetPublicKey(ctx context.Context, keyID uuid.UUID) (string, error) {
	name := p.vaultKeyName("", model.BuildKeyTypeSigning, keyID)
	publicKey, err := p.readTransitPublicKey(ctx, name)
	if err == nil {
		return publicKey, nil
	}

	attName := p.vaultKeyName("", model.BuildKeyTypeAttestation, keyID)
	return p.readTransitPublicKey(ctx, attName)
}

func (p *Provider) GetPrivateKey(ctx context.Context, keyID uuid.UUID) ([]byte, error) {
	// Read encrypted private key from KV
	kvPath := p.kvKeyPath(keyID)
	data, err := p.readKVSecret(ctx, kvPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read private key from KV at path %s for key_id %s: %w", kvPath, keyID, err)
	}

	privateKeyPEM, ok := data["private_key"].(string)
	if !ok || privateKeyPEM == "" {
		return nil, fmt.Errorf("private key field not found or empty in KV at path %s for key_id %s (data keys: %v)", kvPath, keyID, getMapKeys(data))
	}

	// Return the encrypted PEM (caller will decrypt with passphrase)
	return []byte(privateKeyPEM), nil
}

func getMapKeys(m map[string]interface{}) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}

func (p *Provider) SignDigest(ctx context.Context, keyID uuid.UUID, digestHex string) (string, error) {
	signingName := p.vaultKeyName("", model.BuildKeyTypeSigning, keyID)
	return p.signWithTransitKey(ctx, signingName, digestHex)
}

// HealthCheck verifies Vault is reachable and initialized.
func (p *Provider) HealthCheck(ctx context.Context) error {
	_, err := p.request(ctx, http.MethodGet, "/v1/sys/health?standbyok=true&perfstandbyok=true", nil, false)
	if err != nil {
		return fmt.Errorf("vault health check failed: %w", err)
	}
	return nil
}

func (p *Provider) ensureTransitMount(ctx context.Context) error {
	mount := strings.Trim(strings.TrimSpace(p.cfg.TransitMount), "/")
	if mount == "" {
		mount = "transit"
	}

	body, err := p.request(ctx, http.MethodGet, "/v1/sys/mounts", nil, true)
	if err != nil {
		return fmt.Errorf("failed to verify vault transit mount %q: %w", mount, err)
	}

	// Vault returns different JSON shapes depending on version/config:
	// 1) top-level map of mounts, or
	// 2) envelope with "data" holding mounts.
	var top map[string]json.RawMessage
	if err := json.Unmarshal(body, &top); err != nil {
		return fmt.Errorf("failed to parse vault mounts response: %w", err)
	}

	mounts := top
	if dataRaw, ok := top["data"]; ok {
		var data map[string]json.RawMessage
		if err := json.Unmarshal(dataRaw, &data); err != nil {
			return fmt.Errorf("failed to parse vault mounts response data: %w", err)
		}
		mounts = data
	}

	entryRaw, ok := mounts[mount+"/"]
	if !ok {
		return fmt.Errorf("vault transit mount %q is not enabled", mount)
	}

	var entry struct {
		Type string `json:"type"`
	}
	if err := json.Unmarshal(entryRaw, &entry); err != nil {
		return fmt.Errorf("failed to parse vault mount entry for %q: %w", mount, err)
	}
	if entry.Type != "transit" {
		return fmt.Errorf("vault mount %q has type %q (expected \"transit\")", mount, entry.Type)
	}
	return nil
}

func (p *Provider) ensureKVMount(ctx context.Context) error {
	mount := strings.Trim(strings.TrimSpace(p.cfg.KVMount), "/")
	if mount == "" {
		mount = "secret"
	}

	body, err := p.request(ctx, http.MethodGet, "/v1/sys/mounts", nil, true)
	if err != nil {
		return fmt.Errorf("failed to verify vault KV mount %q: %w", mount, err)
	}

	var top map[string]json.RawMessage
	if err := json.Unmarshal(body, &top); err != nil {
		return fmt.Errorf("failed to parse vault mounts response: %w", err)
	}

	mounts := top
	if dataRaw, ok := top["data"]; ok {
		var data map[string]json.RawMessage
		if err := json.Unmarshal(dataRaw, &data); err != nil {
			return fmt.Errorf("failed to parse vault mounts response data: %w", err)
		}
		mounts = data
	}

	entryRaw, ok := mounts[mount+"/"]
	if !ok {
		return fmt.Errorf("vault KV mount %q is not enabled", mount)
	}

	var entry struct {
		Type string `json:"type"`
	}
	if err := json.Unmarshal(entryRaw, &entry); err != nil {
		return fmt.Errorf("failed to parse vault mount entry for %q: %w", mount, err)
	}
	if entry.Type != "kv" && entry.Type != "kv-v2" {
		return fmt.Errorf("vault mount %q has type %q (expected \"kv\" or \"kv-v2\")", mount, entry.Type)
	}
	return nil
}

func (p *Provider) createKey(ctx context.Context, buildID, actorID uuid.UUID, keyType model.BuildKeyType, mode model.BuildKeyMode, publicKeyPEM *string, passphrase *string) (keymgmt.KeyRecord, error) {
	record := keymgmt.KeyRecord{
		ID:        uuid.New(),
		BuildID:   buildID,
		Type:      keyType,
		Mode:      mode,
		Status:    model.BuildKeyStatusActive,
		CreatedBy: actorID,
	}

	switch mode {
	case model.BuildKeyModeGenerate:
		// Step 1: Create Transit key for generation and signing
		transitName := p.vaultKeyName(buildID.String(), keyType, record.ID)
		if err := p.createTransitKey(ctx, transitName, true); err != nil {
			return keymgmt.KeyRecord{}, err
		}

		// Step 2: Read public key from Transit
		publicKey, err := p.readTransitPublicKey(ctx, transitName)
		if err != nil {
			return keymgmt.KeyRecord{}, err
		}
		record.PublicKey = publicKey

		// Step 3: Export private key from Transit
		privateKeyPEM, err := p.readTransitPrivateKey(ctx, transitName)
		if err != nil {
			return keymgmt.KeyRecord{}, fmt.Errorf("failed to export private key: %w", err)
		}

		// Step 4: Encrypt private key with passphrase if provided
		if passphrase != nil && strings.TrimSpace(*passphrase) != "" {
			encryptedPEM, err := appcrypto.EncryptPrivateKeyPEM(privateKeyPEM, *passphrase)
			if err != nil {
				return keymgmt.KeyRecord{}, fmt.Errorf("failed to encrypt private key: %w", err)
			}
			privateKeyPEM = encryptedPEM
		}

		// Step 5: Store encrypted private key in KV
		kvPath := p.kvKeyPath(record.ID)
		if err := p.writeKVSecret(ctx, kvPath, map[string]interface{}{
			"private_key": privateKeyPEM,
			"key_type":    string(keyType),
			"build_id":    buildID.String(),
		}); err != nil {
			return keymgmt.KeyRecord{}, fmt.Errorf("failed to store private key in KV: %w", err)
		}

		// Step 6: Keep Transit key for signing operations (SignDigest)
		// The Transit key remains in Vault for audit trail signatures
		// The encrypted private key in KV is used for contract signing

		// Store both Transit name and KV path as vault reference
		record.VaultRef = &transitName


	case model.BuildKeyModeUploadPublic:
		if publicKeyPEM == nil || *publicKeyPEM == "" {
			return keymgmt.KeyRecord{}, fmt.Errorf("public key is required for upload_public mode")
		}
		if err := appcrypto.ValidatePublicKey(*publicKeyPEM); err != nil {
			return keymgmt.KeyRecord{}, fmt.Errorf("invalid public key: %w", err)
		}
		record.PublicKey = *publicKeyPEM
	default:
		return keymgmt.KeyRecord{}, fmt.Errorf("unsupported key mode: %s", mode)
	}

	fingerprint, err := appcrypto.ComputePublicKeyFingerprint(record.PublicKey)
	if err != nil {
		return keymgmt.KeyRecord{}, fmt.Errorf("failed to compute public key fingerprint: %w", err)
	}
	record.PublicKeyFingerprint = fingerprint
	return record, nil
}

func (p *Provider) createTransitKey(ctx context.Context, keyName string, exportable bool) error {
	payload := map[string]interface{}{
		"type":       "rsa-4096",
		"exportable": exportable,
	}
	path := fmt.Sprintf("/v1/%s/keys/%s", strings.Trim(p.cfg.TransitMount, "/"), url.PathEscape(keyName))
	_, err := p.request(ctx, http.MethodPost, path, payload, true)
	if err != nil {
		return fmt.Errorf("failed to create transit key %s: %w", keyName, err)
	}
	return nil
}

func (p *Provider) readTransitPublicKey(ctx context.Context, keyName string) (string, error) {
	path := fmt.Sprintf("/v1/%s/keys/%s", strings.Trim(p.cfg.TransitMount, "/"), url.PathEscape(keyName))
	body, err := p.request(ctx, http.MethodGet, path, nil, true)
	if err != nil {
		return "", fmt.Errorf("failed to read transit key %s: %w", keyName, err)
	}

	var resp struct {
		Data struct {
			Keys map[string]struct {
				PublicKey string `json:"public_key"`
			} `json:"keys"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return "", fmt.Errorf("failed to decode transit key response: %w", err)
	}
	for _, entry := range resp.Data.Keys {
		if strings.TrimSpace(entry.PublicKey) != "" {
			return entry.PublicKey, nil
		}
	}
	return "", fmt.Errorf("public key not available for transit key %s", keyName)
}

func (p *Provider) readTransitPrivateKey(ctx context.Context, keyName string) (string, error) {
	// Transit export endpoint for RSA signing keys.
	path := fmt.Sprintf("/v1/%s/export/signing-key/%s", strings.Trim(p.cfg.TransitMount, "/"), url.PathEscape(keyName))
	body, err := p.request(ctx, http.MethodGet, path, nil, true)
	if err != nil {
		return "", fmt.Errorf("failed to export transit key %s: %w", keyName, err)
	}

	var resp struct {
		Data struct {
			Keys map[string]json.RawMessage `json:"keys"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return "", fmt.Errorf("failed to decode transit key export response: %w", err)
	}
	for _, raw := range resp.Data.Keys {
		// Vault can return either a plain PEM string, or an object containing private_key.
		var direct string
		if err := json.Unmarshal(raw, &direct); err == nil {
			if strings.TrimSpace(direct) != "" {
				return direct, nil
			}
		}
		var wrapped struct {
			PrivateKey string `json:"private_key"`
		}
		if err := json.Unmarshal(raw, &wrapped); err == nil {
			if strings.TrimSpace(wrapped.PrivateKey) != "" {
				return wrapped.PrivateKey, nil
			}
		}
	}
	return "", fmt.Errorf("private key not available for transit key %s", keyName)
}

func (p *Provider) signWithTransitKey(ctx context.Context, keyName string, digestHex string) (string, error) {
	// Match backend verifier semantics: sign SHA-256(hashHex bytes).
	payload := map[string]interface{}{
		"input":               base64.StdEncoding.EncodeToString([]byte(digestHex)),
		"hash_algorithm":      "sha2-256",
		"signature_algorithm": "pss",
		"prehashed":           false,
	}
	path := fmt.Sprintf("/v1/%s/sign/%s", strings.Trim(p.cfg.TransitMount, "/"), url.PathEscape(keyName))
	body, err := p.request(ctx, http.MethodPost, path, payload, true)
	if err != nil {
		return "", fmt.Errorf("failed to sign digest: %w", err)
	}

	var resp struct {
		Data struct {
			Signature string `json:"signature"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return "", fmt.Errorf("failed to decode sign response: %w", err)
	}
	signature := strings.TrimSpace(resp.Data.Signature)
	if signature == "" {
		return "", fmt.Errorf("vault returned empty signature")
	}
	// Vault format: vault:v1:<base64sig>
	parts := strings.Split(signature, ":")
	if len(parts) >= 3 {
		return parts[len(parts)-1], nil
	}
	return signature, nil
}

func (p *Provider) request(ctx context.Context, method, path string, payload interface{}, auth bool) ([]byte, error) {
	if auth {
		token, err := p.ensureToken(ctx)
		if err != nil {
			return nil, err
		}
		_ = token
	}

	var bodyReader io.Reader
	if payload != nil {
		raw, err := json.Marshal(payload)
		if err != nil {
			return nil, err
		}
		bodyReader = bytes.NewReader(raw)
	}

	req, err := http.NewRequestWithContext(ctx, method, strings.TrimRight(p.cfg.Addr, "/")+path, bodyReader)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	if strings.TrimSpace(p.cfg.Namespace) != "" {
		req.Header.Set("X-Vault-Namespace", p.cfg.Namespace)
	}
	if auth {
		p.mu.Lock()
		token := p.token
		p.mu.Unlock()
		req.Header.Set("X-Vault-Token", token)
	}

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("vault request failed (%d): %s", resp.StatusCode, string(responseBody))
	}
	return responseBody, nil
}

func (p *Provider) ensureToken(ctx context.Context) (string, error) {
	p.mu.Lock()
	defer p.mu.Unlock()

	if strings.TrimSpace(p.token) != "" {
		return p.token, nil
	}
	if strings.TrimSpace(p.cfg.Token) != "" {
		p.token = strings.TrimSpace(p.cfg.Token)
		return p.token, nil
	}
	if p.cfg.AuthMethod != "approle" {
		return "", fmt.Errorf("unsupported vault auth method: %s", p.cfg.AuthMethod)
	}
	if strings.TrimSpace(p.cfg.RoleID) == "" || strings.TrimSpace(p.cfg.SecretID) == "" {
		return "", fmt.Errorf("vault approle credentials are not configured")
	}

	payload := map[string]string{
		"role_id":   p.cfg.RoleID,
		"secret_id": p.cfg.SecretID,
	}

	raw, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(p.cfg.Addr, "/")+"/v1/auth/approle/login", bytes.NewReader(raw))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	if strings.TrimSpace(p.cfg.Namespace) != "" {
		req.Header.Set("X-Vault-Namespace", p.cfg.Namespace)
	}

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("vault approle login failed (%d): %s", resp.StatusCode, string(body))
	}

	var login struct {
		Auth struct {
			ClientToken string `json:"client_token"`
		} `json:"auth"`
	}
	if err := json.Unmarshal(body, &login); err != nil {
		return "", err
	}
	if strings.TrimSpace(login.Auth.ClientToken) == "" {
		return "", fmt.Errorf("vault approle login returned empty token")
	}
	p.token = login.Auth.ClientToken
	return p.token, nil
}

func (p *Provider) vaultKeyName(buildID string, keyType model.BuildKeyType, keyID uuid.UUID) string {
	_ = buildID
	kind := strings.ToLower(string(keyType))
	if kind == "" {
		kind = "signing"
	}
	return fmt.Sprintf("build-%s-%s", kind, strings.ReplaceAll(keyID.String(), "-", ""))
}

// DigestHexForVault can be reused by tests for expected signing input.
func DigestHexForVault(hashHex string) string {
	sum := sha256.Sum256([]byte(hashHex))
	return base64.StdEncoding.EncodeToString(sum[:])
}

func (p *Provider) kvKeyPath(keyID uuid.UUID) string {
	return fmt.Sprintf("build-keys/%s", keyID.String())
}

func (p *Provider) writeKVSecret(ctx context.Context, path string, data map[string]interface{}) error {
	mount := strings.Trim(p.cfg.KVMount, "/")
	// KV v2 uses /data/ in the path
	apiPath := fmt.Sprintf("/v1/%s/data/%s", mount, path)
	
	payload := map[string]interface{}{
		"data": data,
	}
	
	_, err := p.request(ctx, http.MethodPost, apiPath, payload, true)
	if err != nil {
		return fmt.Errorf("failed to write KV secret at %s: %w", path, err)
	}
	return nil
}

func (p *Provider) readKVSecret(ctx context.Context, path string) (map[string]interface{}, error) {
	mount := strings.Trim(p.cfg.KVMount, "/")
	// KV v2 uses /data/ in the path
	apiPath := fmt.Sprintf("/v1/%s/data/%s", mount, path)
	
	body, err := p.request(ctx, http.MethodGet, apiPath, nil, true)
	if err != nil {
		return nil, fmt.Errorf("failed to read KV secret at %s: %w", path, err)
	}
	
	var resp struct {
		Data struct {
			Data map[string]interface{} `json:"data"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("failed to decode KV response: %w", err)
	}
	
	return resp.Data.Data, nil
}

func (p *Provider) deleteTransitKey(ctx context.Context, keyName string) error {
	// First, update key config to allow deletion
	configPath := fmt.Sprintf("/v1/%s/keys/%s/config", strings.Trim(p.cfg.TransitMount, "/"), url.PathEscape(keyName))
	configPayload := map[string]interface{}{
		"deletion_allowed": true,
	}
	if _, err := p.request(ctx, http.MethodPost, configPath, configPayload, true); err != nil {
		return fmt.Errorf("failed to enable deletion for transit key %s: %w", keyName, err)
	}
	
	// Then delete the key
	deletePath := fmt.Sprintf("/v1/%s/keys/%s", strings.Trim(p.cfg.TransitMount, "/"), url.PathEscape(keyName))
	if _, err := p.request(ctx, http.MethodDelete, deletePath, nil, true); err != nil {
		return fmt.Errorf("failed to delete transit key %s: %w", keyName, err)
	}
	
	return nil
}
