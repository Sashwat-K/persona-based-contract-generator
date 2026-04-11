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
	slog.Info("starting IBM Confidential Computing Contract Generator", "host", cfg.ServerHost, "port", cfg.ServerPort)
	middleware.SetTrustProxyHeaders(cfg.TrustProxyHeaders)

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

	// Initialize services (order matters due to dependencies)
	auditService := service.NewAuditService(queries)
	assignmentService := service.NewAssignmentService(queries, auditService)
	buildService := service.NewBuildService(queries, auditService)
	sectionService := service.NewSectionService(queries, assignmentService, buildService)
	authService := service.NewAuthService(queries, cfg.BcryptCost, cfg.TokenExpiry)
	userService := service.NewUserService(queries, cfg.BcryptCost)
	roleService := service.NewRoleService(queries)
	verificationService := service.NewVerificationService(queries)
	exportService := service.NewExportService(queries, auditService, assignmentService)
	rotationService := service.NewRotationService(queries)
	systemLogService := service.NewSystemLogService(queries)
	middleware.SetSystemLogHook(systemLogService.LogEvent)
	systemLogService.LogEvent(ctx, "system", "SERVER_STARTED", "Backend Server", cfg.ServerHost, "SUCCESS", "Server boot sequence completed")

	// Initialize handlers
	auditHandler := handler.NewAuditHandler(auditService)
	assignmentHandler := handler.NewAssignmentHandler(assignmentService, systemLogService)
	sectionHandler := handler.NewSectionHandler(sectionService, systemLogService)
	buildHandler := handler.NewBuildHandler(buildService, systemLogService)
	authHandler := handler.NewAuthHandler(authService, systemLogService)
	userHandler := handler.NewUserHandler(userService, systemLogService)
	roleHandler := handler.NewRoleHandler(roleService)
	exportHandler := handler.NewExportHandler(exportService, verificationService, userService, systemLogService)
	rotationHandler := handler.NewRotationHandler(rotationService, systemLogService)
	swaggerHandler := handler.NewSwaggerHandler()
	systemLogHandler := handler.NewSystemLogHandler(systemLogService)

	// Build router
	r := buildRouter(cfg, queries, authHandler, userHandler, roleHandler, buildHandler, sectionHandler, auditHandler, assignmentHandler, exportHandler, rotationHandler, swaggerHandler, systemLogHandler)

	// Start credential rotation monitor (checks every 24 hours)
	monitorCtx, cancelMonitor := context.WithCancel(ctx)
	defer cancelMonitor()
	go rotationService.StartRotationMonitor(monitorCtx, 24*time.Hour)

	// Create HTTP server
	srv := &http.Server{
		Addr:              cfg.Addr(),
		Handler:           r,
		ReadTimeout:       15 * time.Second,
		ReadHeaderTimeout: 10 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    1 << 20, // 1 MB
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
	systemLogService.LogEvent(ctx, "system", "SERVER_SHUTDOWN_INITIATED", "Backend Server", cfg.ServerHost, "SUCCESS", "Shutdown signal received: "+sig.String())

	// Graceful shutdown with 30-second timeout
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		systemLogService.LogEvent(ctx, "system", "SERVER_SHUTDOWN", "Backend Server", cfg.ServerHost, "FAILED", "Graceful shutdown failed: "+err.Error())
		slog.Error("server forced to shutdown", "error", err)
		os.Exit(1)
	}

	systemLogService.LogEvent(ctx, "system", "SERVER_SHUTDOWN", "Backend Server", cfg.ServerHost, "SUCCESS", "Server stopped gracefully")
	slog.Info("server stopped gracefully")
}

