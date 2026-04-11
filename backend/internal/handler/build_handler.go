package handler

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/Sashwat-K/persona-based-contract-generator/backend/internal/middleware"
	"github.com/Sashwat-K/persona-based-contract-generator/backend/internal/model"
	"github.com/Sashwat-K/persona-based-contract-generator/backend/internal/service"
)

// BuildHandler handles build management endpoints.
type BuildHandler struct {
	buildService     *service.BuildService
	systemLogService *service.SystemLogService
}

// NewBuildHandler creates a new BuildHandler.
func NewBuildHandler(buildService *service.BuildService, systemLogService *service.SystemLogService) *BuildHandler {
	return &BuildHandler{
		buildService:     buildService,
		systemLogService: systemLogService,
	}
}

// createBuildRequest is the JSON request body for POST /builds.
type createBuildRequest struct {
	Name string `json:"name"`
}

// CreateBuild handles POST /builds.
func (h *BuildHandler) CreateBuild(w http.ResponseWriter, r *http.Request) {
	var req createBuildRequest
	if err := readJSON(r, &req); err != nil {
		writeError(w, model.ErrInvalidRequest(err.Error()))
		return
	}

	if req.Name == "" {
		writeError(w, model.ErrInvalidRequest("Build name is required."))
		return
	}

	actorID, ok := middleware.GetUserID(r.Context())
	if !ok {
		writeError(w, model.ErrUnauthorized())
		return
	}
	requestSignature := middleware.GetRequestSignature(r.Context())
	requestSignatureHash := middleware.GetRequestSignatureHash(r.Context())

	ip := requestIP(r)

	var sigPtr *string
	var sigHashPtr *string
	if requestSignature != "" {
		sigPtr = &requestSignature
	}
	if requestSignatureHash != "" {
		sigHashPtr = &requestSignatureHash
	}

	build, err := h.buildService.CreateBuild(r.Context(), req.Name, actorID, ip, sigPtr, sigHashPtr)
	if err != nil {
		logSystemEvent(
			h.systemLogService,
			r,
			"unknown",
			"BUILD_CREATED",
			"Build Management",
			"FAILED",
			"Failed to create build: "+err.Error(),
		)
		writeError(w, model.ErrInternal("Failed to create build."))
		return
	}

	logSystemEvent(
		h.systemLogService,
		r,
		"unknown",
		"BUILD_CREATED",
		"Build: "+build.ID.String(),
		"SUCCESS",
		"Created build "+build.Name,
	)

	writeJSON(w, http.StatusCreated, build)
}

// GetBuild handles GET /builds/{id}.
func (h *BuildHandler) GetBuild(w http.ResponseWriter, r *http.Request) {
	buildID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, model.ErrInvalidRequest("Invalid build ID."))
		return
	}

	build, err := h.buildService.GetBuild(r.Context(), buildID)
	if err != nil {
		writeError(w, model.ErrBuildNotFound(buildID.String()))
		return
	}

	writeJSON(w, http.StatusOK, build)
}

// ListBuilds handles GET /builds.
func (h *BuildHandler) ListBuilds(w http.ResponseWriter, r *http.Request) {
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")
	status := r.URL.Query().Get("status")

	limit := int32(50) // default
	if limitStr != "" {
		if l, err := strconv.ParseInt(limitStr, 10, 32); err == nil && l > 0 && l <= 100 {
			limit = int32(l)
		}
	}

	offset := int32(0) // default
	if offsetStr != "" {
		if o, err := strconv.ParseInt(offsetStr, 10, 32); err == nil && o >= 0 {
			offset = int32(o)
		}
	}

	builds, err := h.buildService.ListBuilds(r.Context(), limit, offset, status)
	if err != nil {
		writeError(w, model.ErrInternal("Failed to list builds."))
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"builds": builds,
		"limit":  limit,
		"offset": offset,
	})
}

// transitionStatusRequest is the JSON request body for PATCH /builds/{id}/status.
type transitionStatusRequest struct {
	Status string `json:"status"`
}

