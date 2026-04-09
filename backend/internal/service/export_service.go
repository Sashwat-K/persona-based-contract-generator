package service

import (
	"context"
	"encoding/base64"
	"fmt"

	"github.com/google/uuid"

	"github.com/Sashwat-K/persona-based-contract-generator/backend/internal/crypto"
	"github.com/Sashwat-K/persona-based-contract-generator/backend/internal/model"
	"github.com/Sashwat-K/persona-based-contract-generator/backend/internal/repository"
)

// ExportService handles contract export and download operations.
type ExportService struct {
	queries           repository.Querier
	auditService      *AuditService
	assignmentService *AssignmentService
}

// NewExportService creates a new ExportService.
func NewExportService(queries repository.Querier, auditService *AuditService, assignmentService *AssignmentService) *ExportService {
	return &ExportService{
		queries:           queries,
		auditService:      auditService,
		assignmentService: assignmentService,
	}
}

// ExportContractOutput contains the exported contract data.
type ExportContractOutput struct {
	ContractYAML string `json:"contract_yaml"` // base64-encoded
	ContractHash string `json:"contract_hash"`
	BuildID      string `json:"build_id"`
	BuildName    string `json:"build_name"`
	FinalizedAt  string `json:"finalized_at"`
}

// ExportContract returns the finalized contract for download.
// Only AUDITOR and ENV_OPERATOR roles can export.
func (s *ExportService) ExportContract(ctx context.Context, buildID, userID uuid.UUID) (*ExportContractOutput, error) {
	// 1. Get build
	build, err := s.queries.GetBuildByID(ctx, buildID)
	if err != nil {
		return nil, model.ErrBuildNotFound(buildID.String())
	}

	// 2. Verify build is finalized
	if model.BuildStatus(build.Status) != model.StatusFinalized {
		return nil, model.ErrInvalidRequest("build must be finalized before export")
	}

	// 3. Verify contract exists
	if build.ContractYaml == nil || build.ContractHash == nil {
		return nil, model.ErrInvalidRequest("contract not available")
	}

	// 4. Verify user is assigned as AUDITOR or ENV_OPERATOR
	isAuditor, err := s.assignmentService.CheckUserAssignment(ctx, buildID, userID, "AUDITOR")
	if err != nil {
		return nil, fmt.Errorf("failed to check auditor assignment: %w", err)
	}

	isEnvOp, err := s.assignmentService.CheckUserAssignment(ctx, buildID, userID, "ENV_OPERATOR")
	if err != nil {
		return nil, fmt.Errorf("failed to check env operator assignment: %w", err)
	}

	if !isAuditor && !isEnvOp {
		return nil, model.ErrForbidden("only assigned AUDITOR or ENV_OPERATOR can export contract")
	}

	// 5. Return contract data
	return &ExportContractOutput{
		ContractYAML: *build.ContractYaml,
		ContractHash: *build.ContractHash,
		BuildID:      buildID.String(),
		BuildName:    build.Name,
		FinalizedAt:  build.FinalizedAt.Time.Format("2006-01-02T15:04:05Z07:00"),
	}, nil
}

// AcknowledgeDownloadInput contains data for download acknowledgment.
type AcknowledgeDownloadInput struct {
	BuildID        uuid.UUID
	UserID         uuid.UUID
	ContractHash   string
	Signature      string // RSA-PSS signature of contract_hash
	IPAddress      string
	ActorPublicKey string // User's registered public key
}

