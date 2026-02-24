# Secrets Management Guide

## ⚠️ CRITICAL SECURITY ALERT

The `.env` file containing production secrets was committed to git history in commit `13874bb`. This means anyone with access to the repository has access to:
- JWT signing key (can forge tokens for any user)
- Database password (full database access)
- Google OAuth secrets
- reCAPTCHA secrets
- SMTP credentials

---

## Immediate Actions Required

### 1. Rotate All Compromised Secrets

Generate new secrets immediately:

```bash
# Generate new JWT_SECRET (64 hex characters)
openssl rand -hex 64

# Generate new database password
openssl rand -base64 32

# For Google OAuth, create new credentials at:
# https://console.cloud.google.com/apis/credentials

# For reCAPTCHA, create new keys at:
# https://www.google.com/recaptcha/admin

# For SMTP, generate new password in your email service
```

### 2. Remove .env from Git History

**WARNING:** This rewrites git history. Coordinate with your team first.

```bash
# Backup your repository first
git clone --mirror https://github.com/YOUR_USERNAME/YOUR_REPO.git backup-repo

# Option 1: Using git filter-repo (recommended)
pip install git-filter-repo
git filter-repo --invert-paths --path .env --force

# Option 2: Using filter-branch (legacy)
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all

# Force push (WARNING: rewrites history)
git push origin --force --all
git push origin --force --tags
```

### 3. Verify .gitignore

Ensure `.env` is properly ignored:

```bash
# Should see: .env
grep "^\.env$" .gitignore

# Check if .env is currently tracked
git ls-files | grep "\.env$"

# If tracked, remove from index (not history)
git rm --cached .env
git commit -m "Remove .env from tracking"
```

---

## Best Practices for Secrets Management

### Development Environment

1. **Use `.env.example` for templates**
   - Include all required keys
   - Use placeholder values
   - Add comments explaining each variable

2. **Never commit actual secrets**
   - Keep `.env` in `.gitignore`
   - Use environment-specific files (`.env.development`, `.env.production`)
   - Never include secrets in code

3. **Use different secrets per environment**
   - Development secrets should differ from production
   - Use separate OAuth applications per environment

### Production Environment

1. **Use environment variable injection**
   - Set secrets via your hosting platform (Render, Railway, AWS, etc.)
   - Never commit production `.env` files
   - Use secret management services when available

2. **Rotate secrets regularly**
   - JWT secrets: Every 90 days
   - Database passwords: Every 60 days
   - API keys: Follow provider recommendations

3. **Audit secret access**
   - Log all secret access attempts
   - Monitor for unusual usage patterns
   - Set up alerts for secret exposure

---

## Environment Variable Reference

### Required for Production

| Variable | Description | Example |
|----------|-------------|---------|
| `JWT_SECRET` | JWT signing key (min 64 chars) | `openssl rand -hex 64` |
| `DB_PASSWORD` | PostgreSQL password | Random 32+ chars |
| `CORS_ORIGIN` | Allowed frontend origins | `https://example.com` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |

### Optional but Recommended

| Variable | Description | Source |
|----------|-------------|--------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret | Google Cloud Console |
| `RECAPTCHA_SECRET_KEY` | reCAPTCHA secret | reCAPTCHA Admin |
| `SMTP_HOST` | Email server hostname | Your email provider |
| `SMTP_USER` | SMTP username | Your email provider |
| `SMTP_PASS` | SMTP password | Your email provider |

---

## Secret Generation Commands

```bash
# JWT Secret (64 hex characters)
openssl rand -hex 64

# Database Password (32 base64 characters)
openssl rand -base64 32

# API Key (32 alphanumeric)
openssl rand -base32 32

# Session Secret (48 hex characters)
openssl rand -hex 48
```

---

## Post-Rotation Checklist

- [ ] Generate new JWT_SECRET
- [ ] Generate new DB_PASSWORD
- [ ] Create new Google OAuth credentials
- [ ] Create new reCAPTCHA keys
- [ ] Generate new SMTP password
- [ ] Update production environment variables
- [ ] Remove .env from git history
- [ ] Verify .gitignore contains `.env`
- [ ] Test authentication with new secrets
- [ ] Monitor for authentication failures
- [ ] Update any dependent services
- [ ] Notify team members of secret rotation

---

## Monitoring for Secret Exposure

Set up alerts for:

1. **Unusual authentication patterns**
   - Multiple failed logins from same IP
   - Successful logins from unusual locations
   - Admin role usage outside normal hours

2. **API usage anomalies**
   - Spike in API calls
   - Requests from unexpected origins
   - Unusual user agent patterns

3. **Database access**
   - Failed connection attempts
   - Queries from unexpected sources
   - Unusual query patterns

---

## Tools for Secret Scanning

Consider implementing automated secret scanning:

```bash
# TruffleHog - Search for secrets in git history
pip install truffleHog
trufflehog --regex --entropy=False /path/to/repo

# GitLeaks - Scan for secrets
gitleaks detect --source /path/to/repo --report-output report.json

# GitHub Secret Scanning (if using GitHub)
# Enable in repository settings: Security > Secret scanning
```

---

## Recovery from Secret Exposure

If secrets are exposed:

1. **Immediate containment**
   - Rotate all exposed secrets
   - Revoke all active sessions
   - Force password reset for all users

2. **Investigation**
   - Audit access logs
   - Identify affected accounts
   - Determine scope of exposure

3. **Notification**
   - Inform affected users
   - Notify stakeholders
   - Document the incident

4. **Prevention**
   - Implement secret scanning
   - Add pre-commit hooks
   - Train team on secrets management

---

## Additional Resources

- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [GitGuardian Secret Detection](https://www.gitguardian.com/)
- [GitHub Secret Scanning Documentation](https://docs.github.com/en/code-security/secret-scanning)
