package handler

import (
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/Sashwat-K/persona-based-contract-generator/backend/internal/middleware"
	"github.com/Sashwat-K/persona-based-contract-generator/backend/internal/model"
	"github.com/Sashwat-K/persona-based-contract-generator/backend/internal/service"
)

// UserHandler handles user management endpoints.
type UserHandler struct {
	userService      *service.UserService
	systemLogService *service.SystemLogService
}

// NewUserHandler creates a new UserHandler.
func NewUserHandler(userService *service.UserService, systemLogService *service.SystemLogService) *UserHandler {
	return &UserHandler{
		userService:      userService,
		systemLogService: systemLogService,
	}
}

// ListUsers handles GET /users.
func (h *UserHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
	users, err := h.userService.ListUsers(r.Context())
	if err != nil {
		writeError(w, model.ErrInternal("Failed to list users."))
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"users": users})
}

// createUserRequest is the JSON request for POST /users.
type createUserRequest struct {
	Name     string   `json:"name"`
	Email    string   `json:"email"`
	Password string   `json:"password"`
	Roles    []string `json:"roles"`
}

// CreateUser handles POST /users.
func (h *UserHandler) CreateUser(w http.ResponseWriter, r *http.Request) {
	var req createUserRequest
	if err := readJSON(r, &req); err != nil {
		writeError(w, model.ErrInvalidRequest(err.Error()))
		return
	}

	if req.Name == "" || req.Email == "" || req.Password == "" {
		writeError(w, model.ErrInvalidRequest("Name, email, and password are required."))
		return
	}

	if len(req.Roles) == 0 {
		writeError(w, model.ErrInvalidRequest("At least one role is required."))
		return
	}

	// Validate roles
	for _, role := range req.Roles {
		if !model.PersonaRole(role).IsValid() {
			writeError(w, model.ErrInvalidRequest("Invalid role: "+role))
			return
		}
	}

	assignedBy, ok := middleware.GetUserID(r.Context())
	if !ok {
		writeError(w, model.ErrUnauthorized())
		return
	}

	user, err := h.userService.CreateUser(r.Context(), service.CreateUserInput{
		Name:     req.Name,
		Email:    req.Email,
		Password: req.Password,
		Roles:    req.Roles,
	}, assignedBy)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate") || strings.Contains(err.Error(), "unique") {
			writeError(w, model.ErrDuplicateEmail(req.Email))
			return
		}
		writeError(w, model.ErrInternal("Failed to create user."))
		return
	}

	ipAddress := r.RemoteAddr
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		ipAddress = forwarded
	}

	h.systemLogService.LogEvent(r.Context(), req.Email, "USER_CREATED", "User Management", ipAddress, "SUCCESS", "Created new user account")

	writeJSON(w, http.StatusCreated, user)
}

// updateRolesRequest is the JSON request for PATCH /users/{id}/roles.
type updateRolesRequest struct {
	Roles []string `json:"roles"`
}

// updateProfileRequest is the JSON request for PATCH /users/{id}.
type updateProfileRequest struct {
	Name  string `json:"name"`
	Email string `json:"email"`
}

// UpdateUserProfile handles PATCH /users/{id}.
func (h *UserHandler) UpdateUserProfile(w http.ResponseWriter, r *http.Request) {
	userID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, model.ErrInvalidRequest("Invalid user ID."))
		return
	}

	var req updateProfileRequest
	if err := readJSON(r, &req); err != nil {
		writeError(w, model.ErrInvalidRequest(err.Error()))
		return
	}

	if req.Name == "" || req.Email == "" {
		writeError(w, model.ErrInvalidRequest("Name and email are required."))
		return
	}

	user, err := h.userService.UpdateUserProfile(r.Context(), userID, req.Name, req.Email)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "duplicate") || strings.Contains(strings.ToLower(err.Error()), "unique") {
			writeError(w, model.ErrDuplicateEmail(req.Email))
			return
		}
		if strings.Contains(strings.ToLower(err.Error()), "not found") {
			writeError(w, model.ErrUserNotFound(userID.String()))
			return
		}
		writeError(w, model.ErrInternal("Failed to update user profile."))
		return
	}

	writeJSON(w, http.StatusOK, user)
}

// DeactivateUser handles DELETE /users/{id}.
func (h *UserHandler) DeactivateUser(w http.ResponseWriter, r *http.Request) {
	userID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, model.ErrInvalidRequest("Invalid user ID."))
		return
	}

	err = h.userService.DeactivateUser(r.Context(), userID)
	if err != nil {
		writeError(w, model.ErrInternal("Failed to deactivate user."))
		return
	}

	ipAddress := r.RemoteAddr
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		ipAddress = forwarded
	}
	
	// Default to system or caller email if available. User ID is known.
	actorEmail := "admin@hpcr" // Can fetch properly from token if needed, keeping simple.
	h.systemLogService.LogEvent(r.Context(), actorEmail, "USER_DEACTIVATED", "User: "+userID.String(), ipAddress, "SUCCESS", "Deactivated user account")

	writeJSON(w, http.StatusOK, map[string]string{"message": "User deactivated successfully."})
}

