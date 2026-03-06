#!/usr/bin/env bash
# Production Cookie Domain Fix Script
# This script checks and fixes COOKIE_DOMAIN setting in production .env

set -euo pipefail

echo "=== CafeDuo Production Cookie Domain Fix ==="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Project directory (update if different)
PROJECT_DIR="${1:-/opt/cafeduo-main}"
ENV_FILE="${PROJECT_DIR}/.env"

echo "Project directory: ${PROJECT_DIR}"
echo "Checking .env file: ${ENV_FILE}"
echo ""

# Check if .env exists
if [[ ! -f "${ENV_FILE}" ]]; then
    echo -e "${RED}ERROR: .env file not found at ${ENV_FILE}${NC}"
    echo "Please create .env file or specify correct path:"
    echo "  $0 /path/to/project"
    exit 1
fi

# Backup .env
BACKUP_FILE="${ENV_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
echo -e "${YELLOW}Creating backup: ${BACKUP_FILE}${NC}"
cp "${ENV_FILE}" "${BACKUP_FILE}"

# Check current COOKIE_DOMAIN setting
echo ""
echo "=== Current COOKIE_DOMAIN Setting ==="
if grep -q "^COOKIE_DOMAIN=" "${ENV_FILE}"; then
    CURRENT_VALUE=$(grep "^COOKIE_DOMAIN=" "${ENV_FILE}" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
    if [[ -z "${CURRENT_VALUE}" ]]; then
        echo -e "${GREEN}✓ COOKIE_DOMAIN is already empty (correct)${NC}"
        echo "  COOKIE_DOMAIN="
        NEEDS_FIX=false
    else
        echo -e "${RED}✗ COOKIE_DOMAIN is set to: ${CURRENT_VALUE}${NC}"
        echo "  This can cause authentication issues!"
        NEEDS_FIX=true
    fi
else
    echo -e "${YELLOW}! COOKIE_DOMAIN not found in .env${NC}"
    NEEDS_FIX=true
fi

# Fix if needed
if [[ "${NEEDS_FIX}" == "true" ]]; then
    echo ""
    echo "=== Applying Fix ==="
    
    # Remove existing COOKIE_DOMAIN lines
    sed -i '/^COOKIE_DOMAIN=/d' "${ENV_FILE}"
    
    # Add empty COOKIE_DOMAIN at the end of CORS section
    if grep -q "^CORS_ORIGIN=" "${ENV_FILE}"; then
        # Add after CORS_ORIGIN
        sed -i '/^CORS_ORIGIN=/a COOKIE_DOMAIN=' "${ENV_FILE}"
    else
        # Add at end of file
        echo "COOKIE_DOMAIN=" >> "${ENV_FILE}"
    fi
    
    echo -e "${GREEN}✓ COOKIE_DOMAIN fixed (set to empty)${NC}"
fi

# Verify fix
echo ""
echo "=== Verification ==="
echo "Current .env COOKIE_DOMAIN line:"
grep "^COOKIE_DOMAIN=" "${ENV_FILE}" || echo "  COOKIE_DOMAIN= (added at end)"

# Check other important settings
echo ""
echo "=== Other Important Settings ==="
echo "NODE_ENV: $(grep '^NODE_ENV=' "${ENV_FILE}" | cut -d'=' -f2- || echo 'NOT SET')"
echo "CORS_ORIGIN: $(grep '^CORS_ORIGIN=' "${ENV_FILE}" | cut -d'=' -f2- || echo 'NOT SET')"

# Restart containers
echo ""
echo "=== Next Steps ==="
echo "1. Review the changes above"
echo "2. Update the GitHub Actions production env secret (DEPLOY_ENV_B64)"
echo "   Otherwise the next deploy will overwrite .env and restore the old value."
echo ""
echo "3. Restart Docker containers to apply changes:"
echo ""
echo -e "${YELLOW}cd ${PROJECT_DIR}/deploy && docker compose -f docker-compose.prod.yml down && docker compose -f docker-compose.prod.yml up -d --build${NC}"
echo ""
echo "4. Test authentication:"
echo "   - Clear browser cookies"
echo "   - Login to application"
echo "   - Verify Socket.IO connection succeeds"
echo ""
echo "5. Check logs:"
echo -e "${YELLOW}docker logs cafeduo-api-1 -f | grep -i 'socket\\|auth'${NC}"
echo ""
echo -e "${GREEN}Backup saved to: ${BACKUP_FILE}${NC}"
echo ""
echo "For detailed troubleshooting, see: docs/COOKIE_AUTH_TROUBLESHOOTING.md"