// TransitionStatus handles PATCH /builds/{id}/status.
func (h *BuildHandler) TransitionStatus(w http.ResponseWriter, r *http.Request) {
	buildID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, model.ErrInvalidRequest("Invalid build ID."))
		return
	}

	var req transitionStatusRequest
	if err := readJSON(r, &req); err != nil {
		writeError(w, model.ErrInvalidRequest(err.Error()))
		return
	}

	newStatus := model.BuildStatus(req.Status)
	actorID, _ := middleware.GetUserID(r.Context())
	roles := middleware.GetUserRoles(r.Context())
	ip := requestIP(r)
	requestSignature := middleware.GetRequestSignature(r.Context())
	requestSignatureHash := middleware.GetRequestSignatureHash(r.Context())
	var sigPtr *string
	var sigHashPtr *string
	if requestSignature != "" {
		sigPtr = &requestSignature
	}
	if requestSignatureHash != "" {
		sigHashPtr = &requestSignatureHash
	}

	err = h.buildService.TransitionStatus(r.Context(), buildID, newStatus, actorID, ip, roles, sigPtr, sigHashPtr)
	if err != nil {
		logSystemEvent(
			h.systemLogService,
			r,
			"unknown",
			"BUILD_STATUS_CHANGED",
			"Build: "+buildID.String(),
			"FAILED",
			"Failed transition to "+req.Status+": "+err.Error(),
		)
		if appErr, ok := err.(*model.AppError); ok {
			writeError(w, appErr)
			return
		}
		writeError(w, model.ErrInternal("Failed to transition status."))
		return
	}

	logSystemEvent(
		h.systemLogService,
		r,
		"unknown",
		"BUILD_STATUS_CHANGED",
		"Build: "+buildID.String(),
		"SUCCESS",
		"Transitioned build to "+req.Status,
	)

	writeJSON(w, http.StatusOK, map[string]string{"status": req.Status})
}

// finalizeBuildRequest is the JSON request body for POST /builds/{id}/finalize.
type finalizeBuildRequest struct {
	ContractHash string `json:"contract_hash"`
	ContractYaml string `json:"contract_yaml"`
	Signature    string `json:"signature"`
	PublicKey    string `json:"public_key"`
}

// FinalizeBuild handles POST /builds/{id}/finalize.
func (h *BuildHandler) FinalizeBuild(w http.ResponseWriter, r *http.Request) {
	buildID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, model.ErrInvalidRequest("Invalid build ID."))
		return
	}

	var req finalizeBuildRequest
	if err := readJSON(r, &req); err != nil {
		writeError(w, model.ErrInvalidRequest(err.Error()))
		return
	}

	actorID, _ := middleware.GetUserID(r.Context())
	ip := requestIP(r)

	err = h.buildService.FinalizeBuild(r.Context(), buildID, req.ContractHash, req.ContractYaml, actorID, ip, req.Signature, req.PublicKey)
	if err != nil {
		logSystemEvent(
			h.systemLogService,
			r,
			"unknown",
			"BUILD_FINALIZED",
			"Build: "+buildID.String(),
			"FAILED",
			"Failed to finalize build: "+err.Error(),
		)
		if appErr, ok := err.(*model.AppError); ok {
			writeError(w, appErr)
			return
		}
		writeError(w, model.ErrInternal("Failed to finalize build."))
		return
	}

	logSystemEvent(
		h.systemLogService,
		r,
		"unknown",
		"BUILD_FINALIZED",
		"Build: "+buildID.String(),
		"SUCCESS",
		"Finalized build",
	)

	writeJSON(w, http.StatusOK, map[string]string{"status": "FINALIZED"})
}

