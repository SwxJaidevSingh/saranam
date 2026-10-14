# Deploying CV Raman Health on DigitalOcean — Complete Guide

**Audience:** whoever ships this app to production (probably you).
**Assumes:** basic Linux / SSH comfort; you have a DigitalOcean account and a domain (Namecheap/GoDaddy/Cloudflare/etc.).
**Outcome:** a working, HTTPS-secured deploy at `https://your-domain.com` with managed Postgres, automated backups, and a restart-safe process manager.

---

## 0. What we're deploying — architecture

```
 Browser  ─HTTPS→  Nginx ─┬─  /api/* ─→ Gunicorn ──→ Flask (Python 3.12)
                          │                            └── scheduler, SMTP, Cloudinary
                          └─  /*     ─→ static files (frontend/dist, built by Vite)

 Flask ─PG─→ Postgres (DO Managed / Neon / self-hosted)
 Flask ─HTTPS→ Cloudinary (doctor signature uploads)
 Flask ─SMTP→ Gmail (appointment reminders)
```

- **Backend:** Flask 3 + SQLAlchemy + APScheduler, served by Gunicorn under systemd.
- **Frontend:** Vite + React, built to `frontend/dist/`, served by Nginx as static files.
- **Database:** Postgres — today uses **Neon** (`backend/backup_db.sh` confirms), can move to DO Managed Postgres if you want one-vendor ops.
- **Secrets:** `backend/.env` (gitignored) + environment variables set on the droplet.
- **Background scheduler:** in-process via `BackgroundScheduler(daemon=True)` in `app/reminders/scheduler.py`. **Must run single Gunicorn worker** to avoid duplicate scheduled jobs (see §4.7).

---

## 1. Pre-flight — decisions to make BEFORE you provision

### 1.1 Hosting path — pick one

| | **Droplet (VPS)** — recommended | **App Platform (PaaS)** — fastest |
|---|---|---|
| Monthly cost (baseline) | ~$12 droplet + ~$15 managed PG = **$27** | ~$12 web + $12 worker + $15 PG = **$39** |
| Setup time | ~2 hours | ~30 min |
| Root control | Full | Limited (no SSH into the app) |
| Cron/scheduler | Single worker + APScheduler | Needs separate "worker" service |
| SSL | Certbot (free, manual renew cron) | Automatic |
| Best for | Healthcare, PII workloads, long-term cost | Prototyping, non-critical apps |

**This guide focuses on the Droplet path.** See §7 at the end for the App Platform shortcut.

### 1.2 Database — pick one

**Option A: Keep Neon (what you use today)** — recommended. No migration work. Free tier is generous; pay-as-you-grow. Already configured in `backend/backup_db.sh`.

**Option B: Move to DigitalOcean Managed Postgres** — one-vendor billing, same-VPC latency (if both in same DO region), daily snapshots out of the box. ~$15/month minimum. Requires one-time dump + restore.

### 1.3 Domain — have one ready

Buy/own a domain. Examples: `saranam.health`, `cvramanhealth.in`. You'll point an `A` record at the droplet's IP after provisioning.

### 1.4 Secrets — generate these **once**, keep safe forever

Run locally to generate the long-lived secrets. **The ENCRYPTION_KEY is irreversible — if it changes, all encrypted patient PII becomes permanently unreadable. Keep a secure offline copy.**

```bash
# SECRET_KEY + JWT_SECRET_KEY — can be rotated (logs out users)
python3 -c 'import secrets; print("SECRET_KEY=" + secrets.token_urlsafe(64))'
python3 -c 'import secrets; print("JWT_SECRET_KEY=" + secrets.token_urlsafe(64))'

# ENCRYPTION_KEY — Fernet key, NON-rotatable without data re-encryption
python3 -c 'from cryptography.fernet import Fernet; print("ENCRYPTION_KEY=" + Fernet.generate_key().decode())'
```

Save these in a password manager (Bitwarden / 1Password) with clear labels. Treat `ENCRYPTION_KEY` like a medical license — never lose it.

