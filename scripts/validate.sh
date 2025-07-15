#!/bin/bash
# Validation script for the GitHub Stars curation system

set -e

echo "🔍 GitHub Stars Curation System Validation"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Download yq if not present
if [ ! -f "./yq" ]; then
    echo "📥 Downloading yq..."
    wget -qO ./yq https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64
    chmod +x ./yq
fi

# Test 1: Check if required files exist
echo ""
echo "📁 File Structure Check"
echo "-----------------------"

required_files=(
    "repos.yml"
    "schemas/repos-schema.json"
    "queries/stars-query.graphql"
    ".github/workflows/01-fetch-stars.yml"
    ".github/workflows/02-sync-stars.yml"
    ".github/workflows/03-curate-stars.yml"
)

all_files_exist=true
for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file"
    else
        echo -e "${RED}✗${NC} $file (missing)"
        all_files_exist=false
    fi
done

if [ "$all_files_exist" = false ]; then
    echo -e "${RED}❌ Some required files are missing${NC}"
    exit 1
fi

# Test 2: Validate YAML syntax
echo ""
echo "📋 YAML Syntax Check"
echo "--------------------"

if ./yq eval '.' repos.yml > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} repos.yml syntax is valid"
else
    echo -e "${RED}✗${NC} repos.yml has syntax errors"
    ./yq eval '.' repos.yml
    exit 1
fi

# Test 3: Schema validation
echo ""
echo "🔍 Schema Validation"
echo "-------------------"

# Check if cardinalby/schema-validator-action is available (GitHub Actions only)
# For local testing, we'll do basic structure validation

# Check required top-level fields
required_fields=("schema_version" "manifest_metadata" "feature_flags" "taxonomy" "repositories")
for field in "${required_fields[@]}"; do
    if ./yq eval "has(\"$field\")" repos.yml | grep -q "true"; then
        echo -e "${GREEN}✓${NC} $field field present"
    else
        echo -e "${RED}✗${NC} $field field missing"
        exit 1
    fi
done

# Test 4: Repository data validation
echo ""
echo "📊 Repository Data Analysis"
echo "---------------------------"

total_repos=$(./yq eval '.repositories | length' repos.yml)
echo "Total repositories: $total_repos"

unclassified_count=$(./yq eval '.repositories | map(select(.categories[] == "unclassified")) | length' repos.yml)
classified_count=$((total_repos - unclassified_count))

echo "Classified: $classified_count"
echo "Unclassified: $unclassified_count"

if [ "$unclassified_count" -gt 0 ]; then
    percentage=$(echo "scale=1; $unclassified_count * 100 / $total_repos" | bc -l 2>/dev/null || echo "$unclassified_count * 100 / $total_repos" | awk '{print $1}')
    echo -e "${YELLOW}⚠${NC}  $percentage% of repositories need classification"
fi

# Test 5: Check for duplicates
echo ""
echo "🔄 Duplicate Check"
echo "------------------"

duplicates=$(./yq eval '.repositories[].repo' repos.yml | sort | uniq -d)
if [ -z "$duplicates" ]; then
    echo -e "${GREEN}✓${NC} No duplicate repositories found"
else
    echo -e "${RED}✗${NC} Duplicate repositories found:"
    echo "$duplicates"
    exit 1
fi

# Test 6: Validate categories and tags
echo ""
echo "🏷️ Taxonomy Validation"
echo "----------------------"

# Get allowed categories
allowed_categories=$(./yq eval '.taxonomy.categories_allowed[]' repos.yml | sort)
echo "Allowed categories: $(echo "$allowed_categories" | wc -l)"

# Check for invalid categories
invalid_categories=$(./yq eval '.repositories[].categories[]' repos.yml | sort | uniq | while read -r category; do
    if ! echo "$allowed_categories" | grep -q "^$category$"; then
        echo "$category"
    fi
done)

if [ -z "$invalid_categories" ]; then
    echo -e "${GREEN}✓${NC} All categories are valid"
else
    echo -e "${YELLOW}⚠${NC}  Invalid categories found (may need to add to taxonomy):"
    echo "$invalid_categories"
fi

# Test 7: Check tag format
echo ""
echo "🔖 Tag Format Validation"
echo "------------------------"

invalid_tags=$(./yq eval '.repositories[].tags[]' repos.yml | grep -v '^[a-z][a-z0-9-]*$\|^[a-z]\+:[a-z0-9][a-z0-9-]*$' || true)
if [ -z "$invalid_tags" ]; then
    echo -e "${GREEN}✓${NC} All tags follow correct format"
else
    echo -e "${RED}✗${NC} Invalid tag formats found:"
    echo "$invalid_tags"
    echo "Tags must match: ^([a-z]+:)?[a-z0-9][a-z0-9-]*$"
fi

# Test 8: GitHub metadata check
echo ""
echo "📈 GitHub Metadata Check"
echo "------------------------"

repos_with_metadata=$(./yq eval '.repositories | map(select(has("github_metadata"))) | length' repos.yml)
echo "Repositories with GitHub metadata: $repos_with_metadata/$total_repos"

if [ "$repos_with_metadata" -lt "$total_repos" ]; then
    missing_metadata=$((total_repos - repos_with_metadata))
    echo -e "${YELLOW}⚠${NC}  $missing_metadata repositories missing GitHub metadata"
fi

# Test 9: AI classification tracking
echo ""
echo "🤖 AI Classification Status"
echo "---------------------------"

ai_classified=$(./yq eval '.repositories | map(select(has("ai_classification"))) | length' repos.yml)
echo "AI classified repositories: $ai_classified/$total_repos"

needs_review=$(./yq eval '.repositories | map(select(.needs_review == true)) | length' repos.yml)
echo "Repositories needing review: $needs_review"

# Test 10: Workflow file validation
echo ""
echo "⚙️ Workflow Validation"
echo "----------------------"

workflow_files=(
    ".github/workflows/01-fetch-stars.yml"
    ".github/workflows/02-sync-stars.yml"
    ".github/workflows/03-curate-stars.yml"
)

for workflow in "${workflow_files[@]}"; do
    if ./yq eval '.' "$workflow" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $(basename "$workflow") syntax is valid"
    else
        echo -e "${RED}✗${NC} $(basename "$workflow") has syntax errors"
    fi
done

# Summary
echo ""
echo "📋 Validation Summary"
echo "===================="

if [ "$all_files_exist" = true ] && [ -z "$duplicates" ] && [ -z "$invalid_tags" ]; then
    echo -e "${GREEN}✅ All critical validations passed${NC}"
    
    if [ "$unclassified_count" -gt 0 ]; then
        echo -e "${YELLOW}⚠️  Recommendation: Run classification workflow to process $unclassified_count unclassified repositories${NC}"
    fi
    
    if [ "$repos_with_metadata" -lt "$total_repos" ]; then
        echo -e "${YELLOW}⚠️  Recommendation: Run sync workflow to update GitHub metadata${NC}"
    fi
    
    echo ""
    echo "🚀 Next steps:"
    echo "  1. Run 'gh workflow run \"Curate Starred Repos\"' to classify repositories"
    echo "  2. Consider implementing directory structure generation"
    echo "  3. Add README generation for categories"
    
    exit 0
else
    echo -e "${RED}❌ Some validations failed - please fix the issues above${NC}"
    exit 1
fi