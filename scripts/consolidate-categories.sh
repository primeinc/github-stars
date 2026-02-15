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

# Use Python for more reliable array manipulation
python3 << 'PYTHON_SCRIPT'
import yaml
import sys

# Load the YAML file
with open('repos.yml', 'r') as f:
    data = yaml.safe_load(f)

# Update repositories
updated_count = 0
for repo in data.get('repositories', []):
    categories = repo.get('categories', [])
    original_categories = categories.copy()
    
    # Replace api and ap-is with apis
    new_categories = []
    for cat in categories:
        if cat in ['api', 'ap-is']:
            new_categories.append('apis')
        else:
            new_categories.append(cat)
    
    # Remove duplicates while preserving order
    seen = set()
    deduped = []
    for cat in new_categories:
        if cat not in seen:
            seen.add(cat)
            deduped.append(cat)
    
    repo['categories'] = deduped
    
    if original_categories != deduped:
        updated_count += 1

# Update metadata
if 'manifest_metadata' in data:
    from datetime import datetime
    data['manifest_metadata']['manifest_updated_at'] = datetime.utcnow().isoformat() + 'Z'
    data['manifest_metadata']['generator_version'] = 'v1.1.0'

# Save back to file
with open('repos.yml', 'w') as f:
    yaml.dump(data, f, default_flow_style=False, allow_unicode=True, sort_keys=False)

print(f"Updated {updated_count} repositories")
PYTHON_SCRIPT

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
api_count=$(yq eval '[.repositories[].categories[]] | map(select(. == "api")) | length' repos.yml 2>/dev/null || echo 0)
apis_count=$(yq eval '[.repositories[].categories[]] | map(select(. == "ap-is")) | length' repos.yml 2>/dev/null || echo 0)

if [ "$api_count" -gt 0 ] || [ "$apis_count" -gt 0 ]; then
  echo "⚠️  Warning: Some 'api' or 'ap-is' categories still remain"
  echo "   api: $api_count, ap-is: $apis_count"
fi

# Count consolidated results
apis_final=$(yq eval '[.repositories[].categories[]] | map(select(. == "apis")) | length' repos.yml)
echo "✅ Consolidated: 'apis' category now has $apis_final uses"

echo ""
echo "Category consolidation complete!"
echo "Backup saved at: repos.yml.backup"
echo ""
echo "Next steps:"
echo "1. Review the changes: git diff repos.yml"
echo "2. Validate: ajv validate -s schemas/repos-schema.json -d repos.yml (if installed)"
echo "3. Commit: git add repos.yml && git commit -m 'chore: consolidate duplicate API categories'"