### 1.5 Cloudinary — if you haven't already

Per `MEETING_CHANGES_2026-04-14.md` §5.4:

1. Sign in at https://cloudinary.com/console
2. Dashboard → copy the **"API Environment variable"** line:
   ```
   CLOUDINARY_URL=cloudinary://<api-key>:<api-secret>@<cloud-name>
   ```
3. Save it in your password manager. You'll paste it into the droplet's `.env` later.

If you skip Cloudinary, signature upload silently falls back to base64 storage in the DB (works but bloats rows). Safe to defer.

---

## 2. Provision the droplet

### 2.1 Create the droplet

1. DO Console → **Droplets** → **Create** → **Droplets**.
2. **Region:** Bangalore (BLR1) for lowest latency to Kidwai users.
3. **Image:** Ubuntu **24.04 LTS** x64.
4. **Size:** *Basic* → *Regular with SSD* → **$12/month** (2 GB RAM, 1 vCPU, 50 GB SSD).
   - 141 patients + small team = 2 GB is plenty. Upgrade to 4 GB later if you add heavy reporting.
5. **Auth:** add your SSH key. If you don't have one yet:
   ```bash
   ssh-keygen -t ed25519 -C "you@example.com"
   cat ~/.ssh/id_ed25519.pub   # paste into DO "New SSH Key" dialog
   ```
6. **Hostname:** `saranam-prod-01` (or whatever).
7. **Backups:** tick "Enable Backups" (+20% cost) — weekly snapshot. Non-negotiable for PII.
8. Create. Note the public IPv4 address (e.g. `139.59.xx.xx`).

### 2.2 First-login hardening

SSH in as root once, then immediately create a non-root user and lock root:

```bash
ssh root@139.59.xx.xx

# Create deploy user
adduser deploy                          # set a strong password
usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys

# Lock down SSH
sed -i 's/^#*PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart ssh

# Firewall
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Unattended security updates
apt-get update
apt-get install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades

# Timezone (optional but nice)
timedatectl set-timezone Asia/Kolkata

exit
```

From now on, SSH as `deploy`:

```bash
ssh deploy@139.59.xx.xx
```

### 2.3 Install system packages

```bash
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y \
  python3 python3-venv python3-pip python3-dev \
  build-essential libpq-dev \
  postgresql-client \
  nginx \
  certbot python3-certbot-nginx \
  git curl ca-certificates \
  htop unzip

# Node 20 (for building the frontend)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version   # v20.x
npm --version
```

---

## 3. Database

### 3.1 Path A — keep Neon (do nothing, just note the URL)

Your current Neon URL lives in `backend/backup_db.sh`. Keep it safe. You'll paste it into the droplet's `.env` as `DATABASE_URL`.

Make sure Neon's **IP Allowlist** is either `0.0.0.0/0` (open — fine since the URL contains the password) or add your droplet's public IP.

### 3.2 Path B — DO Managed Postgres

1. DO Console → **Databases** → **Create Database Cluster**.
2. PostgreSQL 16, same region as droplet (BLR1), $15 plan (1 GB RAM, 10 GB).
3. Trusted Sources → add your droplet.
4. **Connection Details** tab → copy the `public` connection string.
5. On your laptop, dump from Neon and restore to DO:
   ```bash
   # Dump (run locally)
   pg_dump "$NEON_URL" --no-owner --no-privileges -Fc -f cvraman.dump

   # Restore to DO
   pg_restore -d "$DO_URL" --no-owner --no-privileges --clean --if-exists cvraman.dump
   ```
6. Smoke-test: `psql "$DO_URL" -c "\dt"` should list all tables.
7. Update `DATABASE_URL` in `.env` (§4.5 below).

---

## 4. Deploy the application

### 4.1 Clone the repo

```bash
cd /home/deploy
git clone https://github.com/<your-org>/cv-raman-health.git
cd cv-raman-health
```

