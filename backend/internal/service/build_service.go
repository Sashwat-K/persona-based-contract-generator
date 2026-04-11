package service

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"github.com/Sashwat-K/persona-based-contract-generator/backend/internal/model"
	"github.com/Sashwat-K/persona-based-contract-generator/backend/internal/repository"
)

// BuildService handles the core state machine for contract builds.
type BuildService struct {
	queries      repository.Querier
	auditService *AuditService
}

// NewBuildService creates a new BuildService.
func NewBuildService(queries repository.Querier, auditService *AuditService) *BuildService {
	return &BuildService{
		queries:      queries,
		auditService: auditService,
	}
}

// CreateBuild initializes a new build and logs the genesis audit event.
func (s *BuildService) CreateBuild(ctx context.Context, name string, createdBy uuid.UUID, ip string, requestSignature *string, requestSignatureHash *string) (*repository.Build, error) {
	// 1. Create the build
	row, err := s.queries.CreateBuild(ctx, repository.CreateBuildParams{
		Name:      name,
		CreatedBy: createdBy,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create build: %w", err)
	}

	// Convert Row to Build
	build := &repository.Build{
		ID:                    row.ID,
		Name:                  row.Name,
		Status:                row.Status,
		CreatedBy:             row.CreatedBy,
		CreatedAt:             row.CreatedAt,
		FinalizedAt:           row.FinalizedAt,
		ContractHash:          row.ContractHash,
		ContractYaml:          row.ContractYaml,
		IsImmutable:           row.IsImmutable,
		EncryptionCertificate: nil, // Not returned by CreateBuild query
	}

	// 2. Log creation event via AuditService
	eventData := map[string]string{
		"build_id":   build.ID.String(),
		"build_name": name,
	}
	if requestSignatureHash != nil && *requestSignatureHash != "" {
		eventData["request_signature_hash"] = *requestSignatureHash
	}

	_, err = s.auditService.LogEvent(ctx, LogEventInput{
		BuildID:     build.ID,
		EventType:   model.EventBuildCreated,
		ActorUserID: createdBy,
		IpAddress:   ip,
		EventData:   eventData,
		Signature:   requestSignature,
	})
	if err != nil {
		// Log the error but don't fail the build creation entirely
		return build, fmt.Errorf("build created but failed to log audit event: %w", err)
	}

	return build, nil
}

// GetBuild returns a build by its ID.
func (s *BuildService) GetBuild(ctx context.Context, id uuid.UUID) (*repository.Build, error) {
	row, err := s.queries.GetBuildByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get build: %w", err)
	}

	// Convert Row to Build
	build := &repository.Build{
		ID:                    row.ID,
		Name:                  row.Name,
		Status:                row.Status,
		CreatedBy:             row.CreatedBy,
		CreatedAt:             row.CreatedAt,
		FinalizedAt:           row.FinalizedAt,
		ContractHash:          row.ContractHash,
		ContractYaml:          row.ContractYaml,
		IsImmutable:           row.IsImmutable,
		EncryptionCertificate: nil, // Not returned by GetBuildByID query
	}

	return build, nil
}

