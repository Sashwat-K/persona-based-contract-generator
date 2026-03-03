package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Sashwat-K/persona-based-contract-generator/backend/internal/config"
	"github.com/Sashwat-K/persona-based-contract-generator/backend/internal/handler"
	"github.com/Sashwat-K/persona-based-contract-generator/backend/internal/middleware"
	"github.com/Sashwat-K/persona-based-contract-generator/backend/internal/repository"
	"github.com/Sashwat-K/persona-based-contract-generator/backend/internal/service"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		slog.Error("failed to load config", "error", err)
		os.Exit(1)
	}

	// Configure structured logging
	setupLogging(cfg.LogLevel, cfg.LogFormat)
	slog.Info("starting HPCR Contract Builder", "host", cfg.ServerHost, "port", cfg.ServerPort)

	// Connect to PostgreSQL
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	// Verify database connection
	if err := pool.Ping(ctx); err != nil {
		slog.Error("failed to ping database", "error", err)
		os.Exit(1)
	}
	slog.Info("connected to database")

	// Initialize repository
	queries := repository.New(pool)

	// Initialize services
	authService := service.NewAuthService(queries, cfg.BcryptCost)
	userService := service.NewUserService(queries, cfg.BcryptCost)

	// Initialize handlers
	authHandler := handler.NewAuthHandler(authService)
	userHandler := handler.NewUserHandler(userService)

	// Build router
	r := buildRouter(cfg, queries, authHandler, userHandler)

	// Create HTTP server
	srv := &http.Server{
		Addr:         cfg.Addr(),
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in a goroutine
	go func() {
		slog.Info("server listening", "addr", cfg.Addr())
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	// Seed initial admin user if no users exist
	if err := seedAdminUser(ctx, queries, cfg.BcryptCost); err != nil {
		slog.Error("failed to seed admin user", "error", err)
		os.Exit(1)
	}

	// Wait for shutdown signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	sig := <-quit
	slog.Info("shutting down server", "signal", sig.String())

	// Graceful shutdown with 30-second timeout
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("server forced to shutdown", "error", err)
		os.Exit(1)
	}

	slog.Info("server stopped gracefully")
}

func buildRouter(
	cfg *config.Config,
	queries repository.Querier,
	authHandler *handler.AuthHandler,
	userHandler *handler.UserHandler,
) *chi.Mux {
	r := chi.NewRouter()

	// Global middleware
	r.Use(middleware.Recoverer())
	r.Use(middleware.Logging())

	// Health check (unauthenticated)
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	})

	// Auth routes (unauthenticated)
	r.Post("/auth/login", authHandler.Login)

	// Authenticated routes
	r.Group(func(r chi.Router) {
		r.Use(middleware.Auth(queries))

		// Auth (authenticated)
		r.Post("/auth/logout", authHandler.Logout)

		// User management (ADMIN only)
		r.Route("/users", func(r chi.Router) {
			r.With(middleware.RequireRole("ADMIN")).Get("/", userHandler.ListUsers)
			r.With(middleware.RequireRole("ADMIN")).Post("/", userHandler.CreateUser)
			r.With(middleware.RequireRole("ADMIN")).Patch("/{id}/roles", userHandler.UpdateRoles)

			// Token management (ADMIN or owner)
			r.With(middleware.RequireOwnerOrAdmin("id")).Get("/{id}/tokens", userHandler.ListTokens)
			r.With(middleware.RequireOwnerOrAdmin("id")).Post("/{id}/tokens", userHandler.CreateToken)
			r.With(middleware.RequireOwnerOrAdmin("id")).Delete("/{id}/tokens/{token_id}", userHandler.RevokeToken)
		})
	})

	return r
}

func setupLogging(level, format string) {
	var logLevel slog.Level
	switch level {
	case "debug":
		logLevel = slog.LevelDebug
	case "warn":
		logLevel = slog.LevelWarn
	case "error":
		logLevel = slog.LevelError
	default:
		logLevel = slog.LevelInfo
	}

	opts := &slog.HandlerOptions{Level: logLevel}

	var logHandler slog.Handler
	if format == "text" {
		logHandler = slog.NewTextHandler(os.Stdout, opts)
	} else {
		logHandler = slog.NewJSONHandler(os.Stdout, opts)
	}

	slog.SetDefault(slog.New(logHandler))
}

// seedAdminUser creates an initial admin user if no users exist.
// This is called on startup to ensure there's always at least one admin.
func seedAdminUser(ctx context.Context, queries repository.Querier, bcryptCost int) error {
	// Check if any users exist
	users, err := queries.ListUsers(ctx)
	if err != nil {
		return fmt.Errorf("failed to check existing users: %w", err)
	}

	if len(users) > 0 {
		slog.Debug("users already exist, skipping admin seed")
		return nil
	}

	slog.Info("no users found, creating default admin user")

	// Get admin credentials from environment or use defaults
	adminEmail := os.Getenv("ADMIN_EMAIL")
	if adminEmail == "" {
		adminEmail = "admin@hpcr-builder.local"
	}
	adminPassword := os.Getenv("ADMIN_PASSWORD")
	if adminPassword == "" {
		adminPassword = "admin123" // Default for development only
		slog.Warn("using default admin password — change this in production!")
	}
	adminName := os.Getenv("ADMIN_NAME")
	if adminName == "" {
		adminName = "System Admin"
	}

	userSvc := service.NewUserService(queries, bcryptCost)
	admin, err := userSvc.CreateUser(ctx, service.CreateUserInput{
		Name:     adminName,
		Email:    adminEmail,
		Password: adminPassword,
		Roles:    []string{}, // Do not assign roles here yet
	}, uuid.Nil) // Zero UUID is fine for user creation if no roles are assigned immediately
	if err != nil {
		return fmt.Errorf("failed to create admin user: %w", err)
	}

	// Assign ADMIN role with themselves as the assigner
	_, err = queries.AssignRole(ctx, repository.AssignRoleParams{
		UserID:     admin.ID,
		Role:       "ADMIN",
		AssignedBy: admin.ID,
	})
	if err != nil {
		return fmt.Errorf("failed to assign ADMIN role to initial user: %w", err)
	}

	slog.Info("admin user created", "id", admin.ID, "email", admin.Email)
	return nil
}
