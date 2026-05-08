package handler

import (
	"net/http"

	"github.com/Sashwat-K/persona-based-contract-generator/backend/internal/middleware"
	"github.com/Sashwat-K/persona-based-contract-generator/backend/internal/service"
)

func requestIP(r *http.Request) string {
	return middleware.RequestIP(r)
}

func actorEmail(r *http.Request, fallback string) string {
	if r == nil {
		return fallback
	}
	if email := middleware.GetUserEmail(r.Context()); email != "" {
		return email
	}
	return fallback
}

func logSystemEvent(systemLogService *service.SystemLogService, r *http.Request, fallbackEmail, action, resource, status, details string) {
	if systemLogService == nil {
		return
	}
	systemLogService.LogEvent(
		r.Context(),
		actorEmail(r, fallbackEmail),
		action,
		resource,
		requestIP(r),
		status,
		details,
	)
}
