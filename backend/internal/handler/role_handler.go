package handler

import (
	"net/http"

	"github.com/Sashwat-K/persona-based-contract-generator/backend/internal/model"
	"github.com/Sashwat-K/persona-based-contract-generator/backend/internal/service"
)

type RoleHandler struct {
	roleService *service.RoleService
}

func NewRoleHandler(roleService *service.RoleService) *RoleHandler {
	return &RoleHandler{roleService: roleService}
}

// ListRoles handles GET /roles
func (h *RoleHandler) ListRoles(w http.ResponseWriter, r *http.Request) {
	roles, err := h.roleService.ListRoles(r.Context())
	if err != nil {
		writeError(w, model.ErrInternal("Failed to list roles."))
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"roles": roles})
}
