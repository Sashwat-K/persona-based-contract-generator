# syntax=docker/dockerfile:1.7

# ── Stage 1: Build ──────────────────────────────────────────────────
FROM docker.io/golang:1.26-alpine AS builder

WORKDIR /src

# Install golang-migrate (used by the migrate entrypoint).
ARG MIGRATE_VERSION=v4.18.3
RUN set -eux; \
    apk add --no-cache curl; \
    ARCH="$(uname -m)"; \
    case "${ARCH}" in \
      x86_64)  ARCH=amd64 ;; \
      s390x)   ARCH=s390x ;; \
    esac; \
    curl -fsSL "https://github.com/golang-migrate/migrate/releases/download/${MIGRATE_VERSION}/migrate.linux-${ARCH}.tar.gz" \
      | tar -xz -C /usr/local/bin migrate; \
    chmod +x /usr/local/bin/migrate

# Cache Go module dependencies.
COPY go.mod go.sum ./
RUN go mod download

# Copy source and build server binary.
COPY . .
ARG TARGETOS=linux
ARG TARGETARCH=amd64
RUN CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} \
    go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

# ── Stage 2: Runtime ───────────────────────────────────────────────
FROM docker.io/golang:1.26-alpine

RUN apk add --no-cache ca-certificates tzdata openssl \
  && addgroup -S app \
  && adduser -S -G app -h /app app

WORKDIR /app

# Copy server binary.
COPY --from=builder /out/server /app/server

# Copy golang-migrate binary.
COPY --from=builder /usr/local/bin/migrate /usr/local/bin/migrate

# Embed migration SQL files.
COPY migrations/ /migrations/

USER app
EXPOSE 8080

ENTRYPOINT ["/app/server"]
