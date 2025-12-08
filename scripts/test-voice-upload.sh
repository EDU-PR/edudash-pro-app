#!/bin/bash
# Test voice-notes bucket upload directly

USER_ID="136cf31c-b37c-45c0-9cf7-755bd1b9afbf"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2dnZqeXdybXBjcXJwdnVwdGRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwMzc4MzgsImV4cCI6MjA2ODYxMzgzOH0.mjXejyRHPzEJfMlhW46TlYI0qw9mtoSRJZhGsCkuvd8"

# Need user JWT - this is just a test placeholder
echo "Testing voice-notes upload..."
echo ""
echo "To test properly, you need:"
echo "1. Get your JWT token from the app (after login)"
echo "2. Run this curl command:"
echo ""
echo "curl -v -X POST \\"
echo "  'https://lvvvjywrmpcqrpvuptdi.supabase.co/storage/v1/object/voice-notes/android/${USER_ID}/test_upload.m4a' \\"
echo "  -H 'Authorization: Bearer YOUR_USER_JWT_HERE' \\"
echo "  -H 'Content-Type: audio/mp4' \\"
echo "  --data-binary '@test-audio.m4a'"
echo ""
echo "The error response will tell us exactly what's wrong."
