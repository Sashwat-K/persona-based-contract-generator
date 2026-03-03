package handler

import (
	"net/http"

	"github.com/Sashwat-K/persona-based-contract-generator/backend/internal/middleware"
	"github.com/Sashwat-K/persona-based-contract-generator/backend/internal/model"
	"github.com/Sashwat-K/persona-based-contract-generator/backend/internal/service"
)

// AuthHandler handles authentication endpoints.
type AuthHandler struct {
	authService *service.AuthService
}

// NewAuthHandler creates a new AuthHandler.
func NewAuthHandler(authService *service.AuthService) *AuthHandler {
	return &AuthHandler{authService: authService}
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

	result, err := h.authService.Login(r.Context(), req.Email, req.Password)
	if err != nil {
		// Don't leak whether the email exists or not
		writeError(w, model.ErrUnauthorized())
		return
	}

	writeJSON(w, http.StatusOK, result)
}

// Logout handles POST /auth/logout.
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	tokenHash := middleware.GetTokenHash(r.Context())
	if tokenHash == "" {
		writeError(w, model.ErrUnauthorized())
		return
	}

	if err := h.authService.Logout(r.Context(), tokenHash); err != nil {
		writeError(w, model.ErrInternal("Failed to logout."))
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
