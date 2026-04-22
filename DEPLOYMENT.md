# Deployment Guide - HPCR Contract Builder

This guide provides step-by-step instructions for deploying the HPCR Contract Builder application using Docker Compose.

## Prerequisites

- Docker Engine 20.10+ and Docker Compose v2.0+
- At least 2GB of available RAM
- 5GB of available disk space
- Linux, macOS, or Windows with WSL2

## Quick Start (Development)

### 1. Clone and Setup

```bash
# Navigate to project directory
cd /path/to/persona-based-contract-generator

# Verify .env file exists (already created)
ls -la .env
```

### 2. Review and Customize Environment Variables

The `.env` file has been pre-configured with secure defaults. **IMPORTANT**: Change these passwords before production deployment:

```bash
# Edit the .env file and update these critical values:
# - POSTGRES_PASSWORD
# - PGADMIN_DEFAULT_PASSWORD
# - ADMIN_PASSWORD
# - VAULT_TOKEN (for production)
```

### 3. Start the Application

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Check service health
docker compose ps
```

### 4. Verify Deployment

The application should be accessible at:

- **Main Application**: http://localhost:8080
- **PgAdmin**: http://localhost:5050
- **Vault UI**: http://localhost:8000
- **Vault API**: http://localhost:8200

### 5. Initial Login

Use the admin credentials from your `.env` file:
- **Email**: admin@hpcr-builder.local
- **Password**: SecureAdminPassword123! (or your custom password)

## Service Architecture

The deployment includes the following services:

1. **reverse_proxy** (nginx) - Routes traffic to backend
2. **postgres** - PostgreSQL 16 database
3. **pgadmin** - Database management UI
4. **vault** - HashiCorp Vault for key management
5. **vault-init** - Initializes Vault transit engine
6. **vault-ui** - Vault web interface
7. **backend** - Go backend API server
8. **migrate** - Database migration runner

## Environment Variables Reference

### Critical Variables (Must Be Set)

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_PASSWORD` | PostgreSQL database password | SecurePostgresPassword123! |
| `DATABASE_URL` | Backend database connection string | Auto-generated |
| `MIGRATE_DATABASE_URL` | Migration database connection string | Auto-generated |
| `ADMIN_NAME` | Initial admin user name | System Admin |
| `ADMIN_EMAIL` | Initial admin email | admin@hpcr-builder.local |
| `ADMIN_PASSWORD` | Initial admin password | SecureAdminPassword123! |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REVERSE_PROXY_PORT` | HTTP port for reverse proxy | 8080 |
| `POSTGRES_PORT` | PostgreSQL port | 5432 |
| `VAULT_PORT` | Vault API port | 8200 |
| `VAULT_UI_PORT` | Vault UI port | 8000 |
| `PGADMIN_PORT` | PgAdmin port | 5050 |
| `LOG_LEVEL` | Application log level | info |
| `TOKEN_EXPIRY` | JWT token expiration | 24h |

## Production Deployment

### 1. Generate TLS Certificates

```bash
# Create certificate directory
mkdir -p config/nginx/certs

# Generate self-signed certificate (for testing)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout config/nginx/certs/privkey.pem \
  -out config/nginx/certs/fullchain.pem \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"

# For production, use Let's Encrypt or your CA-signed certificates
```

### 2. Update Environment Variables

```bash
# Edit .env file for production
nano .env

# Update these for production:
# - Change all passwords to strong, unique values
# - Set VAULT_AUTH_METHOD=approle (recommended)
# - Configure VAULT_ROLE_ID and VAULT_SECRET_ID
# - Update CORS_ALLOWED_ORIGINS to your domain
# - Set LOG_LEVEL=warn or error
```

### 3. Deploy with Production Configuration

```bash
# Start with production overrides
docker compose -f docker-compose.yaml -f docker-compose.prod.yaml up -d

# The application will be available on:
# - HTTP: http://localhost:8080
# - HTTPS: https://localhost:8443
```

## Common Operations

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend

# Last 100 lines
docker compose logs --tail=100 backend
```

### Restart Services

```bash
# Restart all services
docker compose restart

# Restart specific service
docker compose restart backend
```

### Stop Services

```bash
# Stop all services (keeps data)
docker compose stop

# Stop and remove containers (keeps data)
docker compose down

# Stop and remove everything including volumes (DELETES DATA)
docker compose down -v
```

### Database Backup

```bash
# Backup database
docker compose exec postgres pg_dump -U hpcr hpcr_builder > backup.sql

# Restore database
docker compose exec -T postgres psql -U hpcr hpcr_builder < backup.sql
```

### Update Application

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker compose up -d --build

# View migration logs
docker compose logs migrate
```

## Troubleshooting

### Service Won't Start

```bash
# Check service status
docker compose ps

# View detailed logs
docker compose logs <service-name>

# Check health status
docker compose exec backend wget -q -O - http://localhost:8080/health
```

### Database Connection Issues

```bash
# Verify PostgreSQL is running
docker compose exec postgres pg_isready -U hpcr

# Check database exists
docker compose exec postgres psql -U hpcr -l

# Test connection from backend
docker compose exec backend sh -c 'wget -q -O - http://localhost:8080/health'
```

### Vault Issues

```bash
# Check Vault status
docker compose exec vault vault status

# Verify transit engine
docker compose exec vault vault secrets list

# Re-initialize transit engine
docker compose restart vault-init
```

### Permission Issues

```bash
# Fix data directory permissions
sudo chown -R 1000:1000 data/postgres

# Verify permissions
ls -la data/postgres
```

### Reset Everything

```bash
# WARNING: This deletes all data
docker compose down -v
rm -rf data/postgres
docker compose up -d
```

## Security Considerations

### Development Environment

- Default passwords are set for convenience
- Vault runs in dev mode (data not persisted)
- CORS allows localhost origins
- TLS is optional

### Production Environment

1. **Change All Default Passwords**
   - Use strong, unique passwords for all services
   - Store passwords securely (e.g., password manager, secrets manager)

2. **Enable TLS**
   - Use valid TLS certificates
   - Redirect HTTP to HTTPS
   - Configure HSTS headers

3. **Vault Configuration**
   - Use production Vault deployment (not dev mode)
   - Enable AppRole authentication
   - Configure proper access policies
   - Enable audit logging

4. **Network Security**
   - Use firewall rules to restrict access
   - Consider using a VPN or bastion host
   - Implement rate limiting
   - Enable fail2ban or similar

5. **Monitoring**
   - Set up log aggregation
   - Configure alerting
   - Monitor resource usage
   - Track security events

## Health Checks

All services include health checks:

```bash
# Check all service health
docker compose ps

# Backend health endpoint
curl http://localhost:8080/health

# Nginx health endpoint
curl http://localhost:8080/nginx-health

# Vault health endpoint
curl http://localhost:8200/v1/sys/health
```

## Data Persistence

Data is persisted in the following locations:

- **PostgreSQL**: `./data/postgres` (host volume)
- **PgAdmin**: `pgadmin_data` (named volume)
- **Vault**: In-memory (dev mode) - not persisted

For production, configure Vault with persistent storage.

## Support

For issues or questions:
1. Check the logs: `docker compose logs -f`
2. Review this documentation
3. Check the GitHub repository issues
4. Contact the development team

## Version Information

- Docker Compose File Version: 3.8
- PostgreSQL: 16-alpine
- Vault: 1.19
- Nginx: 1.27-alpine
- Go Backend: Built from source