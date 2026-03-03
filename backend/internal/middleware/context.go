package middleware

import (
	"context"

	"github.com/google/uuid"
)

// contextKey is an unexported type used for context keys in this package.
type contextKey string

const (
	userIDKey    contextKey = "user_id"
	userRolesKey contextKey = "user_roles"
	tokenHashKey contextKey = "token_hash"
)

// AuthenticatedUser holds the user info extracted from a valid token.
type AuthenticatedUser struct {
	UserID uuid.UUID
	Roles  []string
}

// SetAuthContext stores authentication information in the request context.
func SetAuthContext(ctx context.Context, userID uuid.UUID, roles []string, tokenHash string) context.Context {
	ctx = context.WithValue(ctx, userIDKey, userID)
	ctx = context.WithValue(ctx, userRolesKey, roles)
	ctx = context.WithValue(ctx, tokenHashKey, tokenHash)
	return ctx
}

// GetUserID retrieves the authenticated user's ID from the context.
func GetUserID(ctx context.Context) (uuid.UUID, bool) {
	id, ok := ctx.Value(userIDKey).(uuid.UUID)
	return id, ok
}

// GetUserRoles retrieves the authenticated user's roles from the context.
func GetUserRoles(ctx context.Context) []string {
	roles, ok := ctx.Value(userRolesKey).([]string)
	if !ok {
		return nil
	}
	return roles
}

// GetTokenHash retrieves the token hash from the context.
func GetTokenHash(ctx context.Context) string {
	hash, ok := ctx.Value(tokenHashKey).(string)
	if !ok {
		return ""
	}
	return hash
}

// HasRole checks if the authenticated user has any of the specified roles.
func HasRole(ctx context.Context, roles ...string) bool {
	userRoles := GetUserRoles(ctx)
	for _, required := range roles {
		for _, userRole := range userRoles {
			if userRole == required {
				return true
			}
		}
	}
	return false
}
