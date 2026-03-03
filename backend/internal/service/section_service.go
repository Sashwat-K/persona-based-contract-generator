package service

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"

	"github.com/Sashwat-K/persona-based-contract-generator/backend/internal/model"
	"github.com/Sashwat-K/persona-based-contract-generator/backend/internal/repository"
)

// SectionService handles the zero-knowledge storage of encrypted contract payloads.
type SectionService struct {
	queries repository.Querier
}

// NewSectionService creates a new SectionService.
func NewSectionService(queries repository.Querier) *SectionService {
	return &SectionService{queries: queries}
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
	// 1. Verify a section for this role doesn't already exist for this build
	_, err := s.queries.GetBuildSectionByRole(ctx, repository.GetBuildSectionByRoleParams{
		BuildID:     input.BuildID,
		PersonaRole: string(input.PersonaRole),
	})
	if err == nil {
		// No error means a row was found
		return nil, fmt.Errorf("a section for role %s has already been submitted for this build", input.PersonaRole)
	}
	if !strings.Contains(err.Error(), "no rows in result set") {
		return nil, fmt.Errorf("failed to check existing sections: %w", err)
	}

	// 2. Insert the section
	section, err := s.queries.CreateBuildSection(ctx, repository.CreateBuildSectionParams{
		BuildID:               input.BuildID,
		PersonaRole:           string(input.PersonaRole),
		SubmittedBy:           input.SubmittedBy,
		EncryptedPayload:      input.EncryptedPayload,
		EncryptedSymmetricKey: input.EncryptedSymmetricKey,
		SectionHash:           input.SectionHash,
		Signature:             input.Signature,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to submit build section: %w", err)
	}

	return &section, nil
}

// GetSections returns all submitted sections for a build.
func (s *SectionService) GetSections(ctx context.Context, buildID uuid.UUID) ([]repository.BuildSection, error) {
	sections, err := s.queries.GetBuildSectionsByBuildID(ctx, buildID)
	if err != nil {
		return nil, fmt.Errorf("failed to get build sections: %w", err)
	}
	return sections, nil
}