func buildRouter(
	cfg *config.Config,
	queries repository.Querier,
	authHandler *handler.AuthHandler,
	userHandler *handler.UserHandler,
	roleHandler *handler.RoleHandler,
	buildHandler *handler.BuildHandler,
	sectionHandler *handler.SectionHandler,
	auditHandler *handler.AuditHandler,
	assignmentHandler *handler.AssignmentHandler,
	exportHandler *handler.ExportHandler,
	rotationHandler *handler.RotationHandler,
	swaggerHandler *handler.SwaggerHandler,
	systemLogHandler *handler.SystemLogHandler,
) *chi.Mux {
	r := chi.NewRouter()

	// Global middleware
	r.Use(middleware.Recoverer())
	r.Use(middleware.RequestID())
	r.Use(middleware.SecurityHeaders())
	r.Use(middleware.Logging())
	r.Use(middleware.CORS(cfg.CORSAllowedOrigins, cfg.CORSAllowAll))
	r.Use(middleware.MaxBodyBytes(cfg.MaxPayloadSize))
	r.Use(middleware.RequestTimeout(cfg.RequestTimeout))
	r.Use(middleware.RateLimit())

	// Health check (unauthenticated)
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	})
	r.Get("/openapi.json", swaggerHandler.OpenAPISpec)
	r.Get("/swagger", swaggerHandler.UI)
	r.Get("/swagger/", swaggerHandler.UI)

	// Auth routes (unauthenticated, with stricter rate limiting)
	r.With(middleware.AuthRateLimit()).Post("/auth/login", authHandler.Login)

	// Authenticated routes
	r.Group(func(r chi.Router) {
		r.Use(middleware.Auth(queries, cfg.TokenExpiry))
		r.Use(middleware.SetupGuard())
		r.Use(middleware.RequireRequestSignature(queries))

		// Auth (authenticated)
		r.Post("/auth/logout", authHandler.Logout)

		// Roles reference data
		r.Get("/roles", roleHandler.ListRoles)

		// User management (ADMIN only)
		r.Route("/users", func(r chi.Router) {
			r.With(middleware.RequireRole("ADMIN")).Get("/", userHandler.ListUsers)
			r.With(middleware.RequireRole("ADMIN")).Post("/", userHandler.CreateUser)
			r.With(middleware.RequireRole("ADMIN")).Patch("/{id}", userHandler.UpdateUserProfile)
			r.With(middleware.RequireRole("ADMIN")).Patch("/{id}/roles", userHandler.UpdateRoles)
			r.With(middleware.RequireRole("ADMIN")).Delete("/{id}", userHandler.DeactivateUser)

			// Public key management (owner or ADMIN)
			r.With(middleware.RequireOwnerOrAdmin("id")).Put("/{id}/public-key", userHandler.RegisterPublicKey)
			r.With(middleware.RequireOwnerOrAdmin("id")).Get("/{id}/public-key", userHandler.GetPublicKey)

			// Password management (owner or ADMIN)
			r.With(middleware.RequireOwnerOrAdmin("id")).Patch("/{id}/password", userHandler.ChangePassword)

			// Reactivation (ADMIN only)
			r.With(middleware.RequireRole("ADMIN")).Patch("/{id}/reactivate", userHandler.ReactivateUser)

			// Admin password reset (ADMIN only)
			r.With(middleware.RequireRole("ADMIN")).Patch("/{id}/reset-password", userHandler.AdminResetPassword)

			// Token management (ADMIN or owner)
			r.With(middleware.RequireOwnerOrAdmin("id")).Get("/{id}/tokens", userHandler.ListTokens)
			r.With(middleware.RequireOwnerOrAdmin("id")).Post("/{id}/tokens", userHandler.CreateToken)
			r.With(middleware.RequireOwnerOrAdmin("id")).Delete("/{id}/tokens/{token_id}", userHandler.RevokeToken)

			// User assignments (any authenticated user can view their own)
			r.Get("/{id}/assignments", assignmentHandler.GetUserAssignments)
		})

		// System Logs (admin & auditor)
		r.Group(func(r chi.Router) {
			r.Use(middleware.RequireRole("ADMIN", "AUDITOR"))
			r.Get("/system-logs", systemLogHandler.ListSystemLogs)
		})

		// Builds management
		r.Route("/builds", func(r chi.Router) {
			r.Get("/", buildHandler.ListBuilds) // Any authenticated user can list builds
			r.With(middleware.RequireRole("ADMIN")).Post("/", buildHandler.CreateBuild)

			r.Route("/{id}", func(r chi.Router) {
				r.Get("/", buildHandler.GetBuild)
				r.Patch("/status", buildHandler.TransitionStatus) // Role validation done internally in service based on transition state
				r.With(middleware.RequireRole("AUDITOR")).Post("/attestation", buildHandler.RegisterAttestation)
				r.With(middleware.RequireRole("AUDITOR")).Post("/finalize", buildHandler.FinalizeBuild)
				r.With(middleware.RequireRole("ADMIN")).Post("/cancel", buildHandler.CancelBuild)

				// Sections
				r.Get("/sections", sectionHandler.GetSections)
				r.Post("/sections", sectionHandler.SubmitSection) // Assignment validation done internally

				// Audit Trail
				r.Get("/audit", auditHandler.GetAuditTrail)
				r.Get("/audit-trail", auditHandler.GetAuditTrail)

				// Build Assignments (ADMIN only for create/delete, any authenticated for read)
				r.Get("/assignments", assignmentHandler.GetBuildAssignments)
				r.With(middleware.RequireRole("ADMIN")).Post("/assignments", assignmentHandler.CreateAssignment)
				r.With(middleware.RequireRole("ADMIN")).Delete("/assignments", assignmentHandler.DeleteBuildAssignments)

				// Export & Verification
				r.Get("/export", exportHandler.ExportContract)                     // AUDITOR or ENV_OPERATOR
				r.Post("/acknowledge-download", exportHandler.AcknowledgeDownload) // ENV_OPERATOR
				r.Get("/userdata", exportHandler.GetUserData)                      // ENV_OPERATOR
				r.Get("/verify", exportHandler.VerifyAuditChain)                   // Any authenticated
				r.Get("/verify-contract", exportHandler.VerifyContractIntegrity)   // Any authenticated
			})
		})

		// Credential Rotation Management (ADMIN only)
		r.Route("/rotation", func(r chi.Router) {
			r.With(middleware.RequireRole("ADMIN")).Get("/expired", rotationHandler.GetExpiredCredentials)
			r.With(middleware.RequireRole("ADMIN")).Post("/force-password-change/{user_id}", rotationHandler.ForcePasswordChange)
			r.With(middleware.RequireRole("ADMIN")).Post("/revoke-key/{user_id}", rotationHandler.RevokeExpiredPublicKey)
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
