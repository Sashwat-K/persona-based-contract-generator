-- name: CreateBuildSection :one
INSERT INTO build_sections (build_id, persona_role, submitted_by, encrypted_payload, encrypted_symmetric_key, section_hash, signature)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING id, build_id, persona_role, submitted_by, encrypted_payload, encrypted_symmetric_key, section_hash, signature, submitted_at;

-- name: GetBuildSectionsByBuildID :many
SELECT id, build_id, persona_role, submitted_by, encrypted_payload, encrypted_symmetric_key, section_hash, signature, submitted_at
FROM build_sections
WHERE build_id = $1
ORDER BY submitted_at ASC;

-- name: GetBuildSectionByRole :one
SELECT id, build_id, persona_role, submitted_by, encrypted_payload, encrypted_symmetric_key, section_hash, signature, submitted_at
FROM build_sections
WHERE build_id = $1 AND persona_role = $2;