// ListBuilds returns a paginated list of builds, optionally filtered by status.
func (s *BuildService) ListBuilds(ctx context.Context, limit, offset int32, status string) ([]repository.ListBuildsRow, error) {
	var nullStatus repository.NullBuildStatus
	if status != "" {
		nullStatus = repository.NullBuildStatus{
			BuildStatus: repository.BuildStatus(status),
			Valid:       true,
		}
	}

	builds, err := s.queries.ListBuilds(ctx, repository.ListBuildsParams{
		Limit:  limit,
		Offset: offset,
		Status: nullStatus,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list builds: %w", err)
	}
	return builds, nil
}

// mapStatusToEvent helper matches build status with its corresponding audit event
func mapStatusToEvent(status model.BuildStatus) model.AuditEventType {
	switch status {
	case model.StatusWorkloadSubmitted:
		return model.EventWorkloadSubmitted
	case model.StatusEnvironmentStaged:
		return model.EventEnvironmentStaged
	case model.StatusAuditorKeysRegistered:
		return model.EventAuditorKeysRegistered
	case model.StatusContractAssembled:
		return model.EventContractAssembled
	case model.StatusFinalized:
		return model.EventBuildFinalized
	case model.StatusContractDownloaded:
		return model.EventContractDownloaded
	case model.StatusCancelled:
		return model.EventBuildCancelled
	default:
		return ""
	}
}

func statusEventRequiresRequestSignature(eventType model.AuditEventType) bool {
	switch eventType {
	case model.EventWorkloadSubmitted,
		model.EventEnvironmentStaged,
		model.EventAuditorKeysRegistered,
		model.EventContractAssembled:
		return true
	default:
		return false
	}
}

// TransitionStatus securely advances the build state.
func (s *BuildService) TransitionStatus(
	ctx context.Context,
	buildID uuid.UUID,
	newStatus model.BuildStatus,
	actorID uuid.UUID,
	ip string,
	userRoles []string,
	requestSignature *string,
	requestSignatureHash *string,
) error {
	if newStatus == model.StatusContractDownloaded {
		return model.ErrInvalidRequest("CONTRACT_DOWNLOADED is set by the acknowledge-download endpoint")
	}

	// 1. Get current build
	row, err := s.queries.GetBuildByID(ctx, buildID)
	if err != nil {
		return fmt.Errorf("build not found: %w", err)
	}

	currentStatus := model.BuildStatus(row.Status)

	// 2. Validate transition sequence
	if !currentStatus.CanTransitionTo(newStatus) {
		// Report the true expected next state from the current status when available.
		expected := newStatus.String()
		if next, ok := model.ValidTransitions[currentStatus]; ok {
			expected = next.String()
		}
		return model.ErrInvalidStateTransition(currentStatus.String(), expected)
	}

	// 3. Verify user has the required persona role for this specific transition
	roleRequired, exists := model.RequiredRoleForTransition[newStatus]
	if exists {
		hasRole := false
		for _, r := range userRoles {
			if r == roleRequired.String() {
				hasRole = true
				break
			}
		}
		if !hasRole {
			return model.ErrForbidden(fmt.Sprintf("Transition to %s requires %s role", newStatus, roleRequired))
		}
	}

	// 4. Resolve the event type and validate signature requirements before mutating state.
	eventType := mapStatusToEvent(newStatus)
	if statusEventRequiresRequestSignature(eventType) {
		if requestSignature == nil || *requestSignature == "" {
			return model.ErrInvalidRequest(fmt.Sprintf("request signature is required for status %s", newStatus))
		}
		if requestSignatureHash == nil || *requestSignatureHash == "" {
			return model.ErrInvalidRequest(fmt.Sprintf("request signature hash is required for status %s", newStatus))
		}
	}

	// 5. Update the build status in DB
	err = s.queries.UpdateBuildStatus(ctx, repository.UpdateBuildStatusParams{
		ID:     buildID,
		Status: newStatus.String(),
	})
	if err != nil {
		return fmt.Errorf("failed to update build status: %w", err)
	}

	// 6. Audit log
	if eventType != "" {
		eventData := map[string]string{
			"previous_status": currentStatus.String(),
			"new_status":      newStatus.String(),
		}
		signature := requestSignature
		if statusEventRequiresRequestSignature(eventType) {
			eventData["request_signature_hash"] = *requestSignatureHash
		} else {
			// Do not attach request signatures to events that verify against event_hash.
			signature = nil
		}

		_, err = s.auditService.LogEvent(ctx, LogEventInput{
			BuildID:     buildID,
			EventType:   eventType,
			ActorUserID: actorID,
			IpAddress:   ip,
			EventData:   eventData,
			Signature:   signature,
		})
		if err != nil {
			return fmt.Errorf("status updated but failed to log audit event: %w", err)
		}
	}

	return nil
}

// FinalizeBuild completes the contract build definitively.
func (s *BuildService) FinalizeBuild(ctx context.Context, buildID uuid.UUID, contractHash string, contractYaml string, actorID uuid.UUID, ip string, signature string, pubKey string) error {
	row, err := s.queries.GetBuildByID(ctx, buildID)
	if err != nil {
		return fmt.Errorf("build not found: %w", err)
	}

	currentStatus := model.BuildStatus(row.Status)
	if !currentStatus.CanTransitionTo(model.StatusFinalized) {
		return model.ErrInvalidStateTransition(currentStatus.String(), model.StatusContractAssembled.String())
	}

	// Finalize natively
	err = s.queries.FinalizeBuild(ctx, repository.FinalizeBuildParams{
		ID:           buildID,
		ContractYaml: &contractYaml,
		ContractHash: &contractHash,
	})
	if err != nil {
		return fmt.Errorf("failed to finalize build: %w", err)
	}

	// Audit Log the finalization
	_, err = s.auditService.LogEvent(ctx, LogEventInput{
		BuildID:        buildID,
		EventType:      model.EventBuildFinalized,
		ActorUserID:    actorID,
		ActorPublicKey: &pubKey,
		IpAddress:      ip,
		Signature:      &signature,
		EventData: map[string]string{
			"contract_hash": contractHash,
		},
	})
	if err != nil {
		return fmt.Errorf("build finalized but audit parsing failed: %w", err)
	}

	return nil
}
