package service

import (
	"context"
	"fmt"
	"regexp"
	"strings"

	"github.com/google/uuid"

	contractengine "github.com/Sashwat-K/persona-based-contract-generator/backend/internal/contract"
	appcrypto "github.com/Sashwat-K/persona-based-contract-generator/backend/internal/crypto"
	"github.com/Sashwat-K/persona-based-contract-generator/backend/internal/model"
	"github.com/Sashwat-K/persona-based-contract-generator/backend/internal/repository"
)

// ContractService owns backend-native section encryption and finalization logic.
type ContractService struct {
	queries           repository.Querier
	sectionService    *SectionService
	buildService      *BuildService
	assignmentService *AssignmentService
	keyService        *KeyService
	keyProvider       interface {
		GetPrivateKey(ctx context.Context, keyID uuid.UUID) ([]byte, error)
		SignDigest(ctx context.Context, keyID uuid.UUID, digestHex string) (string, error)
	}
	engine contractengine.Engine
	store  *v2Store
}

func NewContractService(
	queries repository.Querier,
	db repository.DBTX,
	sectionService *SectionService,
	buildService *BuildService,
	assignmentService *AssignmentService,
	keyService *KeyService,
	keyProvider interface {
		GetPrivateKey(ctx context.Context, keyID uuid.UUID) ([]byte, error)
		SignDigest(ctx context.Context, keyID uuid.UUID, digestHex string) (string, error)
	},
	engine contractengine.Engine,
) *ContractService {
	return &ContractService{
		queries:           queries,
		sectionService:    sectionService,
		buildService:      buildService,
		assignmentService: assignmentService,
		keyService:        keyService,
		keyProvider:       keyProvider,
		engine:            engine,
		store:             newV2Store(db),
	}
}

type SubmitSectionV2Input struct {
	BuildID              uuid.UUID
	ActorID              uuid.UUID
	ActorRoles           []string
	ActorIP              string
	RequestSignature     *string
	RequestSignatureHash *string
	Plaintext            string
	CertificatePEM       string
}

type FinalizeContractV2Input struct {
	BuildID              uuid.UUID
	ActorID              uuid.UUID
	ActorRoles           []string
	ActorIP              string
	RequestSignature     *string
	RequestSignatureHash *string
	SigningKeyID         uuid.UUID
	AttestationKeyID     *uuid.UUID
	AttestationCertPEM   string
}

type FinalizeContractV2Result struct {
	Status             string `json:"status"`
	ContractHash       string `json:"contract_hash"`
	ContractYAMLLength int    `json:"contract_yaml_length"`
}

var signingKeyYAMLPattern = regexp.MustCompile(`(?im)^[\t ]*signingkey[\t ]*:`)

func (s *ContractService) GetContractTemplate(ctx context.Context, templateType string) (string, string, error) {
	normalized := strings.ToLower(strings.TrimSpace(templateType))
	switch normalized {
	case "workload", "env":
		// Supported template types.
	default:
		return "", "", model.ErrInvalidRequest("unsupported contract template type; expected workload or env")
	}

	template, err := s.engine.HpcrContractTemplate(ctx, normalized)
	if err != nil {
		return "", "", model.ErrInvalidRequest("failed to load contract template")
	}
	return normalized, template, nil
}

func (s *ContractService) SubmitWorkloadSection(ctx context.Context, in SubmitSectionV2Input) (*repository.BuildSection, error) {
	if err := s.assignmentService.ValidateAssignmentForSubmission(ctx, in.BuildID, in.ActorID, model.RoleSolutionProvider.String()); err != nil {
		return nil, err
	}
	if strings.TrimSpace(in.Plaintext) == "" {
		return nil, model.ErrInvalidRequest("plaintext workload is required")
	}
	if strings.TrimSpace(in.CertificatePEM) == "" {
		return nil, model.ErrInvalidRequest("certificate PEM is required")
	}

	encryptedPayload, err := s.engine.EncryptString(ctx, in.Plaintext, in.CertificatePEM)
	if err != nil {
		return nil, model.ErrInvalidCertificate(fmt.Sprintf("failed to encrypt workload with provided certificate: %v", err))
	}
	sectionHash := appcrypto.SHA256HexString(encryptedPayload)
	signature := valueOrEmpty(in.RequestSignature)

	return s.sectionService.SubmitSection(ctx, SubmitSectionInput{
		BuildID:               in.BuildID,
		PersonaRole:           model.RoleSolutionProvider,
		SubmittedBy:           in.ActorID,
		EncryptedPayload:      encryptedPayload,
		EncryptedSymmetricKey: nil,
		SectionHash:           sectionHash,
		Signature:             signature,
		ActorRoles:            in.ActorRoles,
		ActorIP:               in.ActorIP,
		RequestSignature:      in.RequestSignature,
		RequestSignatureHash:  in.RequestSignatureHash,
	})
}

