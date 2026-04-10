package middleware

import (
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/Sashwat-K/persona-based-contract-generator/backend/internal/repository"
	"github.com/Sashwat-K/persona-based-contract-generator/backend/internal/service"
)

// Auth returns middleware that validates Bearer token authentication.
// It extracts the token from the Authorization header, validates it against the DB,
// and populates the request context with user info.
func Auth(queries repository.Querier, tokenExpiry time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Extract Bearer token from Authorization header
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				writeUnauthorized(w)
				return
			}

			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
				writeUnauthorized(w)
				return
			}
			rawToken := parts[1]

			// Hash the token and look it up
			tokenHash := service.HashToken(rawToken)
			token, err := queries.GetAPITokenByHash(r.Context(), tokenHash)
			if err != nil {
				writeUnauthorized(w)
				return
			}

			// Check if token is revoked
			if token.RevokedAt.Valid {
				writeUnauthorized(w)
				return
			}
			// Check if token is expired
			if tokenExpiry > 0 && time.Now().After(token.CreatedAt.Add(tokenExpiry)) {
				writeUnauthorized(w)
				return
			}

			// Load user
			user, err := queries.GetUserByID(r.Context(), token.UserID)
			if err != nil {
				writeUnauthorized(w)
				return
			}

			// Check if user is active
			if !user.IsActive {
				writeUnauthorized(w)
				return
			}

			// Load user roles
			roles, err := queries.GetRolesByUserID(r.Context(), user.ID)
			if err != nil {
				slog.Error("failed to load user roles", "error", err, "user_id", user.ID)
				writeUnauthorized(w)
				return
			}

			roleStrings := make([]string, len(roles))
			for i, role := range roles {
				roleStrings[i] = role.Role
			}

			setupPending := make([]string, 0, 2)
			if user.MustChangePassword {
				setupPending = append(setupPending, "password_change")
			}
			publicKeyExpired := user.PublicKeyExpiresAt.Valid && user.PublicKeyExpiresAt.Time.Before(time.Now())
			if user.PublicKey == nil || publicKeyExpired {
				setupPending = append(setupPending, "public_key_registration")
			}
			setupRequired := len(setupPending) > 0

			// Update last_used_at (fire-and-forget, don't block the request)
			go func() {
				_ = queries.UpdateTokenLastUsed(r.Context(), token.ID)
			}()

			// Set auth context and continue
			ctx := SetAuthContext(r.Context(), user.ID, roleStrings, tokenHash, setupRequired, setupPending)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func writeUnauthorized(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	w.Write([]byte(`{"error":{"code":"UNAUTHORIZED","message":"Missing or invalid bearer token."}}`))
}
