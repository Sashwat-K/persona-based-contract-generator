# syntax=docker/dockerfile:1.7

FROM golang:1.25-alpine

WORKDIR /src

# Runtime deps + build deps in the same image.
RUN apk add --no-cache ca-certificates tzdata

# Cache dependencies first.
COPY go.mod go.sum ./
RUN go mod download

# Copy source and build server binary.
COPY . .
ARG TARGETOS=linux
ARG TARGETARCH=amd64
RUN CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} go build -trimpath -ldflags="-s -w" -o /app/server ./cmd/server

EXPOSE 8080

ENTRYPOINT ["/app/server"]
