# CSAI Deployment Guide

This guide covers deploying the CSAI platform to a staging/production environment.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Caddy (Reverse Proxy)                    │
│                    Automatic HTTPS via Let's Encrypt             │
├─────────────────────────────────────────────────────────────────┤
│   /api/*     │  /widget.js  │   Admin UI   │   Customer UI      │
│   /chat/*    │              │              │   (subdomain)      │
└──────┬───────┴──────┬───────┴──────┬───────┴──────┬─────────────┘
       │              │              │              │
       ▼              ▼              ▼              ▼
   ┌────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
   │Backend │   │  Widget  │   │  Admin   │   │ Customer │
   │  API   │   │  (nginx) │   │  (nginx) │   │  (nginx) │
   └───┬────┘   └──────────┘   └──────────┘   └──────────┘
       │
       ├─────────────┬─────────────┐
       ▼             ▼             ▼
   ┌────────┐   ┌────────┐   ┌────────┐
   │Postgres│   │ Redis  │   │  n8n   │
   └────────┘   └────────┘   └────────┘
```

## Free Hosting Option: Oracle Cloud Free Tier

Oracle Cloud offers a genuinely free tier with enough resources to run the entire stack:

- **2 AMD VMs** (1GB RAM each) OR **4 ARM VMs** (24GB total RAM)
- **200GB block storage**
- **Always free** (not a trial)

### Oracle Cloud Setup Steps

1. Sign up at [cloud.oracle.com](https://cloud.oracle.com)
2. Create a VM instance:
   - Shape: VM.Standard.A1.Flex (ARM) with 4 OCPU, 24GB RAM
   - Image: Ubuntu 22.04
   - Add SSH keys
3. Configure Security List (firewall):
   - Allow TCP 80 (HTTP)
   - Allow TCP 443 (HTTPS)
   - Allow TCP 22 (SSH)
4. SSH into the VM and install Docker:
   ```bash
   sudo apt update && sudo apt install -y docker.io docker-compose
   sudo usermod -aG docker $USER
   ```

## Deployment Steps

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/CSAIProj.git
cd CSAIProj
```

### 2. Configure Environment

```bash
cd docker
cp .env.staging.example .env.staging
nano .env.staging  # Edit with your values
```

Required environment variables:
- `DOMAIN` - Your domain (e.g., `staging.yourapp.com`)
- `POSTGRES_PASSWORD` - Strong database password
- `JWT_SECRET` - Random 32+ character string
- `N8N_BASIC_AUTH_PASSWORD` - n8n admin password
- `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` - LLM API key

### 3. Set Up DNS

Point these DNS records to your server IP:

| Record | Type | Value |
|--------|------|-------|
| `staging.yourapp.com` | A | YOUR_SERVER_IP |
| `customer.staging.yourapp.com` | A | YOUR_SERVER_IP |
| `n8n.staging.yourapp.com` | A | YOUR_SERVER_IP |
| `widget.staging.yourapp.com` | A | YOUR_SERVER_IP |

### 4. Deploy

```bash
# From the docker/ directory
docker-compose -f docker-compose.staging.yml --env-file .env.staging up -d --build
```

### 5. Run Migrations

```bash
docker-compose -f docker-compose.staging.yml exec backend npm run migrate
```

### 6. Verify Deployment

- Admin Dashboard: `https://staging.yourapp.com`
- Customer Dashboard: `https://customer.staging.yourapp.com`
- n8n: `https://n8n.staging.yourapp.com`
- API Health: `https://staging.yourapp.com/health`
- Widget: `https://staging.yourapp.com/widget.js`

## CI/CD with GitHub Actions

Add to `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Staging

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to server
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.STAGING_HOST }}
          username: ${{ secrets.STAGING_USER }}
          key: ${{ secrets.STAGING_SSH_KEY }}
          script: |
            cd /home/ubuntu/CSAIProj
            git pull origin main
            cd docker
            docker-compose -f docker-compose.staging.yml --env-file .env.staging up -d --build
            docker-compose -f docker-compose.staging.yml exec -T backend npm run migrate
```

Required GitHub Secrets:
- `STAGING_HOST` - Server IP address
- `STAGING_USER` - SSH username (e.g., `ubuntu`)
- `STAGING_SSH_KEY` - Private SSH key

## Widget Deployment Options

### Option 1: Self-Hosted (Included)
The widget is served from `https://yourdomain.com/widget.js` automatically.

### Option 2: CDN (Cloudflare R2, S3)
For better global performance:

```bash
# Build widget locally
cd frontend/widget
npm run build

# Upload to Cloudflare R2 or S3
# Configure CORS headers for your bucket
```

### Option 3: Cloudflare Pages (Free)
1. Connect GitHub repo to Cloudflare Pages
2. Build settings:
   - Build command: `cd frontend/widget && npm install && npm run build`
   - Output directory: `frontend/widget/dist`
3. Set environment variable: `VITE_API_URL=https://staging.yourapp.com`

## Monitoring & Logs

```bash
# View all logs
docker-compose -f docker-compose.staging.yml logs -f

# View specific service logs
docker-compose -f docker-compose.staging.yml logs -f backend

# Check service health
docker-compose -f docker-compose.staging.yml ps
```

## Backup Strategy

### Database Backup
```bash
# Create backup
docker-compose -f docker-compose.staging.yml exec postgres pg_dump -U csai_user csai_staging > backup_$(date +%Y%m%d).sql

# Restore backup
cat backup_20240101.sql | docker-compose -f docker-compose.staging.yml exec -T postgres psql -U csai_user csai_staging
```

### n8n Workflows
Export workflows from n8n UI and store in `n8n-workflows/` directory.

## Scaling Considerations

For production with higher traffic:

1. **Database**: Move to managed Postgres (Supabase, Neon, RDS)
2. **Redis**: Use managed Redis (Upstash, ElastiCache)
3. **LLM**: Consider response caching to reduce API costs
4. **CDN**: Put widget behind Cloudflare for global distribution

## Troubleshooting

### Container won't start
```bash
docker-compose -f docker-compose.staging.yml logs backend
```

### Database connection issues
```bash
docker-compose -f docker-compose.staging.yml exec backend node -e "require('./src/db.js').query('SELECT 1')"
```

### SSL certificate issues
Caddy handles SSL automatically. Check logs:
```bash
docker-compose -f docker-compose.staging.yml logs caddy
```

### Reset everything
```bash
docker-compose -f docker-compose.staging.yml down -v  # WARNING: Deletes all data
docker-compose -f docker-compose.staging.yml up -d --build
```
