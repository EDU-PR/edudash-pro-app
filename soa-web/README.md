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

**📋 For comprehensive setup instructions, see [ENV_SETUP.md](./ENV_SETUP.md)**

**Quick Start:**
1. Copy the template: `cp env.local.example .env.local`
2. Fill in your values (see `ENV_SETUP.md` for details)
3. Required variables:
   - `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
   - `NEXT_PUBLIC_SOA_ORGANIZATION_ID` - SOA organization UUID (default provided)

**Optional but Recommended:**
- `NEXT_PUBLIC_YOUTUBE_API_KEY` - For media hub video integration
- `NEXT_PUBLIC_YOUTUBE_CHANNEL_ID` - YouTube channel handle/ID

**Full template:** See `env.local.example` for all available variables with descriptions.

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

- **[ENV_SETUP.md](./ENV_SETUP.md)** - Comprehensive environment variables setup guide
- **[MEDIA_HUB_README.md](./MEDIA_HUB_README.md)** - How the media hub loads and displays content
- **[../ENV_VARS.md](../ENV_VARS.md)** - Main EduDash Pro environment variables documentation
- [SOIL_OF_AFRICA_MEMBERSHIP.md](../docs/features/SOIL_OF_AFRICA_MEMBERSHIP.md) - Full system documentation
- Mobile app screens: `/app/screens/membership/`
- Database migration: `/supabase/migrations/20251223013241_organization_membership_system.sql`
