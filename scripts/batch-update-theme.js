#!/usr/bin/env node

/**
 * Batch Theme Update Script
 * 
 * This script helps identify files that still have hardcoded values
 * and need to be updated to use the theme system.
 */

const fs = require('fs');
const path = require('path');

// Patterns to search for
const patterns = {
  hexColors: /#[0-9A-Fa-f]{3,6}/g,
  rgbaColors: /rgba?\([^)]+\)/g,
  hardcodedSpacing: /(?:padding|margin|gap|width|height|top|bottom|left|right|borderRadius):\s*\d+(?!%)/g,
  hardcodedFontSize: /fontSize:\s*\d+/g,
  hardcodedFontWeight: /fontWeight:\s*['"]?\d+['"]?/g,
  hardcodedShadow: /shadow(?:Color|Offset|Opacity|Radius):/g,
};

// Directories to scan
const dirsToScan = [
  'src/features/auth/components',
  'src/features/account/components',
  'src/features/health/components',
  'src/features/shop/components',
  'src/components',
];

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const issues = {};
  let totalIssues = 0;

  for (const [name, pattern] of Object.entries(patterns)) {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      issues[name] = matches.length;
      totalIssues += matches.length;
    }
  }

  return { issues, totalIssues };
}

function scanDirectory(dir) {
  const results = [];
  
  function walk(currentPath) {
    const files = fs.readdirSync(currentPath);
    
    for (const file of files) {
      const filePath = path.join(currentPath, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        walk(filePath);
      } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        const { issues, totalIssues } = scanFile(filePath);
        if (totalIssues > 0) {
          results.push({
            file: filePath,
            issues,
            totalIssues,
          });
        }
      }
    }
  }
  
  if (fs.existsSync(dir)) {
    walk(dir);
  }
  
  return results;
}

// Main execution
console.log('🔍 Scanning for hardcoded values...\n');

const allResults = [];

for (const dir of dirsToScan) {
  const results = scanDirectory(dir);
  allResults.push(...results);
}

// Sort by total issues (descending)
allResults.sort((a, b) => b.totalIssues - a.totalIssues);

// Print results
console.log('📊 Files with hardcoded values (sorted by priority):\n');
console.log('=' .repeat(80));

allResults.forEach((result, index) => {
  console.log(`\n${index + 1}. ${result.file}`);
  console.log(`   Total issues: ${result.totalIssues}`);
  for (const [type, count] of Object.entries(result.issues)) {
    console.log(`   - ${type}: ${count}`);
  }
});

console.log('\n' + '='.repeat(80));
console.log(`\n📈 Summary:`);
console.log(`   Total files with issues: ${allResults.length}`);
console.log(`   Total issues found: ${allResults.reduce((sum, r) => sum + r.totalIssues, 0)}`);

// Generate priority list
console.log(`\n🎯 High Priority Files (10+ issues):`);
const highPriority = allResults.filter(r => r.totalIssues >= 10);
highPriority.forEach((r, i) => {
  console.log(`   ${i + 1}. ${r.file} (${r.totalIssues} issues)`);
});

console.log(`\n✅ Next Steps:`);
console.log(`   1. Start with high-priority files listed above`);
console.log(`   2. Use THEME_COMPONENT_TEMPLATE.tsx as reference`);
console.log(`   3. Test each file in both light and dark modes`);
console.log(`   4. Run this script again to track progress\n`);
