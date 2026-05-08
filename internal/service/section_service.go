package service

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/Sashwat-K/persona-based-contract-generator/backend/internal/model"
	"github.com/Sashwat-K/persona-based-contract-generator/backend/internal/repository"
)

// SectionService handles the zero-knowledge storage of encrypted contract payloads.
type SectionService struct {
	queries           repository.Querier
	assignmentService *AssignmentService
	buildService      *BuildService
}

// NewSectionService creates a new SectionService.
func NewSectionService(queries repository.Querier, assignmentService *AssignmentService, buildService *BuildService) *SectionService {
	return &SectionService{
		queries:           queries,
		assignmentService: assignmentService,
		buildService:      buildService,
	}
}

// roleToNextStatus maps each persona role to the build status that should be set after they submit.
var roleToNextStatus = map[model.PersonaRole]model.BuildStatus{
	model.RoleSolutionProvider: model.StatusWorkloadSubmitted,
	model.RoleDataOwner:        model.StatusEnvironmentStaged,
}

// SubmitSectionInput contains the data for a new build section.
type SubmitSectionInput struct {
	BuildID               uuid.UUID
	RoleID                *uuid.UUID
	PersonaRole           model.PersonaRole // Backward-compatible fallback when role_id is absent
	SubmittedBy           uuid.UUID
	EncryptedPayload      string
	EncryptedSymmetricKey *string
	SectionHash           string
	Signature             string
	// For auto-transitioning build status after submission
	ActorRoles           []string
	ActorIP              string
	RequestSignature     *string
	RequestSignatureHash *string
}

// requiredBuildStatusForRole maps each submitting role to the build status that must be current (v2 workflow).
var requiredBuildStatusForRole = map[model.PersonaRole]model.BuildStatus{
	model.RoleSolutionProvider: model.StatusSigningKeyRegistered,
	model.RoleDataOwner:        model.StatusWorkloadSubmitted,
	model.RoleAuditor:          model.StatusEnvironmentStaged,
}

// SubmitSection stores an encrypted payload for a specific persona role.
// The backend does not decrypt or validate the payload natively (Zero-Knowledge).
func (s *SectionService) SubmitSection(ctx context.Context, input SubmitSectionInput) (*repository.BuildSection, error) {
	// Resolve role from role_id (preferred) or persona role (fallback).
	roleName := input.PersonaRole.String()
	var roleID uuid.UUID
	if input.RoleID != nil && *input.RoleID != uuid.Nil {
		role, err := s.queries.GetRoleByID(ctx, *input.RoleID)
		if err != nil {
			return nil, model.ErrInvalidRequest("invalid role_id")
		}
		roleName = role.Name
		roleID = role.ID
	} else {
		role, err := s.queries.GetRoleByName(ctx, roleName)
		if err != nil {
			return nil, model.ErrInvalidRequest("invalid persona_role")
		}
		roleID = role.ID
	}
	resolvedRole := model.PersonaRole(roleName)
	if !resolvedRole.IsValid() {
		return nil, model.ErrInvalidRequest("invalid role")
	}

	// 1. Validate user is assigned to this role for this build (two-layer access control)
	err := s.assignmentService.ValidateAssignmentForSubmission(ctx, input.BuildID, input.SubmittedBy, roleName)
	if err != nil {
		return nil, err // Returns AppError with proper status code
	}

	// 2. Validate build is in the required state for this role's submission
	if requiredStatus, ok := requiredBuildStatusForRole[resolvedRole]; ok {
		build, err := s.queries.GetBuildByID(ctx, input.BuildID)
		if err != nil {
			return nil, fmt.Errorf("failed to get build: %w", err)
		}
		currentStatus := model.BuildStatus(build.Status)
		if currentStatus != requiredStatus {
			return nil, model.ErrInvalidStateTransition(currentStatus.String(), requiredStatus.String())
		}
	}

	// 3. DATA_OWNER wrapped symmetric key is optional in backend-native crypto flow.
	// Legacy clients may still provide it; new flow does not require it.

	// 4. Verify a section for this role doesn't already exist for this build
	_, err = s.queries.GetBuildSectionByRole(ctx, repository.GetBuildSectionByRoleParams{
		BuildID:     input.BuildID,
		PersonaRole: roleName,
	})
	if err == nil {
		// No error means a row was found
		return nil, model.ErrDuplicateSection(roleName)
	}
	if !strings.Contains(err.Error(), "no rows in result set") {
		return nil, fmt.Errorf("failed to check existing sections: %w", err)
	}

	// 5. Insert the section
	section, err := s.queries.CreateBuildSection(ctx, repository.CreateBuildSectionParams{
		BuildID:             input.BuildID,
		PersonaRole:         roleName,
		RoleID:              pgtype.UUID{Bytes: roleID, Valid: true},
		SubmittedBy:         input.SubmittedBy,
		EncryptedPayload:    input.EncryptedPayload,
		WrappedSymmetricKey: input.EncryptedSymmetricKey,
		SectionHash:         input.SectionHash,
		Signature:           input.Signature,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to submit build section: %w", err)
	}

	// Convert the Row type to BuildSection type
	result := repository.BuildSection{
		ID:                  section.ID,
		BuildID:             section.BuildID,
		PersonaRole:         section.PersonaRole,
		RoleID:              section.RoleID,
		SubmittedBy:         section.SubmittedBy,
		EncryptedPayload:    section.EncryptedPayload,
		WrappedSymmetricKey: section.WrappedSymmetricKey,
		SectionHash:         section.SectionHash,
		Signature:           section.Signature,
		SubmittedAt:         section.SubmittedAt,
	}

	// 6. Auto-transition build status based on the submitting role
	if nextStatus, ok := roleToNextStatus[resolvedRole]; ok {
		if transErr := s.buildService.TransitionStatus(
			ctx,
			input.BuildID,
			nextStatus,
			input.SubmittedBy,
			input.ActorIP,
			input.ActorRoles,
			input.RequestSignature,
			input.RequestSignatureHash,
		); transErr != nil {
			return nil, fmt.Errorf("section stored but status transition to %s failed: %w", nextStatus, transErr)
		}
	}

	return &result, nil
}

// GetSections returns all submitted sections for a build.
func (s *SectionService) GetSections(ctx context.Context, buildID uuid.UUID) ([]repository.BuildSection, error) {
	rows, err := s.queries.GetBuildSectionsByBuildID(ctx, buildID)
	if err != nil {
		return nil, fmt.Errorf("failed to get build sections: %w", err)
	}

	// Convert Row types to BuildSection types
	sections := make([]repository.BuildSection, len(rows))
	for i, row := range rows {
		sections[i] = repository.BuildSection{
			ID:                  row.ID,
			BuildID:             row.BuildID,
			PersonaRole:         row.PersonaRole,
			RoleID:              row.RoleID,
			SubmittedBy:         row.SubmittedBy,
			EncryptedPayload:    row.EncryptedPayload,
			WrappedSymmetricKey: row.WrappedSymmetricKey,
			SectionHash:         row.SectionHash,
			Signature:           row.Signature,
			SubmittedAt:         row.SubmittedAt,
		}
	}

	return sections, nil
}
