#!/bin/bash
# Generate browsable directory structure from repos.yml manifest

set -e

echo "🏗️ Generating Multi-Axis Repository Structure"
echo "============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Download yq if not present
if [ ! -f "./yq" ]; then
    echo "📥 Downloading yq..."
    wget -qO ./yq https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64
    chmod +x ./yq
fi

# Check if repos.yml exists
if [ ! -f "repos.yml" ]; then
    echo -e "${RED}❌ repos.yml not found${NC}"
    exit 1
fi

echo -e "${BLUE}📊 Analyzing repository manifest...${NC}"

# Get statistics
total_repos=$(./yq eval '.repositories | length' repos.yml)
classified_repos=$(./yq eval '.repositories | map(select(.categories[] != "unclassified")) | length' repos.yml)
categories=$(./yq eval '.repositories[].categories[]' repos.yml | grep -v "unclassified" | sort | uniq)
tags=$(./yq eval '.repositories[].tags[]' repos.yml | sort | uniq)
frameworks=$(./yq eval '.repositories[].framework' repos.yml | grep -v "null" | sort | uniq)

echo "Total repositories: $total_repos"
echo "Classified repositories: $classified_repos"
echo "Categories: $(echo "$categories" | wc -l)"
echo "Tags: $(echo "$tags" | wc -l)"
echo "Frameworks: $(echo "$frameworks" | wc -l)"

# Create base directories
echo ""
echo -e "${BLUE}📁 Creating directory structure...${NC}"

# Clean up existing structure
rm -rf by-category by-tag by-framework

# Create main directories
mkdir -p by-category by-tag by-framework

# Generate by-category structure
echo -e "${GREEN}Generating by-category structure...${NC}"
while IFS= read -r category; do
    if [ "$category" != "unclassified" ] && [ -n "$category" ]; then
        mkdir -p "by-category/$category"
        
        # Get repositories for this category
        repos_in_category=$(./yq eval ".repositories[] | select(.categories[] == \"$category\") | .repo" repos.yml)
        count=$(echo "$repos_in_category" | wc -l)
        
        # Create README for this category
        cat > "by-category/$category/README.md" << EOF
# $category

> $count repositories in this category

## Repositories

EOF
        
        # Add each repository
        while IFS= read -r repo; do
            if [ -n "$repo" ]; then
                # Get repository details
                summary=$(./yq eval ".repositories[] | select(.repo == \"$repo\") | .summary" repos.yml)
                tags_list=$(./yq eval ".repositories[] | select(.repo == \"$repo\") | .tags[]" repos.yml | tr '\n' ' ')
                stars=$(./yq eval ".repositories[] | select(.repo == \"$repo\") | .github_metadata.stargazers_count" repos.yml)
                language=$(./yq eval ".repositories[] | select(.repo == \"$repo\") | .github_metadata.language" repos.yml)
                
                # Clean up null values
                [ "$summary" = "null" ] && summary="No description available"
                [ "$stars" = "null" ] && stars="0"
                [ "$language" = "null" ] && language="Unknown"
                
                cat >> "by-category/$category/README.md" << EOF
### [$repo](https://github.com/$repo)

$summary

**Language:** $language | **Stars:** $stars  
**Tags:** $tags_list

---

EOF
            fi
        done <<< "$repos_in_category"
        
        echo "  ✓ $category ($count repositories)"
    fi
done <<< "$categories"

# Generate by-tag structure
echo -e "${GREEN}Generating by-tag structure...${NC}"
while IFS= read -r tag; do
    if [ -n "$tag" ]; then
        mkdir -p "by-tag/$tag"
        
        # Get repositories for this tag
        repos_with_tag=$(./yq eval ".repositories[] | select(.tags[] == \"$tag\") | .repo" repos.yml)
        count=$(echo "$repos_with_tag" | wc -l)
        
        # Create README for this tag
        cat > "by-tag/$tag/README.md" << EOF
# $tag

