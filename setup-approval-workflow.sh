#!/bin/bash

# Organization Approval Workflow - Setup Script
# This script helps set up the approval workflow system

set -e  # Exit on error

echo "=========================================="
echo "EduDash Pro - Organization Approval Setup"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
function info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

function success() {
    echo -e "${GREEN}✓${NC} $1"
}

function warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

function error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "ORGANIZATION_APPROVAL_WORKFLOW_GUIDE.md" ]; then
    error "Please run this script from the edudashpro root directory"
    exit 1
fi

echo "Step 1: Checking Dependencies"
echo "------------------------------"

# Check if Supabase CLI is installed
if command -v supabase &> /dev/null; then
    success "Supabase CLI is installed"
else
    warning "Supabase CLI not found. Install with: npm install -g supabase"
    echo "    Or continue manually by running SQL in Supabase Dashboard"
fi

# Check if bcryptjs is installed in EduSitePro
cd ../edusitepro
if grep -q "bcryptjs" package.json; then
    success "bcryptjs installed in EduSitePro"
else
    warning "bcryptjs not found in EduSitePro. Installing..."
    npm install bcryptjs
fi
cd ../edudashpro

echo ""
echo "Step 2: Environment Variables"
echo "------------------------------"

# Check EduDashPro .env
if [ -f ".env" ]; then
    if grep -q "NEXT_PUBLIC_EDUSITEPRO_API_URL" .env; then
        success "NEXT_PUBLIC_EDUSITEPRO_API_URL found in EduDashPro .env"
    else
        warning "NEXT_PUBLIC_EDUSITEPRO_API_URL not found in EduDashPro .env"
        echo "    Add: NEXT_PUBLIC_EDUSITEPRO_API_URL=http://localhost:3002"
    fi
else
    warning ".env not found in EduDashPro. Copy from .env.example"
fi

# Check EduSitePro .env
cd ../edusitepro
if [ -f ".env" ]; then
    if grep -q "EDUDASH_SUPABASE_URL" .env; then
        success "EDUDASH_SUPABASE_URL found in EduSitePro .env"
    else
        warning "EDUDASH_SUPABASE_URL not found in EduSitePro .env"
        echo "    Add: EDUDASH_SUPABASE_URL=https://lvvvjywrmpcqrpvuptdi.supabase.co"
    fi
    
    if grep -q "EDUDASH_SERVICE_ROLE_KEY" .env; then
        success "EDUDASH_SERVICE_ROLE_KEY found in EduSitePro .env"
    else
        warning "EDUDASH_SERVICE_ROLE_KEY not found in EduSitePro .env"
        echo "    Get from: https://supabase.com/dashboard/project/lvvvjywrmpcqrpvuptdi/settings/api"
    fi
    
    if grep -q "INTERNAL_API_KEY" .env; then
        success "INTERNAL_API_KEY found in EduSitePro .env"
    else
        warning "INTERNAL_API_KEY not found in EduSitePro .env"
        echo "    Generate with: openssl rand -hex 32"
    fi
else
    warning ".env not found in EduSitePro. Copy from .env.example"
fi
cd ../edudashpro

echo ""
echo "Step 3: Database Migration"
echo "------------------------------"

cd ../edusitepro
MIGRATION_FILE="supabase/migrations/20251201000002_organization_registration_requests.sql"

if [ -f "$MIGRATION_FILE" ]; then
    success "Migration file exists: $MIGRATION_FILE"
    
    echo ""
    info "Ready to apply migration. Choose an option:"
    echo "  1) Apply using Supabase CLI (recommended)"
    echo "  2) Show SQL to run manually in Supabase Dashboard"
    echo "  3) Skip migration (already applied)"
    echo ""
    
    read -p "Enter choice (1-3): " choice
    
    case $choice in
        1)
            if command -v supabase &> /dev/null; then
                info "Applying migration with Supabase CLI..."
                supabase migration up
                success "Migration applied successfully!"
            else
                error "Supabase CLI not found. Choose option 2 to get SQL instead."
            fi
            ;;
        2)
            echo ""
            info "Copy the following SQL and run it in Supabase Dashboard:"
            echo "  1. Go to: https://supabase.com/dashboard/project/bppuzibjlxgfwrujzfsz/editor"
            echo "  2. Click 'New Query'"
            echo "  3. Paste the SQL from: $MIGRATION_FILE"
            echo "  4. Click 'Run'"
            echo ""
            read -p "Press Enter to continue after running SQL..."
            ;;
        3)
            info "Skipping migration..."
            ;;
        *)
            warning "Invalid choice. Skipping migration."
            ;;
    esac
else
    error "Migration file not found: $MIGRATION_FILE"
fi

cd ../edudashpro

echo ""
echo "Step 4: Verification"
echo "------------------------------"

info "Testing database connection..."

# You could add actual database connectivity tests here if needed

echo ""
echo "=========================================="
echo "Setup Summary"
echo "=========================================="
echo ""
success "Files created:"
echo "  ✓ /web/src/app/sign-up/pending-approval/page.tsx"
echo "  ✓ /edusitepro/src/app/api/organizations/register/route.ts"
echo "  ✓ /edusitepro/src/app/api/organizations/approve/[requestId]/route.ts"
echo "  ✓ /edusitepro/src/app/admin/organization-requests/page.tsx"
echo "  ✓ /edusitepro/supabase/migrations/20251201000002_organization_registration_requests.sql"
echo "  ✓ ORGANIZATION_APPROVAL_WORKFLOW_GUIDE.md"
echo ""

info "Next steps:"
echo "  1. Make sure all environment variables are configured"
echo "  2. Apply the database migration (if not done above)"
echo "  3. Start both development servers:"
echo "     - EduDashPro: cd web && npm run dev (port 3000)"
echo "     - EduSitePro: cd edusitepro && npm run dev (port 3002)"
echo "  4. Test the workflow:"
echo "     - Register: http://localhost:3000/sign-up/principal"
echo "     - Approve: http://localhost:3002/admin/organization-requests"
echo ""

info "For detailed instructions, see: ORGANIZATION_APPROVAL_WORKFLOW_GUIDE.md"
echo ""

read -p "Would you like to start both dev servers now? (y/n): " start_servers

if [[ $start_servers == "y" || $start_servers == "Y" ]]; then
    echo ""
    info "Starting development servers..."
    
    # Start EduDashPro web in background
    cd web
    echo "Starting EduDashPro on http://localhost:3000..."
    npm run dev > /tmp/edudash-dev.log 2>&1 &
    EDUDASH_PID=$!
    
    cd ../../edusitepro
    echo "Starting EduSitePro on http://localhost:3002..."
    npm run dev > /tmp/edusite-dev.log 2>&1 &
    EDUSITE_PID=$!
    
    cd ../edudashpro
    
    echo ""
    success "Both servers starting..."
    echo "  EduDashPro: http://localhost:3000 (PID: $EDUDASH_PID)"
    echo "  EduSitePro: http://localhost:3002 (PID: $EDUSITE_PID)"
    echo ""
    info "Logs:"
    echo "  EduDashPro: tail -f /tmp/edudash-dev.log"
    echo "  EduSitePro: tail -f /tmp/edusite-dev.log"
    echo ""
    warning "To stop servers: kill $EDUDASH_PID $EDUSITE_PID"
else
    echo ""
    info "You can start servers manually:"
    echo "  Terminal 1: cd web && npm run dev"
    echo "  Terminal 2: cd ../edusitepro && npm run dev"
fi

echo ""
echo "=========================================="
success "Setup complete!"
echo "=========================================="