// UpdateRoles handles PATCH /users/{id}/roles.
func (h *UserHandler) UpdateRoles(w http.ResponseWriter, r *http.Request) {
	userID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, model.ErrInvalidRequest("Invalid user ID."))
		return
	}

	var req updateRolesRequest
	if err := readJSON(r, &req); err != nil {
		writeError(w, model.ErrInvalidRequest(err.Error()))
		return
	}

	if len(req.Roles) == 0 {
		writeError(w, model.ErrInvalidRequest("At least one role is required."))
		return
	}

	assignedBy, ok := middleware.GetUserID(r.Context())
	if !ok {
		writeError(w, model.ErrUnauthorized())
		return
	}

	user, err := h.userService.UpdateRoles(r.Context(), userID, req.Roles, assignedBy)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			writeError(w, model.ErrUserNotFound(userID.String()))
			return
		}
		writeError(w, model.ErrInternal("Failed to update roles."))
		return
	}

	writeJSON(w, http.StatusOK, user)
}

// ListTokens handles GET /users/{id}/tokens.
func (h *UserHandler) ListTokens(w http.ResponseWriter, r *http.Request) {
	userID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, model.ErrInvalidRequest("Invalid user ID."))
		return
	}

	tokens, err := h.userService.ListTokens(r.Context(), userID)
	if err != nil {
		writeError(w, model.ErrInternal("Failed to list tokens."))
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"tokens": tokens})
}

// createTokenRequest is the JSON request for POST /users/{id}/tokens.
type createTokenRequest struct {
	Name string `json:"name"`
}

// CreateToken handles POST /users/{id}/tokens.
func (h *UserHandler) CreateToken(w http.ResponseWriter, r *http.Request) {
	userID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, model.ErrInvalidRequest("Invalid user ID."))
		return
	}

	var req createTokenRequest
	if err := readJSON(r, &req); err != nil {
		writeError(w, model.ErrInvalidRequest(err.Error()))
		return
	}

	if req.Name == "" {
		writeError(w, model.ErrInvalidRequest("Token name is required."))
		return
	}

	result, err := h.userService.CreateToken(r.Context(), userID, req.Name)
	if err != nil {
		writeError(w, model.ErrInternal("Failed to create token."))
		return
	}

	writeJSON(w, http.StatusCreated, result)
}

// RevokeToken handles DELETE /users/{id}/tokens/{token_id}.
func (h *UserHandler) RevokeToken(w http.ResponseWriter, r *http.Request) {
	userID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, model.ErrInvalidRequest("Invalid user ID."))
		return
	}

	tokenID, err := uuid.Parse(chi.URLParam(r, "token_id"))
	if err != nil {
		writeError(w, model.ErrInvalidRequest("Invalid token ID."))
		return
	}

	if err := h.userService.RevokeToken(r.Context(), userID, tokenID); err != nil {
		writeError(w, model.ErrInternal("Failed to revoke token."))
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// registerPublicKeyRequest is the JSON request for PUT /users/{id}/public-key.
type registerPublicKeyRequest struct {
	PublicKey string `json:"public_key"`
}

// RegisterPublicKey handles PUT /users/{id}/public-key.
func (h *UserHandler) RegisterPublicKey(w http.ResponseWriter, r *http.Request) {
	userID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, model.ErrInvalidRequest("Invalid user ID."))
		return
	}

	var req registerPublicKeyRequest
	if err := readJSON(r, &req); err != nil {
		writeError(w, model.ErrInvalidRequest(err.Error()))
		return
	}

	if req.PublicKey == "" {
		writeError(w, model.ErrInvalidRequest("Public key is required."))
		return
	}

	_, err = h.userService.RegisterPublicKey(r.Context(), userID, req.PublicKey)
	if err != nil {
		if strings.Contains(err.Error(), "invalid public key") {
			writeError(w, model.ErrInvalidRequest(err.Error()))
			return
		}
		writeError(w, model.ErrInternal("Failed to register public key."))
		return
	}

	// Fetch the newly updated keys to get the registered and expiry dates assigned by the database layer.
	_, fingerprintStr, registeredAt, expiresAt, _ := h.userService.GetPublicKey(r.Context(), userID)

	resp := map[string]string{
		"fingerprint": fingerprintStr,
		"message":     "Public key registered successfully",
	}
	if registeredAt != nil {
		resp["created_at"] = registeredAt.Format(time.RFC3339)
	}
	if expiresAt != nil {
		resp["expires_at"] = expiresAt.Format(time.RFC3339)
	}

	writeJSON(w, http.StatusOK, resp)
}

