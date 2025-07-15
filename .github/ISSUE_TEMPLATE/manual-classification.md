---
name: Manual Repository Classification
about: Manually classify repositories when AI classification fails or needs review
title: "🏷️ Manual Classification: [Repository Name]"
labels: ["manual-classification", "needs-review"]
assignees: []
---

## Repository Information

**Repository:** [owner/name]
**URL:** https://github.com/[owner/name]
**Current Status:** [unclassified/needs-review/ai-failed]

## Current Classification (if any)

- **Categories:** `["unclassified"]`
- **Tags:** `[]`
- **Framework:** `null`
- **Summary:** [current summary if available]

## Proposed Classification

Please provide your manual classification:

```yaml
- repo: "[owner/name]"
  categories: 
    - "[category1]"
    - "[category2]"  # Optional: 1-3 categories max
  tags:
    - "[tag1]"
    - "[tag2]"
    - "[tag3]"  # 3-6 tags recommended
  framework: null  # or "react", "vue", etc.
  summary: "[Brief description of what this repository does]"
  needs_review: false
```

## Reference Information

### Available Categories
`dev-tools`, `ui-libraries`, `frameworks`, `databases`, `productivity`, `learning`, `documentation`, `automation`, `testing`, `deployment`, `monitoring`, `security`, `ai-ml`, `data-science`, `web-dev`, `mobile-dev`, `desktop-dev`, `game-dev`, `embedded`, `networking`, `system-admin`, `cloud`, `containers`, `apis`, `algorithms`, `analytics`, `backup`, `cms`, `communication`, `crypto`, `data-protection`, `education`, `encryption`, `graphics`, `infra`, `libraries`, `media`, `programming-languages`, `search`, `web-development`

### Available Frameworks
`react`, `vue`, `angular`, `svelte`, `nextjs`, `nuxtjs`, `express`, `fastapi`, `django`, `flask`, `rails`, `laravel`, `spring`

### Tag Format Rules
- Must be lowercase with hyphens: `web-scraping`, `real-time`
- Language tags use prefix: `lang:js`, `lang:python`, `lang:rust`
- Namespace tags allowed: `type:library`, `platform:web`

## Additional Context

### Repository Details
- **Language:** [primary programming language]
- **Stars:** [star count]
- **Topics:** [GitHub topics if any]
- **License:** [license if known]
- **Description:** [GitHub description]

### Why Manual Classification is Needed
- [ ] AI classification failed with errors
- [ ] Repository has unique/niche purpose
- [ ] Complex multi-purpose repository
- [ ] Ambiguous or missing description
- [ ] New category needed
- [ ] Other: [explain]

## Checklist

- [ ] Reviewed repository README and code
- [ ] Selected 1-3 most relevant categories
- [ ] Added 3-6 descriptive tags
- [ ] Verified framework assignment (if applicable)
- [ ] Written clear, concise summary
- [ ] Checked tag format compliance
- [ ] Ready for manual merge into repos.yml

---

**Instructions for maintainers:**
1. Review the proposed classification
2. Copy the YAML block to repos.yml under the repositories section
3. Ensure the repository entry exists and update accordingly
4. Validate with `scripts/validate.sh`
5. Commit changes and close this issue