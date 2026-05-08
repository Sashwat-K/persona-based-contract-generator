package handler

import (
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/Sashwat-K/persona-based-contract-generator/backend/internal/middleware"
	"github.com/Sashwat-K/persona-based-contract-generator/backend/internal/model"
	"github.com/Sashwat-K/persona-based-contract-generator/backend/internal/service"
)

// ContractV2Handler handles backend-native contract operations (v2 endpoints).
type ContractV2Handler struct {
	contractService  *service.ContractService
	systemLogService *service.SystemLogService
}

// NewContractV2Handler creates a new ContractV2Handler.
func NewContractV2Handler(contractService *service.ContractService, systemLogService *service.SystemLogService) *ContractV2Handler {
	return &ContractV2Handler{
		contractService:  contractService,
		systemLogService: systemLogService,
	}
}

type submitWorkloadV2Request struct {
	Plaintext      string `json:"plaintext"`
	CertificatePEM string `json:"certificate_pem"`
}

type contractTemplateRequest struct {
	Type string `json:"type"`
}

// GetContractTemplate handles POST /v2/contract-template.
// Contract templates are common and not tied to any specific build.
func (h *ContractV2Handler) GetContractTemplate(w http.ResponseWriter, r *http.Request) {
	var req contractTemplateRequest
	if err := readJSON(r, &req); err != nil {
		writeError(w, model.ErrInvalidRequest(err.Error()))
		return
	}
	templateType := strings.TrimSpace(req.Type)
	resolvedType, content, err := h.contractService.GetContractTemplate(r.Context(), templateType)
	if err != nil {
		if appErr, ok := err.(*model.AppError); ok {
			writeError(w, appErr)
			return
		}
		writeError(w, model.ErrInternal("Failed to load contract template."))
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"template_type": resolvedType,
		"content":       content,
	})
}

// SubmitWorkload handles POST /builds/{id}/v2/sections/workload
func (h *ContractV2Handler) SubmitWorkload(w http.ResponseWriter, r *http.Request) {
	buildID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, model.ErrInvalidRequest("Invalid build ID."))
		return
	}

	var req submitWorkloadV2Request
	if err := readJSONLarge(r, &req, 50<<20); err != nil {
		writeError(w, model.ErrInvalidRequest(err.Error()))
		return
	}

	actorID, _ := middleware.GetUserID(r.Context())
	actorRoles := middleware.GetUserRoles(r.Context())
	ip := requestIP(r)
	sig := middleware.GetRequestSignature(r.Context())
	sigHash := middleware.GetRequestSignatureHash(r.Context())
	var sigPtr, sigHashPtr *string
	if sig != "" {
		sigPtr = &sig
	}
	if sigHash != "" {
		sigHashPtr = &sigHash
	}

	section, err := h.contractService.SubmitWorkloadSection(r.Context(), service.SubmitSectionV2Input{
		BuildID:              buildID,
		ActorID:              actorID,
		ActorRoles:           actorRoles,
		ActorIP:              ip,
		RequestSignature:     sigPtr,
		RequestSignatureHash: sigHashPtr,
		Plaintext:            req.Plaintext,
		CertificatePEM:       req.CertificatePEM,
	})
	if err != nil {
		logSystemEvent(h.systemLogService, r, "unknown", "V2_WORKLOAD_SUBMITTED", "Build: "+buildID.String(), "FAILED", "Failed to submit workload (v2): "+err.Error())
		if appErr, ok := err.(*model.AppError); ok {
			writeError(w, appErr)
			return
		}
		writeError(w, model.ErrInternal("Failed to submit workload section."))
		return
	}

	logSystemEvent(h.systemLogService, r, "unknown", "V2_WORKLOAD_SUBMITTED", "Build: "+buildID.String(), "SUCCESS", "Submitted workload section (v2)")
	writeJSON(w, http.StatusCreated, section)
}

type submitEnvironmentV2Request struct {
	Plaintext      string `json:"plaintext"`
	CertificatePEM string `json:"certificate_pem"`
}

