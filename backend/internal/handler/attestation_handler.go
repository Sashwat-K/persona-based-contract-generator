package handler

import (
	"io"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/Sashwat-K/persona-based-contract-generator/backend/internal/middleware"
	"github.com/Sashwat-K/persona-based-contract-generator/backend/internal/model"
	"github.com/Sashwat-K/persona-based-contract-generator/backend/internal/service"
)

// AttestationHandler handles attestation evidence upload and verification endpoints.
type AttestationHandler struct {
	attestationService *service.AttestationService
	systemLogService   *service.SystemLogService
}

// NewAttestationHandler creates a new AttestationHandler.
func NewAttestationHandler(attestationService *service.AttestationService, systemLogService *service.SystemLogService) *AttestationHandler {
	return &AttestationHandler{
		attestationService: attestationService,
		systemLogService:   systemLogService,
	}
}

// UploadEvidence handles POST /builds/{id}/attestation/evidence
// Accepts multipart/form-data with records_file and signature_file fields.
func (h *AttestationHandler) UploadEvidence(w http.ResponseWriter, r *http.Request) {
	buildID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, model.ErrInvalidRequest("Invalid build ID."))
		return
	}

	// Parse multipart form (max 10MB total)
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		writeError(w, model.ErrInvalidRequest("Invalid multipart form: "+err.Error()))
		return
	}

	recordsFile, recordsHeader, err := r.FormFile("records_file")
	if err != nil {
		writeError(w, model.ErrInvalidRequest("records_file is required."))
		return
	}
	defer recordsFile.Close()

	signatureFile, signatureHeader, err := r.FormFile("signature_file")
	if err != nil {
		writeError(w, model.ErrInvalidRequest("signature_file is required."))
		return
	}
	defer signatureFile.Close()

	recordsContent, err := io.ReadAll(recordsFile)
	if err != nil {
		writeError(w, model.ErrInvalidRequest("Failed to read records file."))
		return
	}
	signatureContent, err := io.ReadAll(signatureFile)
	if err != nil {
		writeError(w, model.ErrInvalidRequest("Failed to read signature file."))
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

	// Build optional metadata from form fields
	metadata := make(map[string]interface{})
	for key, values := range r.MultipartForm.Value {
		if key == "records_file" || key == "signature_file" {
			continue
		}
		if len(values) == 1 {
			metadata[key] = values[0]
		} else {
			metadata[key] = values
		}
	}

	result, err := h.attestationService.UploadEvidence(r.Context(), service.UploadAttestationEvidenceInput{
		BuildID:              buildID,
		ActorID:              actorID,
		ActorRoles:           actorRoles,
		ActorIP:              ip,
		RequestSignature:     sigPtr,
		RequestSignatureHash: sigHashPtr,
		RecordsFileName:      sanitizeFileName(recordsHeader.Filename),
		RecordsContent:       recordsContent,
		SignatureFileName:    sanitizeFileName(signatureHeader.Filename),
		SignatureContent:     signatureContent,
		Metadata:             metadata,
	})
	if err != nil {
		logSystemEvent(h.systemLogService, r, "unknown", "ATTESTATION_EVIDENCE_UPLOADED", "Build: "+buildID.String(), "FAILED", "Failed to upload attestation evidence: "+err.Error())
		if appErr, ok := err.(*model.AppError); ok {
			writeError(w, appErr)
			return
		}
		writeError(w, model.ErrInternal("Failed to upload attestation evidence."))
		return
	}

	logSystemEvent(h.systemLogService, r, "unknown", "ATTESTATION_EVIDENCE_UPLOADED", "Build: "+buildID.String(), "SUCCESS", "Uploaded attestation evidence")
	writeJSON(w, http.StatusCreated, result)
}

// VerifyEvidence handles POST /builds/{id}/attestation/evidence/{evidence_id}/verify
func (h *AttestationHandler) VerifyEvidence(w http.ResponseWriter, r *http.Request) {
	buildID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, model.ErrInvalidRequest("Invalid build ID."))
		return
	}

	evidenceID, err := uuid.Parse(chi.URLParam(r, "evidence_id"))
	if err != nil {
		writeError(w, model.ErrInvalidRequest("Invalid evidence ID."))
		return
	}

	actorID, _ := middleware.GetUserID(r.Context())
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

	result, err := h.attestationService.VerifyEvidence(r.Context(), service.VerifyAttestationEvidenceInput{
		BuildID:              buildID,
		EvidenceID:           evidenceID,
		ActorID:              actorID,
		ActorIP:              ip,
		RequestSignature:     sigPtr,
		RequestSignatureHash: sigHashPtr,
	})
	if err != nil {
		logSystemEvent(h.systemLogService, r, "unknown", "ATTESTATION_VERIFIED", "Build: "+buildID.String(), "FAILED", "Failed to verify attestation: "+err.Error())
		if appErr, ok := err.(*model.AppError); ok {
			writeError(w, appErr)
			return
		}
		writeError(w, model.ErrInternal("Failed to verify attestation evidence."))
		return
	}

	logSystemEvent(h.systemLogService, r, "unknown", "ATTESTATION_VERIFIED", "Build: "+buildID.String(), "SUCCESS", "Verified attestation evidence: "+string(result.Verdict))
	writeJSON(w, http.StatusOK, result)
}

// GetVerificationStatus handles GET /builds/{id}/attestation/status
func (h *AttestationHandler) GetVerificationStatus(w http.ResponseWriter, r *http.Request) {
	buildID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, model.ErrInvalidRequest("Invalid build ID."))
		return
	}

	status, err := h.attestationService.GetVerificationStatus(r.Context(), buildID)
	if err != nil {
		if appErr, ok := err.(*model.AppError); ok {
			writeError(w, appErr)
			return
		}
		writeError(w, model.ErrInternal("Failed to get attestation status."))
		return
	}

	writeJSON(w, http.StatusOK, status)
}

// sanitizeFileName strips directory paths from uploaded file names.
func sanitizeFileName(name string) string {
	name = strings.ReplaceAll(name, "\\", "/")
	parts := strings.Split(name, "/")
	return parts[len(parts)-1]
}
