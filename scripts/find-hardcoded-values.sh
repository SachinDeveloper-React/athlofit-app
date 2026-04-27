#!/bin/bash

# Script to find hardcoded values that should use theme tokens

echo "=== Finding Hardcoded Colors ==="
echo "Hex colors (#RRGGBB or #RGB):"
grep -rn "#[0-9A-Fa-f]\{3,6\}" src/features --include="*.tsx" --include="*.ts" | grep -v "node_modules" | grep -v ".test." | head -30

echo ""
echo "RGBA colors:"
grep -rn "rgba(" src/features --include="*.tsx" --include="*.ts" | grep -v "node_modules" | grep -v ".test." | head -30

echo ""
echo "=== Finding Hardcoded Spacing ==="
echo "Numeric padding/margin values:"
grep -rn "padding.*: [0-9]\|margin.*: [0-9]" src/features --include="*.tsx" | grep -v "node_modules" | grep -v ".test." | head -20

echo ""
echo "=== Finding Hardcoded Font Sizes ==="
grep -rn "fontSize: [0-9]" src/features --include="*.tsx" | grep -v "node_modules" | grep -v ".test." | head -20

echo ""
echo "=== Finding Hardcoded Font Weights ==="
grep -rn "fontWeight: '[0-9]" src/features --include="*.tsx" | grep -v "node_modules" | grep -v ".test." | head -20

echo ""
echo "=== Finding Hardcoded Border Radius ==="
grep -rn "borderRadius: [0-9]" src/features --include="*.tsx" | grep -v "node_modules" | grep -v ".test." | head -20

echo ""
echo "=== Finding Hardcoded Shadows ==="
grep -rn "shadowColor\|shadowOffset\|shadowOpacity\|shadowRadius" src/features --include="*.tsx" | grep -v "node_modules" | grep -v ".test." | head -20

echo ""
echo "=== Summary ==="
echo "Total files with hex colors: $(grep -rl "#[0-9A-Fa-f]\{3,6\}" src/features --include="*.tsx" | wc -l)"
echo "Total files with rgba: $(grep -rl "rgba(" src/features --include="*.tsx" | wc -l)"
echo "Total files with hardcoded fontSize: $(grep -rl "fontSize: [0-9]" src/features --include="*.tsx" | wc -l)"
echo "Total files with hardcoded fontWeight: $(grep -rl "fontWeight: '[0-9]" src/features --include="*.tsx" | wc -l)"
