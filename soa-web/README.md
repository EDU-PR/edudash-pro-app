# Soil of Africa Web Portal

A standalone Next.js website for Soil of Africa membership registration, deployed to `soilofafrica.org`.

## Overview

This is a separate web application that:
- Hosts the public-facing Soil of Africa website
- Connects to EduDash Pro's Supabase backend
- Allows members to register and join with invite codes
- Provides app download links
- Has subtle "Powered by EduDash Pro" branding

## Architecture

```
soilofafrica.org (This site)     edudashpro.org.za (Main app)
         │                               │
         └───────────┬───────────────────┘
                     │
                     ▼
            ┌───────────────┐
            │   SUPABASE    │  (Shared Database)
            │   Backend     │
            └───────────────┘
                     │
                     ▼
            ┌───────────────┐
            │  Mobile App   │  (EduDash Pro - iOS/Android)
            │               │
            └───────────────┘
```

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **Database**: Supabase (shared with EduDash Pro)
- **Hosting**: Vercel (recommended)
- **Icons**: Lucide React

## Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page with membership info |
| `/register` | Multi-step registration form |
| `/join` | Quick join with invite code |
| `/download` | App download links |

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```bash
# Connect to EduDash Pro's Supabase
NEXT_PUBLIC_SUPABASE_URL=https://bppuzibjlxgfwrufjfsz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# Site URLs
NEXT_PUBLIC_SITE_URL=https://soilofafrica.org
NEXT_PUBLIC_EDUDASH_URL=https://edudashpro.org.za
NEXT_PUBLIC_APP_STORE_URL=https://apps.apple.com/app/edudash-pro/id123456789
NEXT_PUBLIC_PLAY_STORE_URL=https://play.google.com/store/apps/details?id=com.edudashpro.app
```

## Development

```bash
# Install dependencies
npm install

# Run development server (port 3001 to avoid conflicts)
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Deployment to Vercel

1. Create a new Vercel project
2. Connect to this folder (or create a monorepo setup)
3. Set environment variables
4. Configure custom domain: `soilofafrica.org`

### Vercel Configuration

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "installCommand": "npm install",
  "framework": "nextjs"
}
```

## Brand Colors

```css
/* Soil of Africa */
--soa-primary: #166534;    /* Forest green */
--soa-secondary: #22C55E;  /* Bright green */
--soa-accent: #84CC16;     /* Lime */
--soa-dark: #14532D;       /* Dark green */
--soa-light: #DCFCE7;      /* Light green */

/* EduDash Pro (accent) */
--edudash-primary: #6366F1; /* Indigo */
--edudash-secondary: #8B5CF6; /* Purple */
```

## Registration Flow

### Public Registration (`/register`)
1. Select Region (9 SA provinces)
2. Personal Information
3. Membership Type & Tier
4. Payment Review
5. Completion → App Download

### Invite Code Registration (`/join`)
1. Enter Invite Code
2. Verify Organization
3. Quick Form (name, email, phone, type)
4. Submit → App Download

## Database Tables Used

This site writes to these tables in EduDash Pro's Supabase:

- `auth.users` - User authentication
- `organization_members` - Membership records
- `member_invoices` - Payment invoices

## Branding Guidelines

- SOA logo and colors are primary
- "Powered by EduDash Pro" appears in:
  - Header (small text under logo)
  - Footer (link)
  - Download page (web app link)
  - Registration completion

## Related Documentation

- [SOIL_OF_AFRICA_MEMBERSHIP.md](../docs/features/SOIL_OF_AFRICA_MEMBERSHIP.md) - Full system documentation
- Mobile app screens: `/app/screens/membership/`
- Database migration: `/supabase/migrations/20251223013241_organization_membership_system.sql`
