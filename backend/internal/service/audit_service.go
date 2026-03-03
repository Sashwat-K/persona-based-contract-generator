package service

import (
	"context"
	"encoding/json"
	"fmt"
	"net/netip"
	"strings"

	"github.com/google/uuid"

	"github.com/Sashwat-K/persona-based-contract-generator/backend/internal/crypto"
	"github.com/Sashwat-K/persona-based-contract-generator/backend/internal/model"
	"github.com/Sashwat-K/persona-based-contract-generator/backend/internal/repository"
)

// AuditService handles the deterministic hash chain of build events.
type AuditService struct {
	queries repository.Querier
}

// NewAuditService creates a new AuditService.
func NewAuditService(queries repository.Querier) *AuditService {
	return &AuditService{queries: queries}
}

// LogEventInput contains data for a new audit event.
type LogEventInput struct {
	BuildID        uuid.UUID
	EventType      model.AuditEventType
	ActorUserID    uuid.UUID
	ActorPublicKey *string
	IpAddress      string
	DeviceMetadata []byte
	EventData      any     // Will be marshaled to JSON
	Signature      *string // Signature of the EventHash by ActorPublicKey (optional for some events)
}

// LogEvent securely appends a new event to the build's audit hash chain.
func (s *AuditService) LogEvent(ctx context.Context, input LogEventInput) (*repository.AuditEvent, error) {
	// Marshal event data
	eventDataJSON, err := json.Marshal(input.EventData)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal event data: %w", err)
	}

	// Determine sequence number and previous hash
	var seqNo int32 = 1
	var prevHash string

	latest, err := s.queries.GetLatestAuditEvent(ctx, input.BuildID)
	if err != nil {
		if strings.Contains(err.Error(), "no rows in result set") {
			// First event in the chain: prevHash is the genesis hash
			prevHash = crypto.ComputeGenesisHash(input.BuildID.String())
		} else {
			return nil, fmt.Errorf("failed to get latest event: %w", err)
		}
	} else {
		seqNo = latest.SequenceNo + 1
		prevHash = latest.EventHash
	}

	// Compute new event hash
	eventHash := crypto.ComputeEventHash(eventDataJSON, prevHash)

	// Parse IP address
	var ip *netip.Addr
	if input.IpAddress != "" {
		parsedIP, err := netip.ParseAddr(input.IpAddress)
		if err == nil {
			ip = &parsedIP
		}
	}

	// Prepare device metadata
	var devMeta []byte
	if input.DeviceMetadata != nil {
		devMeta = input.DeviceMetadata
	} else {
		devMeta = []byte("{}")
	}

	// Insert into DB
	row, err := s.queries.CreateAuditEvent(ctx, repository.CreateAuditEventParams{
		BuildID:           input.BuildID,
		SequenceNo:        seqNo,
		EventType:         string(input.EventType),
		ActorUserID:       input.ActorUserID,
		ActorPublicKey:    input.ActorPublicKey,
		IpAddress:         ip,
		DeviceMetadata:    devMeta,
		EventData:         json.RawMessage(eventDataJSON),
		PreviousEventHash: prevHash,
		EventHash:         eventHash,
		Signature:         input.Signature,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create audit event: %w", err)
	}

	return &row, nil
}

// GetAuditTrail returns the full chronological audit trail for a build.
func (s *AuditService) GetAuditTrail(ctx context.Context, buildID uuid.UUID) ([]repository.AuditEvent, error) {
	events, err := s.queries.GetAuditEventsByBuildID(ctx, buildID)
	if err != nil {
		return nil, fmt.Errorf("failed to get audit events: %w", err)
	}
	return events, nil
}
