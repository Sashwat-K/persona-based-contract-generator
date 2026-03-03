package model

// BuildStatus represents the lifecycle state of a build.
type BuildStatus string

const (
	StatusCreated               BuildStatus = "CREATED"
	StatusWorkloadSubmitted     BuildStatus = "WORKLOAD_SUBMITTED"
	StatusEnvironmentStaged     BuildStatus = "ENVIRONMENT_STAGED"
	StatusAuditorKeysRegistered BuildStatus = "AUDITOR_KEYS_REGISTERED"
	StatusContractAssembled     BuildStatus = "CONTRACT_ASSEMBLED"
	StatusFinalized             BuildStatus = "FINALIZED"
	StatusCancelled             BuildStatus = "CANCELLED"
)

// ValidTransitions defines the legal forward state transitions.
var ValidTransitions = map[BuildStatus]BuildStatus{
	StatusCreated:               StatusWorkloadSubmitted,
	StatusWorkloadSubmitted:     StatusEnvironmentStaged,
	StatusEnvironmentStaged:     StatusAuditorKeysRegistered,
	StatusAuditorKeysRegistered: StatusContractAssembled,
	StatusContractAssembled:     StatusFinalized,
}

// CanTransitionTo checks if a transition from the current status to the next is valid.
func (s BuildStatus) CanTransitionTo(next BuildStatus) bool {
	// Cancellation is allowed from any pre-finalized state.
	if next == StatusCancelled {
		return s != StatusFinalized && s != StatusCancelled
	}
	expected, ok := ValidTransitions[s]
	return ok && expected == next
}

// IsTerminal returns true if the build is in a final state.
func (s BuildStatus) IsTerminal() bool {
	return s == StatusFinalized || s == StatusCancelled
}

// String returns the string representation of the status.
func (s BuildStatus) String() string {
	return string(s)
}
