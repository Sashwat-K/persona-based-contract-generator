package service

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/Sashwat-K/persona-based-contract-generator/backend/internal/model"
	"github.com/Sashwat-K/persona-based-contract-generator/backend/internal/repository"
)

// UserService handles user management operations.
type UserService struct {
	queries    repository.Querier
	bcryptCost int
}

// NewUserService creates a new UserService.
func NewUserService(queries repository.Querier, bcryptCost int) *UserService {
	return &UserService{
		queries:    queries,
		bcryptCost: bcryptCost,
	}
}

// UserWithRoles represents a user with their assigned roles.
type UserWithRoles struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	Roles     []string  `json:"roles"`
	IsActive  bool      `json:"is_active"`
	CreatedAt string    `json:"created_at"`
}

// ListUsers returns all users with their roles. ADMIN only.
func (s *UserService) ListUsers(ctx context.Context) ([]UserWithRoles, error) {
	users, err := s.queries.ListUsers(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to list users: %w", err)
	}

	result := make([]UserWithRoles, 0, len(users))
	for _, u := range users {
		roles, err := s.queries.GetRolesByUserID(ctx, u.ID)
		if err != nil {
			return nil, fmt.Errorf("failed to load roles for user %s: %w", u.ID, err)
		}

		roleStrings := make([]string, len(roles))
		for i, r := range roles {
			roleStrings[i] = r.Role
		}

		result = append(result, UserWithRoles{
			ID:        u.ID,
			Name:      u.Name,
			Email:     u.Email,
			Roles:     roleStrings,
			IsActive:  u.IsActive,
			CreatedAt: u.CreatedAt.Format("2006-01-02T15:04:05Z"),
		})
	}

	return result, nil
}

// CreateUserInput contains the input for creating a new user.
type CreateUserInput struct {
	Name     string   `json:"name"`
	Email    string   `json:"email"`
	Password string   `json:"password"`
	Roles    []string `json:"roles"`
}

// CreateUser creates a new user with the specified roles.
func (s *UserService) CreateUser(ctx context.Context, input CreateUserInput, assignedBy uuid.UUID) (*UserWithRoles, error) {
	// Validate roles
	for _, role := range input.Roles {
		if !model.PersonaRole(role).IsValid() {
			return nil, fmt.Errorf("invalid role: %s", role)
		}
	}

	// Hash password
	hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), s.bcryptCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	// Create user
	user, err := s.queries.CreateUser(ctx, repository.CreateUserParams{
		Name:         input.Name,
		Email:        input.Email,
		PasswordHash: string(hash),
	})
	if err != nil {
		// Check for duplicate email (PostgreSQL unique constraint violation)
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	// Assign roles
	for _, role := range input.Roles {
		_, err = s.queries.AssignRole(ctx, repository.AssignRoleParams{
			UserID:     user.ID,
			Role:       role,
			AssignedBy: assignedBy,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to assign role %s: %w", role, err)
		}
	}

	return &UserWithRoles{
		ID:        user.ID,
		Name:      user.Name,
		Email:     user.Email,
		Roles:     input.Roles,
		IsActive:  user.IsActive,
		CreatedAt: user.CreatedAt.Format("2006-01-02T15:04:05Z"),
	}, nil
}

// UpdateRoles replaces all roles for a user.
func (s *UserService) UpdateRoles(ctx context.Context, userID uuid.UUID, roles []string, assignedBy uuid.UUID) (*UserWithRoles, error) {
	// Validate roles
	for _, role := range roles {
		if !model.PersonaRole(role).IsValid() {
			return nil, fmt.Errorf("invalid role: %s", role)
		}
	}

	// Verify user exists
	user, err := s.queries.GetUserByID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	// Delete existing roles and assign new ones
	if err := s.queries.DeleteRolesByUserID(ctx, userID); err != nil {
		return nil, fmt.Errorf("failed to clear roles: %w", err)
	}

	for _, role := range roles {
		_, err = s.queries.AssignRole(ctx, repository.AssignRoleParams{
			UserID:     userID,
			Role:       role,
			AssignedBy: assignedBy,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to assign role %s: %w", role, err)
		}
	}

	return &UserWithRoles{
		ID:        user.ID,
		Name:      user.Name,
		Email:     user.Email,
		Roles:     roles,
		IsActive:  user.IsActive,
		CreatedAt: user.CreatedAt.Format("2006-01-02T15:04:05Z"),
	}, nil
}

// TokenInfo represents an API token for display (no raw token or hash).
type TokenInfo struct {
	ID         uuid.UUID `json:"id"`
	Name       string    `json:"name"`
	LastUsedAt *string   `json:"last_used_at"`
	RevokedAt  *string   `json:"revoked_at"`
	CreatedAt  string    `json:"created_at"`
}

// ListTokens returns all API tokens for a user.
func (s *UserService) ListTokens(ctx context.Context, userID uuid.UUID) ([]TokenInfo, error) {
	tokens, err := s.queries.ListAPITokensByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to list tokens: %w", err)
	}

	result := make([]TokenInfo, 0, len(tokens))
	for _, t := range tokens {
		info := TokenInfo{
			ID:        t.ID,
			Name:      t.Name,
			CreatedAt: t.CreatedAt.Format("2006-01-02T15:04:05Z"),
		}
		if t.LastUsedAt.Valid {
			s := t.LastUsedAt.Time.Format("2006-01-02T15:04:05Z")
			info.LastUsedAt = &s
		}
		if t.RevokedAt.Valid {
			s := t.RevokedAt.Time.Format("2006-01-02T15:04:05Z")
			info.RevokedAt = &s
		}
		result = append(result, info)
	}

	return result, nil
}

// CreateTokenResult contains the result of creating a new API token.
type CreateTokenResult struct {
	ID    uuid.UUID `json:"id"`
	Name  string    `json:"name"`
	Token string    `json:"token"` // Raw token, shown only once
}

// CreateToken creates a new API token for a user.
func (s *UserService) CreateToken(ctx context.Context, userID uuid.UUID, name string) (*CreateTokenResult, error) {
	rawToken, hashedToken := GenerateToken()

	row, err := s.queries.CreateAPIToken(ctx, repository.CreateAPITokenParams{
		UserID:    userID,
		Name:      name,
		TokenHash: hashedToken,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create token: %w", err)
	}

	return &CreateTokenResult{
		ID:    row.ID,
		Name:  row.Name,
		Token: rawToken,
	}, nil
}

// RevokeToken revokes an API token.
func (s *UserService) RevokeToken(ctx context.Context, userID uuid.UUID, tokenID uuid.UUID) error {
	return s.queries.RevokeAPIToken(ctx, repository.RevokeAPITokenParams{
		ID:     tokenID,
		UserID: userID,
	})
}