If the repo is private, use a deploy key or HTTPS PAT:
```bash
# Option 1: HTTPS with PAT (simpler)
git clone https://<your-pat>@github.com/<your-org>/cv-raman-health.git

# Option 2: SSH deploy key (cleaner)
ssh-keygen -t ed25519 -f ~/.ssh/deploy_key -N ""
cat ~/.ssh/deploy_key.pub       # Add to GitHub → repo → Settings → Deploy keys
# Add to ~/.ssh/config:
#   Host github-deploy
#       HostName github.com
#       User git
#       IdentityFile ~/.ssh/deploy_key
git clone git@github-deploy:<your-org>/cv-raman-health.git
```

### 4.2 Backend — Python venv + deps

```bash
cd /home/deploy/cv-raman-health/backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
pip install gunicorn     # already in requirements.txt but double-check
deactivate
```

### 4.3 Frontend — API URL config

The React app reads the API base from Vite env vars. Create `frontend/.env.production`:

```bash
cat > /home/deploy/cv-raman-health/frontend/.env.production <<'EOF'
# Frontend is served from the same origin as the backend (via Nginx reverse proxy)
# so relative /api works — no absolute URL needed.
VITE_API_URL=/api
VITE_API_BASE_URL=
EOF
```

(Note: `src/api/client.js` uses `VITE_API_URL`; `src/api/cohorts.js` uses `VITE_API_BASE_URL`. The above covers both.)

### 4.4 Frontend — build

```bash
cd /home/deploy/cv-raman-health/frontend
npm ci
npm run build
# Output: frontend/dist/  — Nginx will serve this in §4.9
```

### 4.5 Backend — production `.env`

```bash
cd /home/deploy/cv-raman-health/backend
cp .env.example .env      # if .env.example exists; otherwise create fresh
nano .env                 # fill in the values below
```

Minimum required values:

```ini
# ─── Flask / runtime ───
FLASK_ENV=production
FLASK_DEBUG=False
APP_NAME=CV Raman Health Care
APP_VERSION=1.0.0

# ─── Secrets (§1.4 — from password manager) ───
SECRET_KEY=<paste>
JWT_SECRET_KEY=<paste>
ENCRYPTION_KEY=<paste — NEVER rotate>

# ─── JWT lifetimes ───
JWT_ACCESS_TOKEN_EXPIRES=3600
JWT_REFRESH_TOKEN_EXPIRES=2592000

# ─── Database (Neon or DO Managed) ───
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require

# ─── CORS — allow only the production domain ───
CORS_ORIGINS=https://saranam.health,https://www.saranam.health

# ─── Cloudinary (optional but recommended; §1.5) ───
CLOUDINARY_URL=cloudinary://<api-key>:<api-secret>@<cloud-name>

# ─── SMTP (Gmail app password) ───
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-gmail@gmail.com
SMTP_PASSWORD=<16-char app password>
SMTP_FROM_NAME=Saranam Health

# ─── File upload limits ───
MAX_UPLOAD_SIZE_MB=50
MAX_CONTENT_LENGTH=52428800   # 50 MB in bytes
```

Lock permissions:
```bash
chmod 600 backend/.env
```

### 4.6 Run migrations

```bash
cd /home/deploy/cv-raman-health/backend
source venv/bin/activate
export FLASK_APP=run.py
flask db upgrade
# Should print: "Running upgrade ... -> y5z6a7b8c9d0" (or whatever is latest)
deactivate
```

**If the DB is fresh and empty**, also seed an admin:
```bash
source venv/bin/activate
python seed_admin.py
deactivate
# Default creds per run.py: admin@cvraman.health / Admin@123
# Change the password IMMEDIATELY after first login
```

### 4.7 Gunicorn + systemd service

Create a systemd unit at `/etc/systemd/system/cvraman-backend.service`:

```bash
sudo nano /etc/systemd/system/cvraman-backend.service
```

Paste:

