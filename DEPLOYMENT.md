# 🚀 CafeDuo Deployment Guide

> Production deployment instructions for CafeDuo - Social Board Game Platform

---

## 📋 Table of Contents

1. [System Requirements](#system-requirements)
2. [Environment Variables](#environment-variables)
3. [Docker Deployment (Recommended)](#docker-deployment-recommended)
4. [Manual Deployment](#manual-deployment)
5. [Database Setup](#database-setup)
6. [SSL/HTTPS Configuration](#sslhttps-configuration)
7. [Monitoring & Logging](#monitoring--logging)
8. [Troubleshooting](#troubleshooting)

---

## Quick Paths (2026-02-07)

- Fast VPS path (recommended now):
  - `deploy/docker-compose.prod.yml`
  - `deploy/Caddyfile`
  - `deploy/.env.production.example`
  - `docs/deployment_runbook.md`
- CI based VPS deploy path:
  - `.github/workflows/deploy-vps.yml`
  - `scripts/deploy/vds-deploy.sh` (`npm run deploy:vds`)
- Smoke and rollback scripts:
  - `scripts/smoke/prod-smoke.mjs`
  - `deploy/scripts/smoke-vps.sh`
  - `deploy/scripts/rollback.sh`

---

## System Requirements

### Minimum Requirements

| Component | Specification |
|-----------|--------------|
| **OS** | Linux (Ubuntu 20.04+), macOS, or Windows with WSL2 |
| **Node.js** | 20.x LTS or higher |
| **PostgreSQL** | 15.x or higher |
| **RAM** | 2GB minimum, 4GB recommended |
| **Storage** | 10GB free space |
| **Docker** | 24.x or higher (if using Docker) |
| **Docker Compose** | 2.x or higher (if using Docker) |

### Supported Platforms

- **Development**: Local machine with Node.js
- **Production**: Docker Compose, Kubernetes, or VPS/Cloud instances
- **Cloud Providers**: AWS, Google Cloud, Azure, DigitalOcean, Hetzner

---

## Environment Variables

### Quick Setup

```bash
# Copy example environment file
cp .env.example .env

# Edit with your favorite editor
nano .env
```

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Backend server port | `3001` |
| `DATABASE_URL` | PostgreSQL connection string | `postgres://user:pass@localhost:5432/cafeduo` |
| `JWT_SECRET` | Secret key for JWT tokens | Generate with: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `CORS_ORIGIN` | Allowed frontend origins | `https://yourdomain.com` |
| `APP_VERSION` | Build commit/version info for runtime diagnostics | `050548e` |
| `APP_BUILD_TIME` | UTC build timestamp for diagnostics | `2026-02-12T14:00:00Z` |

### Database Configuration

```bash
# Option 1: Full connection string (recommended for production)
DATABASE_URL=postgres://username:password@hostname:5432/database_name

# Option 2: Individual variables (fallback)
DB_USER=postgres
DB_HOST=localhost
DB_NAME=cafeduo
DB_PASSWORD=your_secure_password
DB_PORT=5432
```

### Security Configuration

```bash
# JWT Settings
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# Bcrypt rounds (higher = more secure but slower)
BCRYPT_ROUNDS=10

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000       # Legacy fallback (15 minutes)
RATE_LIMIT_MAX_REQUESTS=600       # Legacy fallback request budget
API_RATE_LIMIT_WINDOW_MS=900000   # Global API limiter window
API_RATE_LIMIT_MAX_REQUESTS=600   # Global API limiter budget
AUTH_RATE_LIMIT_WINDOW_MS=900000  # Auth limiter window
AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS=20
AUTH_REGISTER_RATE_LIMIT_MAX_REQUESTS=10
RATE_LIMIT_STORE=redis            # redis | memory
RATE_LIMIT_REDIS_PREFIX=cafeduo:ratelimit
RATE_LIMIT_PASS_ON_STORE_ERROR=true
```

### Optional Integrations

```bash
# Google OAuth (for social login)
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
ENABLE_GOOGLE_AUTH=true

# reCAPTCHA (for bot protection)
RECAPTCHA_SITE_KEY=your-site-key
RECAPTCHA_SECRET_KEY=your-secret-key
ENABLE_RECAPTCHA=true

# Email (for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@cafeduo.com
```

### Logging Configuration

```bash
LOG_LEVEL=info           # debug, info, warn, error
LOG_FILE=logs/app.log    # Log file path
REQUEST_LOG_SLOW_MS=1200 # Slow request warning threshold (ms)
```

---

## Docker Deployment (Recommended)

### Production Deployment

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/cafeduo.git
cd cafeduo

# 2. Create environment file
cp .env.example .env
# Edit .env with your production values

# 3. Start all services
docker-compose up -d

# 4. Check service status
docker-compose ps

# 5. View logs
docker-compose logs -f
```

### Docker Services Overview

| Service | Container Name | Port | Description |
|---------|---------------|------|-------------|
| Database | `cafeduo-db` | 5432 | PostgreSQL with pgvector |
| Backend API | `cafeduo-api` | 3001 | Node.js Express server |
| Frontend | `cafeduo-web` | 3000 | Nginx serving static files |

### Useful Docker Commands

```bash
# Stop all services
docker-compose down

# Restart a specific service
docker-compose restart api

# View logs for specific service
docker-compose logs -f api

# Rebuild after code changes
docker-compose up -d --build

# Update to latest version
git pull
docker-compose down
docker-compose up -d --build

# Clean up unused volumes
docker volume prune
```

### Docker Build (Manual)

```bash
# Build backend image
docker build -t cafeduo-api -f Dockerfile .

# Build frontend image
docker build -t cafeduo-web -f Dockerfile.web .

# Run containers manually
docker run -d --name cafeduo-api -p 3001:3001 --env-file .env cafeduo-api
docker run -d --name cafeduo-web -p 3000:80 cafeduo-web
```

---

## Manual Deployment

### Backend Setup

```bash
# 1. Navigate to project root
cd /path/to/cafeduo

# 2. Install dependencies
npm install

# 3. Set environment variables
export NODE_ENV=production
export PORT=3001
export DATABASE_URL=postgres://user:pass@localhost:5432/cafeduo
export JWT_SECRET=your-secret-key

# 4. Start the server
npm start

# Or with PM2 for process management
npm install -g pm2
pm2 start backend/server.js --name cafeduo-api
pm2 save
pm2 startup
```

### Frontend Setup

```bash
# 1. Build the application
npm run build

# 2. Serve with Nginx (recommended)
# Copy built files to nginx directory
sudo cp -r dist/* /var/www/cafeduo/

# 3. Nginx configuration
sudo cp nginx.conf /etc/nginx/sites-available/cafeduo
sudo ln -s /etc/nginx/sites-available/cafeduo /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    root /var/www/cafeduo;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css application/javascript application/json;

    # API proxy
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Socket.IO proxy
    location /socket.io {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## Database Setup

### Automatic Setup (Docker)

With Docker Compose, the database schema is automatically applied on first run via `schema.sql` mounted in the container.

### Manual Setup

```bash
# 1. Create database
psql -U postgres -c "CREATE DATABASE cafeduo;"

# 2. Apply schema
psql $DATABASE_URL < schema.sql

# Or with individual credentials
psql -h localhost -U postgres -d cafeduo -f schema.sql
```

### Database Migration (Existing DB)

```bash
# Run migration script (if available)
npm run migrate

# Or manually apply schema.sql - it's idempotent
psql $DATABASE_URL < schema.sql
```

### Backup & Restore

```bash
# Backup
docker exec cafeduo-db pg_dump -U postgres cafeduo > backup_$(date +%Y%m%d).sql

# Restore
docker exec -i cafeduo-db psql -U postgres cafeduo < backup_20240101.sql

# Manual backup
pg_dump $DATABASE_URL > cafeduo_backup.sql

# Manual restore
psql $DATABASE_URL < cafeduo_backup.sql
```

---

## SSL/HTTPS Configuration

### Using Let's Encrypt (Recommended)

```bash
# 1. Install Certbot
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# 2. Obtain certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# 3. Auto-renewal (should be set up automatically)
sudo certbot renew --dry-run
```

### Manual SSL with Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # ... rest of configuration
}

server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

### Docker with SSL (Using Traefik)

```yaml
# docker-compose.ssl.yml
version: '3.8'

services:
  traefik:
    image: traefik:v2.10
    command:
      - "--api.insecure=true"
      - "--providers.docker=true"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.tlschallenge=true"
      - "--certificatesresolvers.letsencrypt.acme.email=you@example.com"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
    ports:
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./letsencrypt:/letsencrypt

  web:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.web.rule=Host(`yourdomain.com`)"
      - "traefik.http.routers.web.tls.certresolver=letsencrypt"
```

---

## Monitoring & Logging

### Health Check Endpoint

```bash
# Check application health
curl http://localhost:3001/health

# Expected response:
# {"uptime":123.45,"message":"OK","timestamp":1700000000000,"database":true}
```

### Smoke Checks

```bash
# Local/remote configurable smoke check (defaults to https://cafeduotr.com)
npm run smoke:prod

# Force live domain check
npm run smoke:live

# VPS-local smoke check (run on server)
bash deploy/scripts/smoke-vps.sh http://127.0.0.1
```

### Log Management

```bash
# View application logs (Docker)
docker-compose logs -f api

# View Nginx access logs
docker-compose logs -f web

# View all logs
docker-compose logs -f

# With PM2
pm2 logs cafeduo-api
pm2 monit
```

### Log Rotation

#### Docker Log Rotation

```json
// /etc/docker/daemon.json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

#### Nginx Log Rotation

```bash
# Edit logrotate config
sudo nano /etc/logrotate.d/nginx

# Add:
/var/log/nginx/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        [ -f /var/run/nginx.pid ] && kill -USR1 `cat /var/run/nginx.pid`
    endscript
}
```

### PM2 Process Management

```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start backend/server.js --name cafeduo-api

# Monitor
pm2 monit

# Logs
pm2 logs cafeduo-api

# Restart
pm2 restart cafeduo-api

# Auto-start on boot
pm2 startup
pm2 save
```

---

## Troubleshooting

### Common Issues

#### Port Already in Use

```bash
# Find process using port
sudo lsof -i :3001
sudo lsof -i :3000

# Kill process
sudo kill -9 <PID>

# Or change port in .env
PORT=3002
```

#### Database Connection Failed

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Start PostgreSQL
sudo systemctl start postgresql

# Check connection
psql $DATABASE_URL -c "SELECT 1;"

# Check Docker database
docker-compose logs db
```

#### CORS Errors

```bash
# Verify CORS_ORIGIN matches your frontend URL
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com

# For development (not recommended for production)
CORS_ORIGIN=*
```

#### JWT Token Errors

```bash
# Generate new JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Update .env
JWT_SECRET=<generated-secret>
```

### Docker-Specific Issues

#### Container Won't Start

```bash
# Check logs
docker-compose logs api

# Check container status
docker-compose ps

# Rebuild without cache
docker-compose build --no-cache

# Clean up
docker system prune -a
```

#### Deploy Succeeded But Login/Realtime Fails

```bash
# 1) Run smoke checks first
bash deploy/scripts/smoke-vps.sh http://127.0.0.1
npm run smoke:prod

# 2) Check API logs for request IDs and 4xx/5xx warnings
docker compose -f deploy/docker-compose.prod.yml --env-file .env logs --tail=200 api

# 3) Ensure frontend and backend share correct origin/socket config
grep -E "CORS_ORIGIN|VITE_API_BASE_URL|VITE_SOCKET_URL|SITE_ADDRESS" .env
```

#### Database Won't Initialize

```bash
# Remove old volume (WARNING: deletes data!)
docker-compose down -v
docker-compose up -d

# Check schema.sql syntax
docker-compose logs db
```

### Performance Issues

#### High Memory Usage

```bash
# Monitor memory
docker stats

# Add swap space
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

#### Slow Database Queries

```bash
# Add indexes (if not present)
psql $DATABASE_URL -c "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);"
psql $DATABASE_URL -c "CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);"
psql $DATABASE_URL -c "CREATE INDEX IF NOT EXISTS idx_user_items_user_id ON user_items(user_id);"
```

### Getting Help

1. Check application logs: `docker-compose logs -f`
2. Verify environment variables: `cat .env`
3. Test database connection: `psql $DATABASE_URL -c "SELECT 1;"`
4. Test health endpoint: `curl http://localhost:3001/health`
5. Review [GitHub Issues](https://github.com/Emin-Emini/cafeduo/issues)

---

## Security Checklist

Before going live, ensure:

- [ ] Changed default JWT_SECRET to a strong random string
- [ ] Set NODE_ENV=production
- [ ] Disabled debug logging (LOG_LEVEL=info)
- [ ] Configured CORS_ORIGIN to specific domains only
- [ ] Enabled rate limiting
- [ ] Set up SSL/HTTPS
- [ ] Changed default database passwords
- [ ] Disabled password authentication for SSH
- [ ] Set up firewall rules (allow only 80, 443, 22)
- [ ] Enabled automatic security updates
- [ ] Set up log monitoring

---

## Deployment Checklist

- [ ] System requirements met
- [ ] Environment variables configured
- [ ] Database schema applied
- [ ] Docker images built successfully
- [ ] Services started without errors
- [ ] Health check endpoint responding
- [ ] Frontend accessible via browser
- [ ] API responding to requests
- [ ] SSL certificate installed
- [ ] Backups configured
- [ ] Smoke checks passed (`npm run smoke:prod` + VPS smoke script)
- [ ] Rollback command validated (`bash deploy/scripts/rollback.sh <deploy_path>`)
- [ ] Monitoring set up
- [ ] Documentation updated

---

## Support

For deployment issues:

1. Check the [Troubleshooting](#troubleshooting) section
2. Review application logs
3. Open an issue on GitHub with:
   - Error messages
   - Environment details
   - Steps to reproduce

---

*Last updated: 2026-02-07*
