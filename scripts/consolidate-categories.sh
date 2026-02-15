#!/bin/bash
# Script to consolidate duplicate/similar categories in repos.yml
# This consolidates: api, ap-is -> apis

set -e

echo "Starting category consolidation..."

# Backup the original file
cp repos.yml repos.yml.backup
echo "✅ Created backup: repos.yml.backup"

# Step 1: Remove "api" and "ap-is" from categories_allowed, keep "apis"
echo "📝 Updating taxonomy.categories_allowed..."
yq eval 'del(.taxonomy.categories_allowed[] | select(. == "api" or . == "ap-is"))' -i repos.yml

# Step 2: Replace "api" and "ap-is" with "apis" in all repository categories
echo "📝 Consolidating repository categories..."

# Create a temporary file with the updates
yq eval '
  .repositories = (.repositories | map(
    .categories = (.categories | map(
      if . == "api" or . == "ap-is" then "apis" 
      else . 
      end
    ) | unique)
  ))
' repos.yml > repos.yml.tmp

# Replace the original with the updated version
mv repos.yml.tmp repos.yml

# Step 3: Update manifest metadata
echo "📝 Updating manifest metadata..."
yq eval '.manifest_metadata.manifest_updated_at = now | .manifest_metadata.generator_version = "v1.1.0"' -i repos.yml

# Validate the result
echo "🔍 Validating consolidated manifest..."
if yq eval '.' repos.yml > /dev/null 2>&1; then
  echo "✅ YAML syntax is valid"
else
  echo "❌ YAML syntax error - restoring backup"
  mv repos.yml.backup repos.yml
  exit 1
fi

# Check for remaining invalid categories
api_count=$(yq eval '.repositories[] | select(.categories[] == "api") | .repo' repos.yml 2>/dev/null | wc -l || echo 0)
apis_count=$(yq eval '.repositories[] | select(.categories[] == "ap-is") | .repo' repos.yml 2>/dev/null | wc -l || echo 0)

if [ "$api_count" -gt 0 ] || [ "$apis_count" -gt 0 ]; then
  echo "⚠️  Warning: Some 'api' or 'ap-is' categories still remain"
  echo "   api: $api_count, ap-is: $apis_count"
fi

# Count consolidated results
apis_final=$(yq eval '.repositories[] | select(.categories[] == "apis") | .repo' repos.yml | wc -l)
echo "✅ Consolidated: 'apis' category now has $apis_final repositories"

echo ""
echo "Category consolidation complete!"
echo "Backup saved at: repos.yml.backup"
echo ""
echo "Next steps:"
echo "1. Review the changes: git diff repos.yml"
echo "2. Validate: ajv validate -s schemas/repos-schema.json -d repos.yml (if installed)"
echo "3. Commit: git add repos.yml && git commit -m 'chore: consolidate duplicate API categories'"
