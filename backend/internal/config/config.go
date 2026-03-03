package config

import (
	"fmt"
	"os"
	"strconv"
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
	}

	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL environment variable is required")
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

func getEnvDuration(key string, fallback time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			return d
		}
	}
	return fallback
}
