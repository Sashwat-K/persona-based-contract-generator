# syntax=docker/dockerfile:1.7

FROM quay.io/sashwatk/golang:1.26-alpine@sha256:912d6b86612abffe723d9a9651d758cb3ebfe644d30aca969ef25359d1d97f09 AS builder

WORKDIR /src

# Cache dependencies first.
COPY go.mod go.sum ./
RUN go mod download

# Copy source and build server binary.
COPY . .
ARG TARGETOS=linux
ARG TARGETARCH=amd64
RUN CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

FROM quay.io/sashwatk/golang:1.26-alpine@sha256:912d6b86612abffe723d9a9651d758cb3ebfe644d30aca969ef25359d1d97f09

RUN apk add --no-cache ca-certificates tzdata openssl \
  && addgroup -S app \
  && adduser -S -G app -h /app app

WORKDIR /app
COPY --from=builder /out/server /app/server

USER app
EXPOSE 8080

ENTRYPOINT ["/app/server"]
