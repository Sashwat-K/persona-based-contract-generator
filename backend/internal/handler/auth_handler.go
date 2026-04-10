package handler

import (
	"net/http"

	"github.com/Sashwat-K/persona-based-contract-generator/backend/internal/middleware"
	"github.com/Sashwat-K/persona-based-contract-generator/backend/internal/model"
	"github.com/Sashwat-K/persona-based-contract-generator/backend/internal/service"
)

// AuthHandler handles authentication endpoints.
type AuthHandler struct {
	authService      *service.AuthService
	systemLogService *service.SystemLogService
}

// NewAuthHandler creates a new AuthHandler.
func NewAuthHandler(authService *service.AuthService, systemLogService *service.SystemLogService) *AuthHandler {
	return &AuthHandler{
		authService:      authService,
		systemLogService: systemLogService,
	}
}

// loginRequest is the JSON request body for POST /auth/login.
type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// Login handles POST /auth/login.
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := readJSON(r, &req); err != nil {
		writeError(w, model.ErrInvalidRequest(err.Error()))
		return
	}

	if req.Email == "" || req.Password == "" {
		writeError(w, model.ErrInvalidRequest("Email and password are required."))
		return
	}

	ipAddress := r.RemoteAddr
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		ipAddress = forwarded
	}

	result, err := h.authService.Login(r.Context(), req.Email, req.Password)
	if err != nil {
		h.systemLogService.LogEvent(r.Context(), req.Email, "USER_LOGIN", "Authentication System", ipAddress, "FAILED", "Login attempt failed: "+err.Error())
		// Don't leak whether the email exists or not.
		// Return credential-specific 401 instead of bearer-token wording.
		writeError(w, &model.AppError{
			Code:       "INVALID_CREDENTIALS",
			Message:    "Invalid email or password.",
			HTTPStatus: http.StatusUnauthorized,
		})
		return
	}

	h.systemLogService.LogEvent(r.Context(), req.Email, "USER_LOGIN", "Authentication System", ipAddress, "SUCCESS", "User logged in successfully")

	writeJSON(w, http.StatusOK, result)
}

// Logout handles POST /auth/logout.
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	tokenHash := middleware.GetTokenHash(r.Context())
	if tokenHash == "" {
		writeError(w, model.ErrUnauthorized())
		return
	}

	ipAddress := r.RemoteAddr
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		ipAddress = forwarded
	}

	if err := h.authService.Logout(r.Context(), tokenHash); err != nil {
		h.systemLogService.LogEvent(r.Context(), "unknown", "USER_LOGOUT", "Authentication System", ipAddress, "FAILED", "Failed to logout")
		writeError(w, model.ErrInternal("Failed to logout."))
		return
	}

	// Because we don't have the user's email readily available from tokenHash in the handler layer, we log what we can.
	h.systemLogService.LogEvent(r.Context(), "unknown", "USER_LOGOUT", "Authentication System", ipAddress, "SUCCESS", "User logged out")

	w.WriteHeader(http.StatusNoContent)
}