// RegisterAttestation handles POST /builds/{id}/attestation.
// Called by the AUDITOR to confirm attestation keys are generated locally.
// Transitions build from ENVIRONMENT_STAGED -> AUDITOR_KEYS_REGISTERED.
func (h *BuildHandler) RegisterAttestation(w http.ResponseWriter, r *http.Request) {
	buildID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, model.ErrInvalidRequest("Invalid build ID."))
		return
	}

	actorID, _ := middleware.GetUserID(r.Context())
	roles := middleware.GetUserRoles(r.Context())
	ip := requestIP(r)
	requestSignature := middleware.GetRequestSignature(r.Context())
	requestSignatureHash := middleware.GetRequestSignatureHash(r.Context())
	var sigPtr *string
	var sigHashPtr *string
	if requestSignature != "" {
		sigPtr = &requestSignature
	}
	if requestSignatureHash != "" {
		sigHashPtr = &requestSignatureHash
	}

	// Idempotent behavior:
	// If attestation is already registered (or build already progressed beyond it),
	// return success instead of failing transition validation.
	build, err := h.buildService.GetBuild(r.Context(), buildID)
	if err == nil {
		current := model.BuildStatus(build.Status)
		if current == model.StatusAuditorKeysRegistered ||
			current == model.StatusContractAssembled ||
			current == model.StatusFinalized ||
			current == model.StatusContractDownloaded {
			logSystemEvent(
				h.systemLogService,
				r,
				"unknown",
				"AUDITOR_KEYS_REGISTERED",
				"Build: "+buildID.String(),
				"SUCCESS",
				"Attestation already registered; request treated as idempotent",
			)
			writeJSON(w, http.StatusOK, map[string]interface{}{
				"status":             current.String(),
				"already_registered": true,
			})
			return
		}
	}

	err = h.buildService.TransitionStatus(
		r.Context(),
		buildID,
		model.StatusAuditorKeysRegistered,
		actorID,
		ip,
		roles,
		sigPtr,
		sigHashPtr,
	)
	if err != nil {
		logSystemEvent(
			h.systemLogService,
			r,
			"unknown",
			"AUDITOR_KEYS_REGISTERED",
			"Build: "+buildID.String(),
			"FAILED",
			"Failed to register attestation: "+err.Error(),
		)
		if appErr, ok := err.(*model.AppError); ok {
			writeError(w, appErr)
			return
		}
		writeError(w, model.ErrInternal("Failed to register attestation."))
		return
	}

	logSystemEvent(
		h.systemLogService,
		r,
		"unknown",
		"AUDITOR_KEYS_REGISTERED",
		"Build: "+buildID.String(),
		"SUCCESS",
		"Registered attestation / auditor keys",
	)

	writeJSON(w, http.StatusOK, map[string]string{"status": "AUDITOR_KEYS_REGISTERED"})
}

// CancelBuild handles POST /builds/{id}/cancel. ADMIN only.
func (h *BuildHandler) CancelBuild(w http.ResponseWriter, r *http.Request) {
	buildID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, model.ErrInvalidRequest("Invalid build ID."))
		return
	}

	actorID, _ := middleware.GetUserID(r.Context())
	roles := middleware.GetUserRoles(r.Context())
	ip := requestIP(r)

	// Transition to Cancelled
	err = h.buildService.TransitionStatus(r.Context(), buildID, model.StatusCancelled, actorID, ip, roles, nil, nil)
	if err != nil {
		logSystemEvent(
			h.systemLogService,
			r,
			"unknown",
			"BUILD_CANCELLED",
			"Build: "+buildID.String(),
			"FAILED",
			"Failed to cancel build: "+err.Error(),
		)
		if appErr, ok := err.(*model.AppError); ok {
			writeError(w, appErr)
			return
		}
		writeError(w, model.ErrInternal("Failed to cancel build."))
		return
	}

	logSystemEvent(
		h.systemLogService,
		r,
		"unknown",
		"BUILD_CANCELLED",
		"Build: "+buildID.String(),
		"SUCCESS",
		"Cancelled build",
	)

	writeJSON(w, http.StatusOK, map[string]string{"status": "CANCELLED"})
}
