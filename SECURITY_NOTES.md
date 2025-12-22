# Security Notes for EduDash Pro

## Critical Security Reminders

### Service Role Keys and Credentials

**NEVER commit service role keys, API keys, or credentials to the repository!**

Common mistakes to avoid:
- Creating files with keys in the filename
- Leaving backup files with credentials
- Committing `.env` files with real values
- Hardcoding API keys in source code

### What to Do If You Accidentally Commit Credentials

1. **Immediately rotate the exposed credentials** in Supabase/service dashboard
2. Remove the file from the repository
3. Add the pattern to `.gitignore`
4. Use `git filter-branch` or BFG Repo-Cleaner to remove from history if already pushed
5. Notify the team

### Best Practices

1. Always use `.env.example` for documentation, never real values
2. Use environment variables for all sensitive data
3. Keep credentials in secure password managers
4. Never share credentials via chat or email
5. Regularly audit the repository for exposed secrets using tools like:
   - `git-secrets`
   - `truffleHog`
   - GitHub secret scanning

### Files That Should NEVER Be Committed

- Any file containing `SERVICE_ROLE_KEY`
- Files with credentials in the filename
- `.env` files (except `.env.example`)
- Backup files with sensitive data
- Database dumps with real data
- API keys or tokens

### Current .gitignore Protection

The `.gitignore` has been updated to prevent:
- `*SERVICE_ROLE_KEY*`
- `*EDUSITE*KEY*`
- `*.backup` and `*.backup.*`
- `*-backup.*`
- `t *` (temporary files starting with 't ')

## Reporting Security Issues

If you discover a security vulnerability, please email security@edudashpro.org.za immediately.
Do NOT open a public GitHub issue for security vulnerabilities.
