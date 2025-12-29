# Staging Environment Setup Guide

This guide walks you through setting up automated deployments to Oracle Cloud + Cloudflare Pages.

## Architecture

```
GitHub Push → CI (tests) → CD (deploy)
                              ↓
              ┌───────────────┴───────────────┐
              ↓                               ↓
      Oracle Cloud VM               Cloudflare Pages
      (Backend, DB, Redis,          (Admin Dashboard,
       n8n, Widget CDN)              Customer Dashboard)
```

## Part 1: Oracle Cloud Setup

### 1.1 Create Oracle Cloud Account
1. Go to [cloud.oracle.com](https://cloud.oracle.com)
2. Sign up for free tier (requires credit card for verification, won't be charged)
3. Select your home region (choose one close to your users)

### 1.2 Create VM Instance
1. Go to **Compute → Instances → Create Instance**
2. Configure:
   - **Name**: `csai-staging`
   - **Image**: Ubuntu 22.04
   - **Shape**: VM.Standard.A1.Flex (ARM)
     - OCPUs: 4
     - Memory: 24 GB
   - **Networking**: Create new VCN or use default
   - **Add SSH keys**: Upload your public key or generate new

3. Click **Create**

### 1.3 Configure Firewall (Security List)
1. Go to **Networking → Virtual Cloud Networks → [Your VCN]**
2. Click on the **Security List**
3. Add **Ingress Rules**:

| Source CIDR | Protocol | Port | Description |
|-------------|----------|------|-------------|
| 0.0.0.0/0 | TCP | 22 | SSH |
| 0.0.0.0/0 | TCP | 80 | HTTP |
| 0.0.0.0/0 | TCP | 443 | HTTPS |
| 0.0.0.0/0 | TCP | 5678 | n8n webhooks |

### 1.4 Install Docker on VM
```bash
# SSH into your VM
ssh ubuntu@YOUR_VM_IP

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
sudo apt install -y docker.io docker-compose-plugin

# Add user to docker group
sudo usermod -aG docker $USER

# Log out and back in for group changes to take effect
exit
ssh ubuntu@YOUR_VM_IP

# Verify Docker works
docker --version
docker compose version
```

### 1.5 Clone Repository
```bash
cd ~
git clone https://github.com/TropoEU/CSAIProj.git
cd CSAIProj
```

### 1.6 Configure Environment
```bash
cd docker
cp .env.staging.example .env.staging
nano .env.staging
```

Fill in your values:
```env
DOMAIN=staging.yourdomain.com
API_BASE_URL=https://staging.yourdomain.com
POSTGRES_PASSWORD=<generate-strong-password>
JWT_SECRET=<generate-32-char-string>
N8N_BASIC_AUTH_PASSWORD=<generate-strong-password>
ANTHROPIC_API_KEY=sk-ant-...
```

Generate secure passwords:
```bash
# Generate random password
openssl rand -base64 24

# Generate JWT secret
openssl rand -base64 32
```

### 1.7 Initial Deployment (Manual)
```bash
# Start all services
docker compose -f docker-compose.staging.yml --env-file .env.staging up -d

# Run migrations
docker compose -f docker-compose.staging.yml --env-file .env.staging exec backend npm run migrate

# Check logs
docker compose -f docker-compose.staging.yml --env-file .env.staging logs -f
```

---

## Part 2: Domain & DNS Setup

### 2.1 Point DNS to Oracle Cloud
Add these A records in your DNS provider:

| Record | Type | Value |
|--------|------|-------|
| staging | A | YOUR_ORACLE_VM_IP |
| customer.staging | A | YOUR_ORACLE_VM_IP |
| n8n.staging | A | YOUR_ORACLE_VM_IP |
| widget.staging | A | YOUR_ORACLE_VM_IP |

Wait for DNS propagation (can take up to 24h, usually faster).

### 2.2 Test HTTPS
Caddy automatically provisions SSL certificates. Test:
```bash
curl https://staging.yourdomain.com/health
```

---

## Part 3: Cloudflare Pages Setup

### 3.1 Admin Dashboard
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → **Pages**
2. Click **Create a project** → **Connect to Git**
3. Select your GitHub repo: `TropoEU/CSAIProj`
4. Configure build:

| Setting | Value |
|---------|-------|
| Project name | `csai-admin` |
| Production branch | `main` |
| Build command | `cd frontend/admin && npm install && npm run build` |
| Build output directory | `frontend/admin/dist` |
| Root directory | `/` |

5. Add **Environment Variables**:
   - `VITE_API_URL` = `https://staging.yourdomain.com`

6. Click **Save and Deploy**

### 3.2 Customer Dashboard
Repeat the same process:

| Setting | Value |
|---------|-------|
| Project name | `csai-customer` |
| Build command | `cd frontend/customer && npm install && npm run build` |
| Build output directory | `frontend/customer/dist` |

Environment variable: `VITE_API_URL` = `https://staging.yourdomain.com`

### 3.3 Custom Domains (Optional)
1. In each Cloudflare Pages project, go to **Custom domains**
2. Add your domains:
   - Admin: `admin.staging.yourdomain.com`
   - Customer: `customer.staging.yourdomain.com`

### 3.4 Get Deploy Hooks (Optional)
For automatic deploys triggered by GitHub:
1. Go to **Settings → Builds & deployments → Deploy hooks**
2. Create a hook for each project
3. Save the URLs for GitHub Secrets

---

## Part 4: GitHub Secrets Configuration

Go to **GitHub → Repository Settings → Secrets and variables → Actions**

### Required Secrets

| Secret Name | Value | Description |
|-------------|-------|-------------|
| `STAGING_HOST` | `123.45.67.89` | Oracle Cloud VM public IP |
| `STAGING_USER` | `ubuntu` | SSH username |
| `STAGING_SSH_KEY` | `-----BEGIN OPENSSH...` | Private SSH key (full content) |
| `STAGING_API_URL` | `https://staging.yourdomain.com` | API URL for frontend builds |

### Optional Secrets (for Cloudflare deploy hooks)

| Secret Name | Value |
|-------------|-------|
| `CLOUDFLARE_DEPLOY_HOOK_ADMIN` | `https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/...` |
| `CLOUDFLARE_DEPLOY_HOOK_CUSTOMER` | `https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/...` |

### How to Get SSH Private Key
```bash
# On your local machine
cat ~/.ssh/id_rsa
# Or if using ed25519:
cat ~/.ssh/id_ed25519

# Copy the ENTIRE output including:
# -----BEGIN OPENSSH PRIVATE KEY-----
# ...
# -----END OPENSSH PRIVATE KEY-----
```

---

## Part 5: Test Automated Deployment

### 5.1 Make a Small Change
```bash
# On your local machine
echo "// test" >> backend/src/index.js
git add .
git commit -m "Test deployment"
git push origin main
```

### 5.2 Watch the Action
1. Go to **GitHub → Actions**
2. Watch **CI** workflow run
3. After CI passes, **Deploy to Staging** should trigger
4. Check the deployment logs

### 5.3 Verify
```bash
curl https://staging.yourdomain.com/health
# Should return: {"status":"healthy",...}
```

---

## Part 6: Manual Deployment (Emergency)

If you need to deploy without CI:

```bash
# SSH into Oracle Cloud VM
ssh ubuntu@YOUR_VM_IP

# Pull latest code
cd ~/CSAIProj
git pull origin main

# Rebuild and restart
cd docker
docker compose -f docker-compose.staging.yml --env-file .env.staging up -d --build

# Run migrations
docker compose -f docker-compose.staging.yml --env-file .env.staging exec backend npm run migrate
```

Or trigger via GitHub Actions manually:
1. Go to **Actions → Deploy to Staging**
2. Click **Run workflow**
3. Optionally check "Skip CI check" for force deploy

---

## Troubleshooting

### SSH Connection Failed
```bash
# Verify SSH key is correct
ssh -i ~/.ssh/id_rsa ubuntu@YOUR_VM_IP -v

# Check Oracle Cloud firewall allows port 22
```

### Docker Build Fails
```bash
# Check Docker logs on VM
docker compose -f docker-compose.staging.yml --env-file .env.staging logs backend
```

### Caddy SSL Issues
```bash
# Check Caddy logs
docker compose -f docker-compose.staging.yml --env-file .env.staging logs caddy

# Common issue: DNS not propagated yet
# Wait and try again
```

### Database Connection Issues
```bash
# Check Postgres is running
docker compose -f docker-compose.staging.yml --env-file .env.staging ps

# Check backend can reach postgres
docker compose -f docker-compose.staging.yml --env-file .env.staging exec backend node -e "require('./src/db.js').query('SELECT 1').then(console.log)"
```

---

## Useful Commands

```bash
# View all logs
docker compose -f docker-compose.staging.yml --env-file .env.staging logs -f

# Restart specific service
docker compose -f docker-compose.staging.yml --env-file .env.staging restart backend

# View running containers
docker compose -f docker-compose.staging.yml --env-file .env.staging ps

# Enter container shell
docker compose -f docker-compose.staging.yml --env-file .env.staging exec backend sh

# View disk usage
df -h

# View Docker disk usage
docker system df
```