```ini
[Unit]
Description=CV Raman Health — Flask backend (Gunicorn)
After=network.target

[Service]
Type=notify
User=deploy
Group=deploy
WorkingDirectory=/home/deploy/cv-raman-health/backend
Environment="PATH=/home/deploy/cv-raman-health/backend/venv/bin"
EnvironmentFile=/home/deploy/cv-raman-health/backend/.env

# ───────────────────────────────────────────────────────────
# IMPORTANT: single worker because APScheduler runs in-process.
# Multiple workers = duplicate reminder sends. If you outgrow one
# worker, split the scheduler into its own systemd service.
# ───────────────────────────────────────────────────────────
ExecStart=/home/deploy/cv-raman-health/backend/venv/bin/gunicorn \
    --workers 1 \
    --threads 4 \
    --timeout 120 \
    --bind 127.0.0.1:5002 \
    --access-logfile - \
    --error-logfile - \
    run:app

Restart=on-failure
RestartSec=5
LimitNOFILE=4096

[Install]
WantedBy=multi-user.target
```

> Why 1 worker × 4 threads: Flask's GIL-bound work handles 4-concurrent IO nicely; scheduler stays singleton; memory footprint ~200 MB. If throughput becomes a bottleneck later, split the scheduler to its own service and bump workers.

Enable + start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable cvraman-backend
sudo systemctl start cvraman-backend
sudo systemctl status cvraman-backend     # should be "active (running)"

# Smoke test
curl http://127.0.0.1:5002/health
# → {"app":"CV Raman Health Care","status":"healthy","version":"1.0.0"}
```

### 4.8 (If you split the scheduler to its own service — optional, for scale)

If you ever need to run multiple Gunicorn workers, move the scheduler out. Create `/home/deploy/cv-raman-health/backend/run_scheduler.py`:

```python
"""Standalone reminder scheduler (production)."""
import time
from app import create_app

app = create_app('production')
with app.app_context():
    # init_scheduler already called inside create_app
    print("Scheduler running. Ctrl-C to stop.")
    while True:
        time.sleep(60)
```

Then a second systemd unit `/etc/systemd/system/cvraman-scheduler.service` with `ExecStart=... python run_scheduler.py` and `--workers` back up to 2+ in the web unit. Remove the scheduler init from the web app in `app/__init__.py` or guard it on an env var.

**Skip this for v1** — single worker is fine for Kidwai-scale traffic.

### 4.9 Nginx — reverse proxy + static frontend

```bash
sudo nano /etc/nginx/sites-available/cvraman
```

Paste (adjust `server_name`):

```nginx
server {
    listen 80;
    server_name saranam.health www.saranam.health;

    # Redirect all HTTP → HTTPS (Certbot will modify this block later,
    # but the redirect stays.)
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name saranam.health www.saranam.health;

    # Certbot fills in ssl_certificate + ssl_certificate_key in §4.10.

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Upload limit matches Flask's 50 MB
    client_max_body_size 50M;

    # ── React SPA (static build) ──
    root /home/deploy/cv-raman-health/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;   # SPA fallback
    }

    # Long cache for hashed assets; Vite adds content-hash suffixes
    location /assets/ {
        expires 1y;
        access_log off;
        add_header Cache-Control "public, immutable";
    }

    # ── API → Gunicorn ──
    location /api/ {
        proxy_pass http://127.0.0.1:5002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        proxy_connect_timeout 10s;
    }

    # Health check (for DO monitoring)
    location /health {
        proxy_pass http://127.0.0.1:5002/health;
        access_log off;
    }
}
```

Enable + test + reload:

```bash
sudo ln -s /etc/nginx/sites-available/cvraman /etc/nginx/sites-enabled/cvraman
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t          # must print "syntax is ok"
sudo systemctl reload nginx
```

### 4.10 DNS + SSL

1. In your domain registrar (Namecheap/GoDaddy/Cloudflare), create:
   - `A` record: `@` → `139.59.xx.xx`
   - `A` record: `www` → `139.59.xx.xx`
   Wait 1–10 min for propagation. Verify:
   ```bash
   dig +short saranam.health
   # → 139.59.xx.xx
   ```

2. Issue Let's Encrypt certificate via Certbot:
   ```bash
   sudo certbot --nginx -d saranam.health -d www.saranam.health
   # Enter email, agree to ToS, pick "redirect HTTP → HTTPS"
   ```
   Certbot edits the Nginx config in place and sets up a renewal timer. Verify:
   ```bash
   sudo certbot renew --dry-run
   # → "Congratulations, all simulated renewals succeeded"
   ```

3. Hit `https://saranam.health` — React app should load, login should work.