func (s *ContractService) SubmitEnvironmentSection(ctx context.Context, in SubmitSectionV2Input) (*repository.BuildSection, error) {
	if err := s.assignmentService.ValidateAssignmentForSubmission(ctx, in.BuildID, in.ActorID, model.RoleDataOwner.String()); err != nil {
		return nil, err
	}
	if strings.TrimSpace(in.Plaintext) == "" {
		return nil, model.ErrInvalidRequest("plaintext environment is required")
	}
	if strings.TrimSpace(in.CertificatePEM) == "" {
		return nil, model.ErrInvalidRequest("certificate PEM is required")
	}

	signingKey, err := s.store.getLatestActiveBuildKeyByType(ctx, in.BuildID, model.BuildKeyTypeSigning)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "no rows") {
			return nil, model.ErrInvalidRequest("signing key must be registered before submitting environment")
		}
		return nil, fmt.Errorf("failed to load signing key for environment section: %w", err)
	}

	envPayload, err := ensureEnvironmentHasSigningKey(in.Plaintext, signingKey.PublicKey)
	if err != nil {
		return nil, model.ErrInvalidRequest(err.Error())
	}

	encryptedPayload, err := s.engine.EncryptString(ctx, envPayload, in.CertificatePEM)
	if err != nil {
		return nil, model.ErrInvalidCertificate(fmt.Sprintf("failed to encrypt environment with provided certificate: %v", err))
	}
	sectionHash := appcrypto.SHA256HexString(encryptedPayload)
	signature := valueOrEmpty(in.RequestSignature)

	return s.sectionService.SubmitSection(ctx, SubmitSectionInput{
		BuildID:               in.BuildID,
		PersonaRole:           model.RoleDataOwner,
		SubmittedBy:           in.ActorID,
		EncryptedPayload:      encryptedPayload,
		EncryptedSymmetricKey: nil,
		SectionHash:           sectionHash,
		Signature:             signature,
		ActorRoles:            in.ActorRoles,
		ActorIP:               in.ActorIP,
		RequestSignature:      in.RequestSignature,
		RequestSignatureHash:  in.RequestSignatureHash,
	})
}

