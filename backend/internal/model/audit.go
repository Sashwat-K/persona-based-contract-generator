package model

// AuditEventType represents the type of an audit event.
type AuditEventType string

const (
	EventBuildCreated          AuditEventType = "BUILD_CREATED"
	EventWorkloadSubmitted     AuditEventType = "WORKLOAD_SUBMITTED"
	EventEnvironmentStaged     AuditEventType = "ENVIRONMENT_STAGED"
	EventAuditorKeysRegistered AuditEventType = "AUDITOR_KEYS_REGISTERED"
	EventContractAssembled     AuditEventType = "CONTRACT_ASSEMBLED"
	EventBuildFinalized        AuditEventType = "BUILD_FINALIZED"
	EventBuildCancelled        AuditEventType = "BUILD_CANCELLED"
	EventUserCreated           AuditEventType = "USER_CREATED"
	EventRoleAssigned          AuditEventType = "ROLE_ASSIGNED"
	EventTokenCreated          AuditEventType = "TOKEN_CREATED"
	EventTokenRevoked          AuditEventType = "TOKEN_REVOKED"
	EventContractDownloaded    AuditEventType = "CONTRACT_DOWNLOADED"
)

// String returns the string representation of the event type.
func (e AuditEventType) String() string {
	return string(e)
}
