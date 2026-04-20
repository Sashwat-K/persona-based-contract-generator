package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

// Config holds all configuration values for the backend server.
type Config struct {
	// Server
	ServerHost string
	ServerPort int

	// Database
	DatabaseURL string

	// Auth
	TokenExpiry time.Duration
	BcryptCost  int

	// Logging
	LogLevel  string
	LogFormat string

	// Limits
	MaxPayloadSize int64 // bytes

	// Security
	CORSAllowedOrigins []string
	CORSAllowAll       bool
	TrustProxyHeaders  bool

	// Request lifecycle
	RequestTimeout time.Duration

	// Key management
	KeyProvider string

	// Vault (required for key management)
	VaultAddr           string
	VaultNamespace      string
	VaultAuthMethod     string
	VaultRoleID         string
	VaultSecretID       string
	VaultToken          string
	VaultTransitMount   string
	VaultKVMount        string
	VaultRequestTimeout time.Duration
}

// Load reads configuration from environment variables with sensible defaults.
func Load() (*Config, error) {
	cfg := &Config{
		ServerHost:     getEnv("SERVER_HOST", "0.0.0.0"),
		ServerPort:     getEnvInt("SERVER_PORT", 8080),
		DatabaseURL:    os.Getenv("DATABASE_URL"),
		TokenExpiry:    getEnvDuration("TOKEN_EXPIRY", 24*time.Hour),
		BcryptCost:     getEnvInt("BCRYPT_COST", 12),
		LogLevel:       getEnv("LOG_LEVEL", "info"),
		LogFormat:      getEnv("LOG_FORMAT", "json"),
		MaxPayloadSize: getEnvInt64("MAX_PAYLOAD_SIZE", 52428800), // 50MB
		CORSAllowedOrigins: splitAndTrim(getEnv(
			"CORS_ALLOWED_ORIGINS",
			"http://localhost:5173,http://127.0.0.1:5173,null",
		)),
		CORSAllowAll:        getEnvBool("CORS_ALLOW_ALL", false),
		TrustProxyHeaders:   getEnvBool("TRUST_PROXY_HEADERS", false),
		RequestTimeout:      getEnvDuration("REQUEST_TIMEOUT", 30*time.Second),
		KeyProvider:         strings.ToLower(getEnv("KEY_PROVIDER", "vault")),
		VaultAddr:           getEnv("VAULT_ADDR", ""),
		VaultNamespace:      getEnv("VAULT_NAMESPACE", ""),
		VaultAuthMethod:     strings.ToLower(getEnv("VAULT_AUTH_METHOD", "approle")),
		VaultRoleID:         getEnv("VAULT_ROLE_ID", ""),
		VaultSecretID:       getEnv("VAULT_SECRET_ID", ""),
		VaultToken:          getEnv("VAULT_TOKEN", ""),
		VaultTransitMount:   getEnv("VAULT_TRANSIT_MOUNT", "transit"),
		VaultKVMount:        getEnv("VAULT_KV_MOUNT", "secret"),
		VaultRequestTimeout: getEnvDuration("VAULT_REQUEST_TIMEOUT", 10*time.Second),
	}

	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL environment variable is required")
	}
	if cfg.KeyProvider != "vault" {
		return nil, fmt.Errorf("KEY_PROVIDER must be 'vault'")
	}

	if strings.TrimSpace(cfg.VaultAddr) == "" {
		return nil, fmt.Errorf("VAULT_ADDR is required")
	}
	if strings.TrimSpace(cfg.VaultToken) == "" {
		if cfg.VaultAuthMethod != "approle" {
			return nil, fmt.Errorf("VAULT_AUTH_METHOD must be 'approle' when VAULT_TOKEN is not provided")
		}
		if strings.TrimSpace(cfg.VaultRoleID) == "" || strings.TrimSpace(cfg.VaultSecretID) == "" {
			return nil, fmt.Errorf("VAULT_ROLE_ID and VAULT_SECRET_ID are required for approle auth")
		}
	}

	return cfg, nil
}

// Addr returns the server listen address.
func (c *Config) Addr() string {
	return fmt.Sprintf("%s:%d", c.ServerHost, c.ServerPort)
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	return fallback
}

func getEnvInt64(key string, fallback int64) int64 {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.ParseInt(v, 10, 64); err == nil {
			return i
		}
	}
	return fallback
}

func getEnvBool(key string, fallback bool) bool {
	if v := strings.TrimSpace(strings.ToLower(os.Getenv(key))); v != "" {
		switch v {
		case "1", "true", "yes", "y", "on":
			return true
		case "0", "false", "no", "n", "off":
			return false
		}
	}
	return fallback
}

func splitAndTrim(value string) []string {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	parts := strings.Split(value, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed == "" {
			continue
		}
		out = append(out, trimmed)
	}
	return out
}

func getEnvDuration(key string, fallback time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			return d
		}
	}
	return fallback
}
