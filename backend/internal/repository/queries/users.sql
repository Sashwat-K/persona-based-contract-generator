-- name: GetUserByEmail :one
SELECT u.id, u.name, u.email, u.password_hash, u.is_active, u.created_at
FROM users u
WHERE u.email = $1;

-- name: GetUserByID :one
SELECT u.id, u.name, u.email, u.password_hash, u.is_active, u.created_at
FROM users u
WHERE u.id = $1;

-- name: ListUsers :many
SELECT u.id, u.name, u.email, u.is_active, u.created_at
FROM users u
ORDER BY u.created_at DESC;

-- name: CreateUser :one
INSERT INTO users (name, email, password_hash)
VALUES ($1, $2, $3)
RETURNING id, name, email, is_active, created_at;

-- name: DeactivateUser :exec
UPDATE users SET is_active = false WHERE id = $1;
