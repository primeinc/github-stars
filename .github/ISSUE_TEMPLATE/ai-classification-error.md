---
name: AI Classification Error
about: Report issues with AI-powered repository classification
title: "🤖 AI Classification Failed: [Batch/Repository]"
labels: ["ai-classification", "bug", "needs-review"]
assignees: []
---

## Error Information

**Workflow Run:** [Link to failed workflow run]
**Date/Time:** [When the error occurred]
**Batch Size:** [Number of repositories being processed]
**Model Used:** [e.g., openai/gpt-4o]

## Error Details

```
[Paste the error message or validation failure details here]
```

## Affected Repositories

**Number of repositories:** [count]

**Repository list:**
- `owner/repo1`
- `owner/repo2`
- `owner/repo3`
[List all affected repositories]

## AI Response (if available)

### Original Classification Response
```json
[Paste the AI's classification response if available]
```

### Validation Result
```
[Paste the validation error message if available]
```

## Context

### Potential Causes
- [ ] API rate limits exceeded
- [ ] Invalid JSON response from AI
- [ ] Schema validation failure
- [ ] Timeout/connectivity issues
- [ ] AI model temporarily unavailable
- [ ] Prompt engineering issue
- [ ] Repository metadata incomplete
- [ ] Other: [explain]

### Repository Characteristics
- **Languages:** [primary languages in the batch]
- **Repository types:** [forks, archived, etc.]
- **Topics:** [common GitHub topics]
- **Special cases:** [unusual repositories, edge cases]

## Immediate Actions Needed

- [ ] Manual classification of affected repositories
- [ ] Update classification prompts if needed
- [ ] Retry classification with smaller batch size
- [ ] Investigate API connectivity issues
- [ ] Review and update validation rules

## Diagnostic Information

### Environment
- **Workflow:** [01-fetch-stars/02-sync-stars/03-curate-stars]
- **Runner:** [ubuntu-latest]
- **yq version:** [version if relevant]
- **Batch limit:** [configured batch limit]

### Recent Changes
- [ ] Recent updates to classification prompts
- [ ] Schema changes
- [ ] Workflow modifications
- [ ] New repositories with unusual characteristics

## Proposed Solutions

### Short-term
1. Manual classification of critical repositories
2. Retry with smaller batch size
3. Skip problematic repositories temporarily

### Long-term
1. Improve error handling in workflows
2. Enhance validation rules
3. Update classification prompts
4. Add retry mechanisms with exponential backoff

## Follow-up Actions

- [ ] Fix immediate classification issues
- [ ] Update documentation if needed
- [ ] Improve error handling in workflows
- [ ] Test with sample repositories
- [ ] Monitor future classification runs

---

**For maintainers:**
1. Investigate the root cause using workflow logs
2. Manually classify affected repositories if needed
3. Implement fixes to prevent similar issues
4. Re-run the classification workflow
5. Update this issue with resolution details