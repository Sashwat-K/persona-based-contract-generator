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
func (s *BuildService) CreateBuild(ctx context.Context, name string, createdBy uuid.UUID, ip string) (*repository.Build, error) {
	// 1. Create the build
	build, err := s.queries.CreateBuild(ctx, repository.CreateBuildParams{
		Name:      name,
		CreatedBy: createdBy,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create build: %w", err)
	}

	// 2. Log creation event via AuditService
	_, err = s.auditService.LogEvent(ctx, LogEventInput{
		BuildID:     build.ID,
		EventType:   model.EventBuildCreated,
		ActorUserID: createdBy,
		IpAddress:   ip,
		EventData: map[string]string{
			"build_id":   build.ID.String(),
			"build_name": name,
		},
	})
	if err != nil {
		// Log the error but don't fail the build creation entirely
		return &build, fmt.Errorf("build created but failed to log audit event: %w", err)
	}

	return &build, nil
}

// GetBuild returns a build by its ID.
func (s *BuildService) GetBuild(ctx context.Context, id uuid.UUID) (*repository.Build, error) {
	build, err := s.queries.GetBuildByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get build: %w", err)
	}
	return &build, nil
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
	case model.StatusCancelled:
		return model.EventBuildCancelled
	default:
		return ""
	}
}

// TransitionStatus securely advances the build state.
func (s *BuildService) TransitionStatus(ctx context.Context, buildID uuid.UUID, newStatus model.BuildStatus, actorID uuid.UUID, ip string, userRoles []string) error {
	// 1. Get current build
	build, err := s.queries.GetBuildByID(ctx, buildID)
	if err != nil {
		return fmt.Errorf("build not found: %w", err)
	}

	currentStatus := model.BuildStatus(build.Status)

	// 2. Validate transition sequence
	if !currentStatus.CanTransitionTo(newStatus) {
		return model.ErrInvalidStateTransition(currentStatus.String(), newStatus.String())
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

	// 4. Update the build status in DB
	err = s.queries.UpdateBuildStatus(ctx, repository.UpdateBuildStatusParams{
		ID:     buildID,
		Status: newStatus.String(),
	})
	if err != nil {
		return fmt.Errorf("failed to update build status: %w", err)
	}

	// 5. Audit log
	eventType := mapStatusToEvent(newStatus)
	if eventType != "" {
		_, err = s.auditService.LogEvent(ctx, LogEventInput{
			BuildID:     buildID,
			EventType:   eventType,
			ActorUserID: actorID,
			IpAddress:   ip,
			EventData: map[string]string{
				"previous_status": currentStatus.String(),
				"new_status":      newStatus.String(),
			},
		})
		if err != nil {
			return fmt.Errorf("status updated but failed to log audit event: %w", err)
		}
	}

	return nil
}

// FinalizeBuild completes the contract build definitively.
func (s *BuildService) FinalizeBuild(ctx context.Context, buildID uuid.UUID, contractHash string, contractYaml string, actorID uuid.UUID, ip string, signature string, pubKey string) error {
	build, err := s.queries.GetBuildByID(ctx, buildID)
	if err != nil {
		return fmt.Errorf("build not found: %w", err)
	}

	currentStatus := model.BuildStatus(build.Status)
	if !currentStatus.CanTransitionTo(model.StatusFinalized) {
		return model.ErrInvalidStateTransition(currentStatus.String(), model.StatusFinalized.String())
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
