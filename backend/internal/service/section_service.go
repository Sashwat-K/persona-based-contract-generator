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
}

// NewSectionService creates a new SectionService.
func NewSectionService(queries repository.Querier, assignmentService *AssignmentService) *SectionService {
	return &SectionService{
		queries:           queries,
		assignmentService: assignmentService,
	}
}

// SubmitSectionInput contains the data for a new build section.
type SubmitSectionInput struct {
	BuildID               uuid.UUID
	PersonaRole           model.PersonaRole
	SubmittedBy           uuid.UUID
	EncryptedPayload      string
	EncryptedSymmetricKey *string
	SectionHash           string
	Signature             string
}

// SubmitSection stores an encrypted payload for a specific persona role.
// The backend does not decrypt or validate the payload natively (Zero-Knowledge).
func (s *SectionService) SubmitSection(ctx context.Context, input SubmitSectionInput) (*repository.BuildSection, error) {
	// 1. Validate user is assigned to this role for this build (two-layer access control)
	err := s.assignmentService.ValidateAssignmentForSubmission(ctx, input.BuildID, input.SubmittedBy, string(input.PersonaRole))
	if err != nil {
		return nil, err // Returns AppError with proper status code
	}

	// 2. Verify a section for this role doesn't already exist for this build
	_, err = s.queries.GetBuildSectionByRole(ctx, repository.GetBuildSectionByRoleParams{
		BuildID:     input.BuildID,
		PersonaRole: string(input.PersonaRole),
	})
	if err == nil {
		// No error means a row was found
		return nil, model.ErrDuplicateSection(string(input.PersonaRole))
	}
	if !strings.Contains(err.Error(), "no rows in result set") {
		return nil, fmt.Errorf("failed to check existing sections: %w", err)
	}

	// 3. Insert the section
	section, err := s.queries.CreateBuildSection(ctx, repository.CreateBuildSectionParams{
		BuildID:             input.BuildID,
		PersonaRole:         string(input.PersonaRole),
		RoleID:              pgtype.UUID{Valid: false}, // Will be populated later with proper role lookup
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
