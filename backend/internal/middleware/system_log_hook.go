package middleware

import (
	"context"
	"net/http"
	"sync"
)

// SystemLogFn defines the function signature used by middleware to emit system logs.
type SystemLogFn func(ctx context.Context, email, action, resource, ipAddress, status, details string)

var (
	systemLogHookMu sync.RWMutex
	systemLogHook   SystemLogFn
)

// SetSystemLogHook wires a function used by middleware to persist security/system events.
func SetSystemLogHook(fn SystemLogFn) {
	systemLogHookMu.Lock()
	defer systemLogHookMu.Unlock()
	systemLogHook = fn
}

func emitSystemLog(ctx context.Context, email, action, resource, ipAddress, status, details string) {
	systemLogHookMu.RLock()
	hook := systemLogHook
	systemLogHookMu.RUnlock()
	if hook == nil {
		return
	}
	hook(ctx, email, action, resource, ipAddress, status, details)
}

func requestIP(r *http.Request) string {
	if r == nil {
		return "unknown"
	}
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		return forwarded
	}
	if r.RemoteAddr != "" {
		return r.RemoteAddr
	}
	return "unknown"
}

func actorEmailFromContext(r *http.Request, fallback string) string {
	if r == nil {
		return fallback
	}
	if email := GetUserEmail(r.Context()); email != "" {
		return email
	}
	return fallback
}