// SubmitEnvironment handles POST /builds/{id}/v2/sections/environment
func (h *ContractV2Handler) SubmitEnvironment(w http.ResponseWriter, r *http.Request) {
	buildID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, model.ErrInvalidRequest("Invalid build ID."))
		return
	}

	var req submitEnvironmentV2Request
	if err := readJSONLarge(r, &req, 50<<20); err != nil {
		writeError(w, model.ErrInvalidRequest(err.Error()))
		return
	}

	actorID, _ := middleware.GetUserID(r.Context())
	actorRoles := middleware.GetUserRoles(r.Context())
	ip := requestIP(r)
	sig := middleware.GetRequestSignature(r.Context())
	sigHash := middleware.GetRequestSignatureHash(r.Context())
	var sigPtr, sigHashPtr *string
	if sig != "" {
		sigPtr = &sig
	}
	if sigHash != "" {
		sigHashPtr = &sigHash
	}

	section, err := h.contractService.SubmitEnvironmentSection(r.Context(), service.SubmitSectionV2Input{
		BuildID:              buildID,
		ActorID:              actorID,
		ActorRoles:           actorRoles,
		ActorIP:              ip,
		RequestSignature:     sigPtr,
		RequestSignatureHash: sigHashPtr,
		Plaintext:            req.Plaintext,
		CertificatePEM:       req.CertificatePEM,
	})
	if err != nil {
		logSystemEvent(h.systemLogService, r, "unknown", "V2_ENVIRONMENT_SUBMITTED", "Build: "+buildID.String(), "FAILED", "Failed to submit environment (v2): "+err.Error())
		if appErr, ok := err.(*model.AppError); ok {
			writeError(w, appErr)
			return
		}
		writeError(w, model.ErrInternal("Failed to submit environment section."))
		return
	}

	logSystemEvent(h.systemLogService, r, "unknown", "V2_ENVIRONMENT_SUBMITTED", "Build: "+buildID.String(), "SUCCESS", "Submitted environment section (v2)")
	writeJSON(w, http.StatusCreated, section)
}

type finalizeContractV2Request struct {
	SigningKeyPassphrase string `json:"signing_key_passphrase"`
}

// FinalizeContract handles POST /builds/{id}/v2/finalize
func (h *ContractV2Handler) FinalizeContract(w http.ResponseWriter, r *http.Request) {
	buildID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, model.ErrInvalidRequest("Invalid build ID."))
		return
	}

	var req finalizeContractV2Request
	if err := readJSON(r, &req); err != nil {
		writeError(w, model.ErrInvalidRequest(err.Error()))
		return
	}

	actorID, _ := middleware.GetUserID(r.Context())
	actorRoles := middleware.GetUserRoles(r.Context())
	ip := requestIP(r)
	sig := middleware.GetRequestSignature(r.Context())
	sigHash := middleware.GetRequestSignatureHash(r.Context())
	var sigPtr, sigHashPtr *string
	if sig != "" {
		sigPtr = &sig
	}
	if sigHash != "" {
		sigHashPtr = &sigHash
	}

	result, err := h.contractService.FinalizeContract(r.Context(), service.FinalizeContractV2Input{
		BuildID:              buildID,
		ActorID:              actorID,
		ActorRoles:           actorRoles,
		ActorIP:              ip,
		RequestSignature:     sigPtr,
		RequestSignatureHash: sigHashPtr,
		SigningKeyPassphrase: req.SigningKeyPassphrase,
	})
	if err != nil {
		logSystemEvent(h.systemLogService, r, "unknown", "V2_CONTRACT_FINALIZED", "Build: "+buildID.String(), "FAILED", "Failed to finalize contract (v2): "+err.Error())
		if appErr, ok := err.(*model.AppError); ok {
			writeError(w, appErr)
			return
		}
		// Include actual error message for debugging
		writeError(w, model.ErrInternal("Failed to finalize contract: "+err.Error()))
		return
	}

	logSystemEvent(h.systemLogService, r, "unknown", "V2_CONTRACT_FINALIZED", "Build: "+buildID.String(), "SUCCESS", "Finalized contract (v2)")
	writeJSON(w, http.StatusOK, result)
}
