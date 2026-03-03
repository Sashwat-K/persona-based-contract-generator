package middleware

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// RequireRole returns middleware that checks if the authenticated user has at least
// one of the specified roles. Must be used after Auth middleware.
func RequireRole(roles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !HasRole(r.Context(), roles...) {
				writeForbidden(w, "You do not have the required role to access this resource.")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// RequireOwnerOrAdmin returns middleware that checks if the authenticated user
// is either the resource owner (matching the URL param) or has the ADMIN role.
// This is used for token management endpoints where users can manage their own tokens.
func RequireOwnerOrAdmin(paramName string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Get the resource owner ID from URL param
			paramValue := chi.URLParam(r, paramName)
			resourceOwnerID, err := uuid.Parse(paramValue)
			if err != nil {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusBadRequest)
				w.Write([]byte(`{"error":{"code":"INVALID_REQUEST","message":"Invalid user ID in URL."}}`))
				return
			}

			// Check if user is the owner or an admin
			userID, ok := GetUserID(r.Context())
			if !ok {
				writeUnauthorized(w)
				return
			}

			if userID != resourceOwnerID && !HasRole(r.Context(), "ADMIN") {
				writeForbidden(w, "You can only access your own resources or must have ADMIN role.")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func writeForbidden(w http.ResponseWriter, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusForbidden)
	w.Write([]byte(`{"error":{"code":"FORBIDDEN","message":"` + msg + `"}}`))
}