// GetPublicKey handles GET /users/{id}/public-key.
func (h *UserHandler) GetPublicKey(w http.ResponseWriter, r *http.Request) {
	userID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, model.ErrInvalidRequest("Invalid user ID."))
		return
	}

	publicKey, fingerprint, registeredAt, expiresAt, err := h.userService.GetPublicKey(r.Context(), userID)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			writeError(w, model.ErrUserNotFound(userID.String()))
			return
		}
		if strings.Contains(err.Error(), "not registered") {
			writeError(w, model.ErrInvalidRequest("User has not registered a public key"))
			return
		}
		writeError(w, model.ErrInternal("Failed to retrieve public key."))
		return
	}

	resp := map[string]string{
		"public_key":  publicKey,
		"fingerprint": fingerprint,
	}
	if registeredAt != nil {
		resp["created_at"] = registeredAt.Format(time.RFC3339)
	}
	if expiresAt != nil {
		resp["expires_at"] = expiresAt.Format(time.RFC3339)
	}

	writeJSON(w, http.StatusOK, resp)
}

// changePasswordRequest is the JSON request for PATCH /users/{id}/password.
type changePasswordRequest struct {
	NewPassword string `json:"new_password"`
}

// ChangePassword handles PATCH /users/{id}/password.
func (h *UserHandler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	userID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, model.ErrInvalidRequest("Invalid user ID."))
		return
	}

	var req changePasswordRequest
	if err := readJSON(r, &req); err != nil {
		writeError(w, model.ErrInvalidRequest(err.Error()))
		return
	}

	if req.NewPassword == "" {
		writeError(w, model.ErrInvalidRequest("New password is required."))
		return
	}

	// Validate password strength (minimum 8 characters)
	if len(req.NewPassword) < 8 {
		writeError(w, model.ErrInvalidRequest("Password must be at least 8 characters long."))
		return
	}

	if err := h.userService.ChangePassword(r.Context(), userID, req.NewPassword); err != nil {
		writeError(w, model.ErrInternal("Failed to change password."))
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"message": "Password changed successfully",
	})
}

// ReactivateUser handles PATCH /users/{id}/reactivate.
func (h *UserHandler) ReactivateUser(w http.ResponseWriter, r *http.Request) {
	userID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, model.ErrInvalidRequest("Invalid user ID."))
		return
	}

	if err := h.userService.ReactivateUser(r.Context(), userID); err != nil {
		if strings.Contains(err.Error(), "not found") {
			writeError(w, model.ErrUserNotFound(userID.String()))
			return
		}
		writeError(w, model.ErrInternal("Failed to reactivate user."))
		return
	}

	ipAddress := r.RemoteAddr
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		ipAddress = forwarded
	}

	h.systemLogService.LogEvent(r.Context(), "admin", "USER_REACTIVATED", "User: "+userID.String(), ipAddress, "SUCCESS", "Reactivated user account")

	writeJSON(w, http.StatusOK, map[string]string{
		"message": "User reactivated successfully.",
	})
}

// adminResetPasswordRequest is the JSON request for PATCH /users/{id}/reset-password.
type adminResetPasswordRequest struct {
	NewPassword string `json:"new_password"`
}

// AdminResetPassword handles PATCH /users/{id}/reset-password.
func (h *UserHandler) AdminResetPassword(w http.ResponseWriter, r *http.Request) {
	userID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, model.ErrInvalidRequest("Invalid user ID."))
		return
	}

	var req adminResetPasswordRequest
	if err := readJSON(r, &req); err != nil {
		writeError(w, model.ErrInvalidRequest(err.Error()))
		return
	}

	if req.NewPassword == "" {
		writeError(w, model.ErrInvalidRequest("New password is required."))
		return
	}

	if len(req.NewPassword) < 8 {
		writeError(w, model.ErrInvalidRequest("Password must be at least 8 characters long."))
		return
	}

	if err := h.userService.AdminResetPassword(r.Context(), userID, req.NewPassword); err != nil {
		if strings.Contains(err.Error(), "not found") {
			writeError(w, model.ErrUserNotFound(userID.String()))
			return
		}
		writeError(w, model.ErrInternal("Failed to reset password."))
		return
	}

	ipAddress := r.RemoteAddr
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		ipAddress = forwarded
	}

	h.systemLogService.LogEvent(r.Context(), "admin", "ADMIN_PASSWORD_RESET", "User: "+userID.String(), ipAddress, "SUCCESS", "Admin reset user password")

	writeJSON(w, http.StatusOK, map[string]string{
		"message": "Password reset successfully. User must change password on next login.",
	})
}