> $count repositories tagged with \`$tag\`

## Repositories

EOF
        
        # Add each repository
        while IFS= read -r repo; do
            if [ -n "$repo" ]; then
                # Get repository details
                summary=$(./yq eval ".repositories[] | select(.repo == \"$repo\") | .summary" repos.yml)
                categories_list=$(./yq eval ".repositories[] | select(.repo == \"$repo\") | .categories[]" repos.yml | tr '\n' ' ')
                stars=$(./yq eval ".repositories[] | select(.repo == \"$repo\") | .github_metadata.stargazers_count" repos.yml)
                
                # Clean up null values
                [ "$summary" = "null" ] && summary="No description available"
                [ "$stars" = "null" ] && stars="0"
                
                cat >> "by-tag/$tag/README.md" << EOF
### [$repo](https://github.com/$repo)

$summary

**Categories:** $categories_list | **Stars:** $stars

---

EOF
            fi
        done <<< "$repos_with_tag"
        
        echo "  ✓ $tag ($count repositories)"
    fi
done <<< "$tags"

# Generate by-framework structure
if [ -n "$frameworks" ]; then
    echo -e "${GREEN}Generating by-framework structure...${NC}"
    while IFS= read -r framework; do
        if [ -n "$framework" ] && [ "$framework" != "null" ]; then
            mkdir -p "by-framework/$framework"
            
            # Get repositories for this framework
            repos_with_framework=$(./yq eval ".repositories[] | select(.framework == \"$framework\") | .repo" repos.yml)
            count=$(echo "$repos_with_framework" | wc -l)
            
            # Create README for this framework
            cat > "by-framework/$framework/README.md" << EOF
# $framework

> $count repositories using the \`$framework\` framework

## Repositories

EOF
            
            # Add each repository
            while IFS= read -r repo; do
                if [ -n "$repo" ]; then
                    # Get repository details
                    summary=$(./yq eval ".repositories[] | select(.repo == \"$repo\") | .summary" repos.yml)
                    tags_list=$(./yq eval ".repositories[] | select(.repo == \"$repo\") | .tags[]" repos.yml | tr '\n' ' ')
                    stars=$(./yq eval ".repositories[] | select(.repo == \"$repo\") | .github_metadata.stargazers_count" repos.yml)
                    
                    # Clean up null values
                    [ "$summary" = "null" ] && summary="No description available"
                    [ "$stars" = "null" ] && stars="0"
                    
                    cat >> "by-framework/$framework/README.md" << EOF
### [$repo](https://github.com/$repo)

$summary

**Stars:** $stars | **Tags:** $tags_list

---

EOF
                fi
            done <<< "$repos_with_framework"
            
            echo "  ✓ $framework ($count repositories)"
        fi
    done <<< "$frameworks"
fi

# Create main index README
echo -e "${GREEN}Generating main index README...${NC}"
cat > by-category/README.md << EOF
# Repository Categories

Browse repositories by functional category.

## Available Categories

EOF

while IFS= read -r category; do
    if [ "$category" != "unclassified" ] && [ -n "$category" ]; then
        count=$(./yq eval ".repositories[] | select(.categories[] == \"$category\") | .repo" repos.yml | wc -l)
        cat >> by-category/README.md << EOF
- [$category](./$category/) ($count repositories)
EOF
    fi
done <<< "$categories"

cat > by-tag/README.md << EOF
# Repository Tags

Browse repositories by descriptive tags.

## Available Tags

EOF

while IFS= read -r tag; do
    if [ -n "$tag" ]; then
        count=$(./yq eval ".repositories[] | select(.tags[] == \"$tag\") | .repo" repos.yml | wc -l)
        cat >> by-tag/README.md << EOF
- [$tag](./$tag/) ($count repositories)
EOF
    fi
done <<< "$tags"

if [ -n "$frameworks" ]; then
    cat > by-framework/README.md << EOF
# Repository Frameworks

Browse repositories by specific frameworks.

## Available Frameworks

EOF

    while IFS= read -r framework; do
        if [ -n "$framework" ] && [ "$framework" != "null" ]; then
            count=$(./yq eval ".repositories[] | select(.framework == \"$framework\") | .repo" repos.yml | wc -l)
            cat >> by-framework/README.md << EOF
- [$framework](./$framework/) ($count repositories)
EOF
        fi
    done <<< "$frameworks"
fi

# Generate top-level navigation
echo -e "${GREEN}Creating navigation structure...${NC}"

# Statistics
echo ""
echo -e "${BLUE}📈 Generation Summary${NC}"
echo "===================="
echo "Categories generated: $(find by-category -mindepth 1 -maxdepth 1 -type d | wc -l)"
echo "Tags generated: $(find by-tag -mindepth 1 -maxdepth 1 -type d | wc -l)"
echo "Frameworks generated: $(find by-framework -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l || echo 0)"

echo ""
echo -e "${GREEN}✅ Multi-axis repository structure generated successfully!${NC}"
echo ""
echo "Browse the generated structure:"
echo "  📁 by-category/ - Browse by functional category"
echo "  📁 by-tag/ - Browse by descriptive tags"
echo "  📁 by-framework/ - Browse by specific frameworks"
echo ""
echo "Each directory contains a README.md with repository listings and links."