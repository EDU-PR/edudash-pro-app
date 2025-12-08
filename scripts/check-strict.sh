#!/bin/bash
# Check TypeScript strict mode compliance for critical files

echo "🔍 Running TypeScript strict mode check..."
echo ""

# Run strict typecheck
npx tsc -p tsconfig.strict.json --noEmit

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ All strict mode files pass type checking!"
    echo ""
    echo "Files under strict mode:"
    echo "  - lib/security/**/*"
    echo "  - lib/routeAfterLogin.ts"
    echo "  - lib/smart-memo.ts"
    echo "  - lib/monitoring.ts"
    echo "  - lib/rbac/**/*"
    echo "  - hooks/**/*"
    echo "  - tests/**/*"
    exit 0
else
    echo ""
    echo "❌ Strict mode type errors found"
    echo ""
    echo "💡 Fix these errors before committing"
    exit 1
fi
