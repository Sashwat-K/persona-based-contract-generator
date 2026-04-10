package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/Sashwat-K/persona-based-contract-generator/backend/internal/middleware"
	"github.com/Sashwat-K/persona-based-contract-generator/backend/internal/model"
	"github.com/Sashwat-K/persona-based-contract-generator/backend/internal/service"
)

// SectionHandler handles build section management endpoints.
type SectionHandler struct {
	sectionService *service.SectionService
}

// NewSectionHandler creates a new SectionHandler.
func NewSectionHandler(sectionService *service.SectionService) *SectionHandler {
	return &SectionHandler{sectionService: sectionService}
}

// submitSectionRequest is the JSON request body for POST /builds/{id}/sections.
type submitSectionRequest struct {
	RoleID                *uuid.UUID `json:"role_id,omitempty"`
	PersonaRole           string     `json:"persona_role,omitempty"`
	EncryptedPayload      string     `json:"encrypted_payload"`
	EncryptedSymmetricKey *string    `json:"encrypted_symmetric_key,omitempty"`
	SectionHash           string     `json:"section_hash"`
	Signature             string     `json:"signature"`
}

// SubmitSection handles POST /builds/{id}/sections.
func (h *SectionHandler) SubmitSection(w http.ResponseWriter, r *http.Request) {
	buildID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, model.ErrInvalidRequest("Invalid build ID."))
		return
	}

	var req submitSectionRequest
	// Section payloads could be larger, especially workloads. Limit to 50MB.
	if err := readJSONLarge(r, &req, 50*1024*1024); err != nil {
		writeError(w, model.ErrInvalidRequest(err.Error()))
		return
	}

	actorID, ok := middleware.GetUserID(r.Context())
	if !ok {
		writeError(w, model.ErrUnauthorized())
		return
	}

	if req.RoleID == nil && req.PersonaRole == "" {
		writeError(w, model.ErrInvalidRequest("role_id is required"))
		return
	}

	role := model.PersonaRole(req.PersonaRole)
	section, err := h.sectionService.SubmitSection(r.Context(), service.SubmitSectionInput{
		BuildID:               buildID,
		RoleID:                req.RoleID,
		PersonaRole:           role,
		SubmittedBy:           actorID,
		EncryptedPayload:      req.EncryptedPayload,
		EncryptedSymmetricKey: req.EncryptedSymmetricKey,
		SectionHash:           req.SectionHash,
		Signature:             req.Signature,
		ActorRoles:            middleware.GetUserRoles(r.Context()),
		ActorIP:               r.RemoteAddr,
	})
	if err != nil {
		writeError(w, model.ErrInternal(err.Error()))
		return
	}

	writeJSON(w, http.StatusCreated, section)
}

// GetSections handles GET /builds/{id}/sections.
func (h *SectionHandler) GetSections(w http.ResponseWriter, r *http.Request) {
	buildID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, model.ErrInvalidRequest("Invalid build ID."))
		return
	}

	sections, err := h.sectionService.GetSections(r.Context(), buildID)
	if err != nil {
		writeError(w, model.ErrInternal("Failed to get sections."))
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"sections": sections})
}