---

## 5. Post-deploy hygiene

### 5.1 Change default admin password

Visit `https://saranam.health` → log in with `admin@cvraman.health` / `Admin@123` → **immediately change password** from the admin profile page.

### 5.2 Verify encryption

```bash
# In the droplet
cd /home/deploy/cv-raman-health/backend
source venv/bin/activate
python -c "
from app import create_app
from app.patients.models import Patient
app = create_app('production')
with app.app_context():
    p = Patient.query.first()
    if p and p.abha_id_encrypted:
        print('Encryption works →', p.get_abha_id()[:6] + '…')
    else:
        print('No encrypted data yet')
"
```

If the decryption fails, your `ENCRYPTION_KEY` doesn't match what was used when the data was encrypted. **Stop and investigate before proceeding** — rotating the key won't help, you need the original.

### 5.3 Monitoring

**DO built-in:**
- Droplet dashboard → *Graphs* tab → CPU, memory, disk, bandwidth.
- *Monitoring* → create alerts for CPU > 80%, memory > 85%, disk > 85%, droplet down.

**App-level (optional):**
- Free tier Sentry / Rollbar for JS + Python error tracking.
- Better Uptime / UptimeRobot pinging `/health` every minute.

### 5.4 Log locations

| What | Where | Rotate |
|---|---|---|
| Nginx access | `/var/log/nginx/access.log` | logrotate default |
| Nginx error | `/var/log/nginx/error.log` | logrotate default |
| Gunicorn stdout/stderr | `journalctl -u cvraman-backend -f` | systemd-journald caps at 4 GB default |
| Systemd errors | `journalctl -u cvraman-backend --since today` | — |

Tail in real time:
```bash
sudo journalctl -u cvraman-backend -f
```

### 5.5 Firewall

Already configured in §2.2 (ufw: SSH + 80 + 443). Verify:
```bash
sudo ufw status
```

### 5.6 Cron-style checks

Add to `deploy` user's crontab (`crontab -e`):

```cron
# Nightly DB dump to DO Spaces (after §6 is set up)
0 3 * * *  /home/deploy/cv-raman-health/scripts/backup_to_spaces.sh

# Weekly vacuum analyze (for Neon skip — they auto-vacuum)
0 4 * * 0  psql $DATABASE_URL -c "VACUUM ANALYZE"
```

---

## 6. Backups + disaster recovery

**The $20/mo question: are your backups tested?** Untested backups = no backups.

### 6.1 Backup layers

| Layer | Frequency | Tool | Retention |
|---|---|---|---|
| DO droplet snapshot | Weekly (§2.1 backups toggle) | DO built-in | 4 weeks |
| Postgres dump | Nightly | `pg_dump` | 30 days rolling on Spaces |
| Neon PITR (if Neon) | Built-in 7–30 day window | Neon | per plan |
| Source code | Git remote | GitHub / GitLab | forever |
| Cloudinary assets | Built-in | Cloudinary | forever |

### 6.2 Automated Postgres → DO Spaces dump

