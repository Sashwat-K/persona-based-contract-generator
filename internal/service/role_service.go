package service

import (
	"context"
	"fmt"

	"github.com/Sashwat-K/persona-based-contract-generator/backend/internal/repository"
)

// RoleService handles role read operations.
type RoleService struct {
	queries repository.Querier
}

func NewRoleService(queries repository.Querier) *RoleService {
	return &RoleService{queries: queries}
}

func (s *RoleService) ListRoles(ctx context.Context) ([]repository.Role, error) {
	roles, err := s.queries.ListRoles(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to list roles: %w", err)
	}
	return roles, nil
}
