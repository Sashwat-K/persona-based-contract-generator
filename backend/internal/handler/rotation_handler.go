package handler

import (
	"net/http"

	"github.com/Sashwat-K/persona-based-contract-generator/backend/internal/model"
	"github.com/Sashwat-K/persona-based-contract-generator/backend/internal/service"
	"github.com/go-chi/chi/v5"
)

// RotationHandler handles credential rotation endpoints
type RotationHandler struct {
	rotationService *service.RotationService
}

// NewRotationHandler creates a new rotation handler
func NewRotationHandler(rotationService *service.RotationService) *RotationHandler {
	return &RotationHandler{
		rotationService: rotationService,
	}
}

// GetExpiredCredentials returns a report of expired credentials
// GET /api/v1/rotation/expired
func (h *RotationHandler) GetExpiredCredentials(w http.ResponseWriter, r *http.Request) {
	report, err := h.rotationService.CheckExpiredCredentials(r.Context())
	if err != nil {
		writeError(w, model.ErrInternal("Failed to check expired credentials"))
		return
	}

	writeJSON(w, http.StatusOK, report)
}

// ForcePasswordChange forces a user to change their password
// POST /api/v1/rotation/force-password-change/{user_id}
func (h *RotationHandler) ForcePasswordChange(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "user_id")
	if userID == "" {
		writeError(w, model.ErrInvalidRequest("User ID is required"))
		return
	}

	err := h.rotationService.ForcePasswordChange(r.Context(), userID)
	if err != nil {
		writeError(w, model.ErrInternal("Failed to force password change"))
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"message": "Password change forced successfully",
	})
}

// RevokeExpiredPublicKey revokes an expired public key
// POST /api/v1/rotation/revoke-key/{user_id}
func (h *RotationHandler) RevokeExpiredPublicKey(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "user_id")
	if userID == "" {
		writeError(w, model.ErrInvalidRequest("User ID is required"))
		return
	}

	err := h.rotationService.RevokeExpiredPublicKey(r.Context(), userID)
	if err != nil {
		writeError(w, model.ErrInternal("Failed to revoke public key"))
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"message": "Public key revoked successfully",
	})
}

// Made with Bob