**Create a Space** (Spaces is DO's S3-compatible object storage, $5/mo for 250 GB):
1. DO Console → **Spaces Object Storage** → Create Space in your region.
2. Generate a Space **access key** and **secret**.

**Install `s3cmd`:**
```bash
sudo apt-get install -y s3cmd
s3cmd --configure
# Access key: <from DO>
# Secret: <from DO>
# Region: e.g. blr1
# Endpoint: blr1.digitaloceanspaces.com
# DNS-style: %(bucket)s.blr1.digitaloceanspaces.com
# Test access → yes
# Save config → yes
```

**Backup script** `/home/deploy/cv-raman-health/scripts/backup_to_spaces.sh`:

```bash
#!/bin/bash
set -e -o pipefail

source /home/deploy/cv-raman-health/backend/.env
export DATABASE_URL

TS=$(date +"%Y%m%d_%H%M%S")
TMPDIR=$(mktemp -d)
FILE="$TMPDIR/cvraman_$TS.sql.gz"

pg_dump "$DATABASE_URL" --no-owner --no-privileges | gzip -9 > "$FILE"

# Upload to Spaces
s3cmd put "$FILE" "s3://cvraman-backups/postgres/$(basename $FILE)"

# Local cleanup — Spaces is the source of truth
rm -rf "$TMPDIR"

# Prune Spaces objects older than 30 days
CUTOFF=$(date -d "30 days ago" +%Y%m%d)
s3cmd ls s3://cvraman-backups/postgres/ | awk '{print $4}' | while read obj; do
    fname=$(basename "$obj")
    # Extract date portion from cvraman_YYYYMMDD_HHMMSS.sql.gz
    date_part=$(echo "$fname" | grep -oE '[0-9]{8}' | head -1)
    if [[ -n "$date_part" && "$date_part" < "$CUTOFF" ]]; then
        s3cmd del "$obj"
    fi
done
```

Make executable + add to cron (§5.6).

### 6.3 Test restore quarterly

```bash
# Download latest
LATEST=$(s3cmd ls s3://cvraman-backups/postgres/ | tail -1 | awk '{print $4}')
s3cmd get "$LATEST" /tmp/restore_test.sql.gz

# Create a throwaway DB (on a separate test instance — NEVER the prod DB)
gunzip -c /tmp/restore_test.sql.gz | psql "$TEST_DATABASE_URL"

# Smoke-query
psql "$TEST_DATABASE_URL" -c "SELECT COUNT(*) FROM patients;"
```

Put this on a calendar reminder every 3 months.

---

## 7. DigitalOcean App Platform — the shortcut alternative

Skip droplet entirely. Uses a `.do/app.yaml` spec in the repo.

Create `.do/app.yaml` at the repo root:

```yaml
name: cvraman-health
region: blr
services:
  - name: backend
    source_dir: /backend
    github:
      repo: your-org/cv-raman-health
      branch: main
    build_command: pip install -r requirements.txt
    run_command: gunicorn --workers 1 --threads 4 --bind 0.0.0.0:8080 run:app
    http_port: 8080
    instance_count: 1
    instance_size_slug: basic-xs
    health_check:
      http_path: /health
    envs:
      - { key: FLASK_ENV,         value: production }
      - { key: DATABASE_URL,      value: ${cvraman-db.DATABASE_URL} }
      - { key: SECRET_KEY,        type: SECRET }
      - { key: JWT_SECRET_KEY,    type: SECRET }
      - { key: ENCRYPTION_KEY,    type: SECRET }
      - { key: CLOUDINARY_URL,    type: SECRET }
      - { key: SMTP_HOST,         value: smtp.gmail.com }
      - { key: SMTP_PORT,         value: "587" }
      - { key: SMTP_USERNAME,     type: SECRET }
      - { key: SMTP_PASSWORD,     type: SECRET }
      - { key: CORS_ORIGINS,      value: https://${APP_DOMAIN} }

static_sites:
  - name: frontend
    source_dir: /frontend
    github:
      repo: your-org/cv-raman-health
      branch: main
    build_command: npm ci && npm run build
    output_dir: dist
    routes:
      - path: /
    envs:
      - { key: VITE_API_URL,       value: /api }
      - { key: VITE_API_BASE_URL,  value: "" }

databases:
  - name: cvraman-db
    engine: PG
    version: "16"
    size: db-s-1vcpu-1gb
    num_nodes: 1
```

Deploy: DO Console → **Apps** → **Create App** → connect your GitHub → DO detects `.do/app.yaml` → review → Deploy. Then paste in each `SECRET` value.

Limitations to know:
- Scheduler runs in the web service — fine at 1 instance, but DO's autoscaling can spin up duplicates. Pin `instance_count: 1` and never let it autoscale.
- No SSH into the app — you ship migrations via the `build_command` or a pre-deploy job.
- Costs creep faster than a droplet as you add services.

---

## 8. Ops runbook (your future self will thank you)

### 8.1 Deploy a new version

```bash
ssh deploy@139.59.xx.xx
cd /home/deploy/cv-raman-health

# Pull latest
git pull

# Backend
cd backend
source venv/bin/activate
pip install -r requirements.txt       # no-op if unchanged
flask db upgrade                      # apply any new migrations
deactivate

# Frontend
cd ../frontend
npm ci
npm run build

# Reload backend (graceful, zero downtime with Gunicorn)
sudo systemctl reload cvraman-backend
# If reload unsupported for your service type, use:  sudo systemctl restart cvraman-backend

# Nginx picks up the new frontend/dist automatically — no restart needed
```

Put this in `scripts/deploy.sh` for one-command deploys.

### 8.2 Rollback

```bash
# Revert to last good git tag
git checkout <last-good-sha>

# Re-run the deploy dance
cd backend && source venv/bin/activate && pip install -r requirements.txt && flask db upgrade && deactivate
cd ../frontend && npm ci && npm run build
sudo systemctl restart cvraman-backend
```

If the migration is the problem, also run `flask db downgrade <rev>`. Test this in staging first.

### 8.3 "The site is down"

```bash
# 1. Is Gunicorn alive?
sudo systemctl status cvraman-backend
# If dead:  sudo systemctl restart cvraman-backend

# 2. Nginx?
sudo systemctl status nginx
sudo nginx -t && sudo systemctl reload nginx

# 3. DB reachable?
psql "$DATABASE_URL" -c "SELECT 1"

# 4. Disk full?
df -h

# 5. Out of memory?
free -h
journalctl -u cvraman-backend --since "10 minutes ago" | grep -i "killed\|oom\|memory"

# 6. Logs
journalctl -u cvraman-backend -n 200
tail -n 100 /var/log/nginx/error.log
```

### 8.4 Scale up

- Droplet vertical scale: DO Console → droplet → *Resize*. Takes ~5 min downtime.
- If scheduler becomes bottleneck: split to its own systemd service (§4.8) and bump Gunicorn workers.
- If DB is bottleneck: upgrade Neon/DO PG plan, add indexes based on slow-query log.

### 8.5 Common gotchas

| Symptom | Cause | Fix |
|---|---|---|
| 502 Bad Gateway | Gunicorn crashed | `sudo systemctl restart cvraman-backend` and check logs |
| 413 Request Entity Too Large | Upload bigger than limit | Bump `client_max_body_size` in Nginx and `MAX_CONTENT_LENGTH` in `.env`, then reload both |
| CORS errors in console | `CORS_ORIGINS` doesn't match | Update `.env` → restart backend |
| Login works but 401 on every API call | Clock drift kills JWT validation | `sudo timedatectl set-ntp true` |
| "Failed to decrypt" errors | `ENCRYPTION_KEY` changed | Restore the original key from your vault — **never** rotate |
| Duplicate reminder emails | Multiple Gunicorn workers | Keep `--workers 1` unless scheduler is split out |
| Slow API after a year | DB stats stale | `psql -c "VACUUM ANALYZE"` monthly |

---

## 9. Healthcare / compliance notes

This app stores **PII** (patient names, phone numbers, addresses) and **PHI** (diagnoses, prescriptions, death records). Even if you're not under HIPAA (India), **India's DPDPA 2023** applies.

Minimum controls this deploy already gives you:
- ✅ HTTPS everywhere (Certbot)
- ✅ Encryption at rest for sensitive fields (ENCRYPTION_KEY, see `app/patients/models.py`)
- ✅ Password hashing (bcrypt via passlib)
- ✅ JWT with short access tokens + refresh
- ✅ Database network-isolated (Neon or DO managed — no public IP by default)
- ✅ Daily off-box backups (§6)
- ✅ SSH key-only login, firewall

Things to add before real patient traffic:
- [ ] Written data-processing agreement with Kidwai hospital
- [ ] Audit log for who accessed which patient record (partially exists in `app/audit/` — verify it's wired up)
- [ ] Incident response runbook (who to call if the droplet is compromised)
- [ ] Periodic `pip-audit` + `npm audit` in CI
- [ ] Log scrubbing — don't log PII in application logs

---

## 10. Cost summary

| Line item | Monthly |
|---|---|
| Droplet (2 GB, BLR1) | $12 |
| Droplet weekly backups | $2.40 |
| Spaces (250 GB) | $5 |
| Neon Postgres (free tier works for 141 patients) | $0 |
| Domain (.health, .in) | ~$1–3 |
| **Minimum total** | **~$20/mo** |

Bump to ~$35/mo if you go DO Managed PG instead of Neon.

---

## 11. Ship checklist

Copy this into a GitHub issue when you're ready to go live:

- [ ] Secrets generated and stored in password manager (especially ENCRYPTION_KEY)
- [ ] Droplet created, hardened (§2.2)
- [ ] Domain A records point to droplet IP
- [ ] System packages installed (§2.3)
- [ ] Repo cloned, venv + npm ci done (§4.1–4.4)
- [ ] `backend/.env` filled + `chmod 600` (§4.5)
- [ ] `flask db upgrade` ran successfully (§4.6)
- [ ] `seed_admin.py` ran, admin password CHANGED from default (§5.1)
- [ ] Cloudinary creds in `.env` (or explicitly deferred)
- [ ] Gunicorn systemd service running (§4.7)
- [ ] Nginx config + SSL issued (§4.9, §4.10)
- [ ] `https://saranam.health/health` returns 200
- [ ] Tested login → create patient → record PPS → download prescription PDF
- [ ] DO Spaces created, backup script scheduled (§6.2)
- [ ] **Tested a DB restore into a staging DB** (§6.3)
- [ ] Monitoring alerts set (§5.3)
- [ ] Weekly droplet snapshot enabled
- [ ] `CORS_ORIGINS` hardened to only your domain
- [ ] `.env` excluded from git (double-check `.gitignore`)
- [ ] Walkthrough session scheduled with Kidwai team

---

## Appendix A — troubleshooting a fresh Postgres migration error

If `flask db upgrade` fails on a fresh DB with "relation does not exist" or similar:

1. Check `DATABASE_URL` is correct: `psql "$DATABASE_URL" -c "SELECT 1"`.
2. If DB has partial tables from manual experimentation, either:
   - Stamp latest: `flask db stamp head` (declares "we're at latest" without running migrations — ONLY if the schema already matches).
   - Or drop + recreate: `flask db downgrade base && flask db upgrade` (nuclear; loses data).
3. If migrations conflict with an earlier `db.create_all()`, you may need to manually delete the `alembic_version` row and re-stamp. Do this only after backing up.

## Appendix B — local-parity pattern for developers

Developers joining the team should mirror the prod stack locally:
- Python 3.12 venv at `backend/venv/`
- Postgres 16 (use Docker: `docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=dev postgres:16`)
- Node 20 + `npm ci`
- A `backend/.env` with dev values (NOT prod keys)
- Run `python run.py` for backend, `npm run dev` for frontend

No secret leaves the droplet. Developers use their own keys in dev.

---

**Questions that'll come up:**
- *Can we skip Cloudinary?* Yes — signatures fall back to base64 in DB. Costs row size, not functionality.
- *Can we skip the custom domain for v1?* Yes — droplet IP works, but Certbot needs a domain. For IP-only, use self-signed certs (users see warnings; fine for internal-only pilot).
- *What if we want to bring Postgres onto the droplet?* Add `sudo apt install postgresql-16`, set up a role, and change `DATABASE_URL` to `postgresql://cvraman:pass@localhost:5432/cvraman`. Cheaper, but now you own the backup and tuning. Recommend keeping it managed unless you have a DBA.
- *How do we handle staff rotation?* Deactivate users via the admin UI (`/users` page); they can no longer log in. Old audit trail remains for compliance.