// AcknowledgeDownload records that ENV_OPERATOR downloaded and verified the contract.
// This creates cryptographic proof-of-receipt in the audit chain.
func (s *ExportService) AcknowledgeDownload(ctx context.Context, input AcknowledgeDownloadInput) error {
	// 1. Get build
	build, err := s.queries.GetBuildByID(ctx, input.BuildID)
	if err != nil {
		return model.ErrBuildNotFound(input.BuildID.String())
	}

	// 2. Verify build is finalized
	if model.BuildStatus(build.Status) != model.StatusFinalized {
		return model.ErrInvalidRequest("build must be finalized")
	}

	// 3. Verify contract hash matches
	if build.ContractHash == nil || *build.ContractHash != input.ContractHash {
		return model.ErrHashMismatch(*build.ContractHash, input.ContractHash)
	}

	// 4. Verify user is assigned as ENV_OPERATOR
	isEnvOp, err := s.assignmentService.CheckUserAssignment(ctx, input.BuildID, input.UserID, "ENV_OPERATOR")
	if err != nil {
		return fmt.Errorf("failed to check env operator assignment: %w", err)
	}
	if !isEnvOp {
		return model.ErrForbidden("only assigned ENV_OPERATOR can acknowledge download")
	}

	// 5. Get user's registered public key
	user, err := s.queries.GetUserByID(ctx, input.UserID)
	if err != nil {
		return model.ErrUserNotFound(input.UserID.String())
	}
	if user.PublicKey == nil {
		return model.ErrInvalidRequest("user must have a registered public key")
	}

	// 6. Verify signature against registered public key
	err = crypto.VerifySignature(*user.PublicKey, input.ContractHash, input.Signature)
	if err != nil {
		return model.ErrInvalidSignature()
	}

	// 7. Compute public key fingerprint
	fingerprint, err := crypto.ComputePublicKeyFingerprint(*user.PublicKey)
	if err != nil {
		return fmt.Errorf("failed to compute key fingerprint: %w", err)
	}

	// 8. Log download acknowledgment to audit trail
	_, err = s.auditService.LogEvent(ctx, LogEventInput{
		BuildID:        input.BuildID,
		EventType:      model.EventContractDownloaded,
		ActorUserID:    input.UserID,
		ActorPublicKey: user.PublicKey,
		IpAddress:      input.IPAddress,
		Signature:      &input.Signature,
		EventData: map[string]string{
			"contract_hash":         input.ContractHash,
			"actor_key_fingerprint": fingerprint,
		},
	})
	if err != nil {
		return fmt.Errorf("failed to log download acknowledgment: %w", err)
	}

	return nil
}

// GetUserDataOutput contains the contract in raw YAML format for deployment.
type GetUserDataOutput struct {
	ContractYAML string `json:"contract_yaml"` // Raw YAML (decoded from base64)
	ContractHash string `json:"contract_hash"`
	BuildID      string `json:"build_id"`
}

// GetUserData returns the decoded contract YAML for ENV_OPERATOR deployment.
// This is the final step before deploying to HPCR instances.
func (s *ExportService) GetUserData(ctx context.Context, buildID, userID uuid.UUID) (*GetUserDataOutput, error) {
	// 1. Get build
	build, err := s.queries.GetBuildByID(ctx, buildID)
	if err != nil {
		return nil, model.ErrBuildNotFound(buildID.String())
	}

	// 2. Verify build is finalized
	if model.BuildStatus(build.Status) != model.StatusFinalized {
		return nil, model.ErrInvalidRequest("build must be finalized")
	}

	// 3. Verify contract exists
	if build.ContractYaml == nil || build.ContractHash == nil {
		return nil, model.ErrInvalidRequest("contract not available")
	}

	// 4. Verify user is assigned as ENV_OPERATOR
	isEnvOp, err := s.assignmentService.CheckUserAssignment(ctx, buildID, userID, "ENV_OPERATOR")
	if err != nil {
		return nil, fmt.Errorf("failed to check env operator assignment: %w", err)
	}
	if !isEnvOp {
		return nil, model.ErrForbidden("only assigned ENV_OPERATOR can get userdata")
	}

	// 5. Decode base64 contract YAML
	decodedYAML, err := base64.StdEncoding.DecodeString(*build.ContractYaml)
	if err != nil {
		return nil, fmt.Errorf("failed to decode contract YAML: %w", err)
	}

	// 6. Return decoded YAML
	return &GetUserDataOutput{
		ContractYAML: string(decodedYAML),
		ContractHash: *build.ContractHash,
		BuildID:      buildID.String(),
	}, nil
}