func (s *ContractService) FinalizeContract(ctx context.Context, in FinalizeContractV2Input) (*FinalizeContractV2Result, error) {
	if err := s.assignmentService.ValidateAssignmentForSubmission(ctx, in.BuildID, in.ActorID, model.RoleAuditor.String()); err != nil {
		return nil, err
	}
	if in.SigningKeyID == uuid.Nil {
		return nil, model.ErrInvalidRequest("signing_key_id is required")
	}

	signingKey, err := s.keyService.GetBuildKey(ctx, in.SigningKeyID)
	if err != nil {
		return nil, model.ErrInvalidRequest("invalid signing key")
	}
	if signingKey.BuildID != in.BuildID || signingKey.KeyType != model.BuildKeyTypeSigning {
		return nil, model.ErrInvalidRequest("signing key does not belong to this build")
	}

	attestationKey, err := s.resolveAttestationKey(ctx, in.BuildID, in.AttestationKeyID)
	if err != nil {
		return nil, err
	}

	sections, err := s.queries.GetBuildSectionsByBuildID(ctx, in.BuildID)
	if err != nil {
		return nil, fmt.Errorf("failed to load build sections: %w", err)
	}
	var workloadEnc, envEnc string
	for _, section := range sections {
		switch model.PersonaRole(section.PersonaRole) {
		case model.RoleSolutionProvider:
			workloadEnc = section.EncryptedPayload
		case model.RoleDataOwner:
			envEnc = section.EncryptedPayload
		}
	}
	if workloadEnc == "" || envEnc == "" {
		return nil, model.ErrInvalidRequest("workload and environment sections are required before finalization")
	}

	attestationPayload := strings.TrimSpace(attestationKey.PublicKey)
	if strings.TrimSpace(attestationPayload) == "" {
		return nil, model.ErrInvalidRequest("attestation public key is empty")
	}
	if strings.TrimSpace(in.AttestationCertPEM) == "" {
		return nil, model.ErrInvalidRequest("attestation_cert_pem is required to encrypt attestation public key")
	}

	encryptedAttestation, err := s.engine.EncryptString(ctx, attestationPayload, in.AttestationCertPEM)
	if err != nil {
		return nil, fmt.Errorf("failed to encrypt attestation public key: %w", err)
	}
	attestationPayload = encryptedAttestation

	privateKeyPEM, err := s.keyProvider.GetPrivateKey(ctx, signingKey.ID)
	if err != nil {
		return nil, model.ErrInvalidRequest("signing private key is unavailable for HPCR signing")
	}
	defer zeroizeBytes(privateKeyPEM)

	privateKey := string(privateKeyPEM)
	defer func() { privateKey = "" }()

	contractInputYAML, _, err := s.engine.AssembleContract(ctx, contractengine.AssembleInput{
		EncryptedWorkload:       workloadEnc,
		EncryptedEnvironment:    envEnc,
		EncryptedAttestationKey: attestationPayload,
		EnvWorkloadSignature:    "",
	})
	if err != nil {
		return nil, fmt.Errorf("failed to assemble contract: %w", err)
	}

	contractYAML, _, contractHash, err := s.engine.HpcrContractSign(ctx, contractInputYAML, privateKey, "")
	if err != nil {
		return nil, fmt.Errorf("failed to sign contract: %w", err)
	}
	contractHash = strings.TrimSpace(contractHash)
	if contractHash == "" {
		contractHash = appcrypto.SHA256HexString(contractYAML)
	}

	contractSignature, err := s.keyProvider.SignDigest(ctx, signingKey.ID, contractHash)
	if err != nil {
		return nil, fmt.Errorf("failed to sign contract hash for audit trail: %w", err)
	}

	// In v2 workflow, ATTESTATION_KEY_REGISTERED -> FINALIZED directly (no CONTRACT_ASSEMBLED step).
	// FinalizeBuild handles the transition and state validation.

	if err := s.buildService.FinalizeBuild(
		ctx,
		in.BuildID,
		contractHash,
		contractYAML,
		in.ActorID,
		in.ActorIP,
		contractSignature,
		signingKey.PublicKey,
	); err != nil {
		return nil, err
	}

	return &FinalizeContractV2Result{
		Status:             model.StatusFinalized.String(),
		ContractHash:       contractHash,
		ContractYAMLLength: len(contractYAML),
	}, nil
}

func (s *ContractService) resolveAttestationKey(ctx context.Context, buildID uuid.UUID, keyID *uuid.UUID) (*buildKeyRow, error) {
	if keyID != nil && *keyID != uuid.Nil {
		key, err := s.keyService.GetBuildKey(ctx, *keyID)
		if err != nil {
			return nil, model.ErrInvalidRequest("invalid attestation key")
		}
		if key.BuildID != buildID || key.KeyType != model.BuildKeyTypeAttestation {
			return nil, model.ErrInvalidRequest("attestation key does not belong to this build")
		}
		return key, nil
	}
	key, err := s.store.getLatestActiveBuildKeyByType(ctx, buildID, model.BuildKeyTypeAttestation)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "no rows") {
			return nil, model.ErrInvalidRequest("attestation key is required before finalization")
		}
		return nil, fmt.Errorf("failed to load attestation key: %w", err)
	}
	return key, nil
}

func valueOrEmpty(v *string) string {
	if v == nil {
		return ""
	}
	return *v
}

func zeroizeBytes(b []byte) {
	for i := range b {
		b[i] = 0
	}
}

func ensureEnvironmentHasSigningKey(plaintext, signingKey string) (string, error) {
	trimmed := strings.TrimSpace(plaintext)
	if trimmed == "" {
		return "", fmt.Errorf("plaintext environment is required")
	}
	if signingKeyYAMLPattern.MatchString(trimmed) {
		return trimmed, nil
	}

	trimmedSigningKey := strings.TrimSpace(signingKey)
	if trimmedSigningKey == "" {
		return "", fmt.Errorf("signing key is unavailable for environment section")
	}

	var b strings.Builder
	b.WriteString(trimmed)
	b.WriteString("\n")
	b.WriteString("signingKey: |-\n")
	for _, line := range strings.Split(trimmedSigningKey, "\n") {
		b.WriteString("  ")
		b.WriteString(strings.TrimRight(line, "\r"))
		b.WriteString("\n")
	}

	return b.String(), nil
}
