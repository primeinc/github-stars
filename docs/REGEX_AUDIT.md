# Regular Expression Audit

**Generated:** 2026-01-29 11:33 UTC  
**Branch:** pr-16  
**Purpose:** Complete inventory of all regex patterns used in workflows

---

## Executive Summary

| Category | Count | Risk Level |
|----------|-------|------------|
| Input Sanitization | 6 | 🔴 High |
| String Formatting | 5 | 🟡 Medium |
| Schema Validation | 2 | 🟢 Low |
| **TOTAL** | **13** | - |

---

## 02-sync-stars.yml

### Line 107: Camel Case Splitting
```javascript
.replace(/([a-z])([A-Z])/g, '$1 $2')
```
**Purpose:** Convert `camelCase` to `camel Case`  
**Risk:** Low  
**Alternative:** `text.split(/(?=[A-Z])/).join(' ')`

### Line 108: Whitespace Normalization
```javascript
.replace(/\s+/g, ' ')
```
**Purpose:** Collapse multiple spaces to single space  
**Risk:** Low  
**Alternative:** `text.split(/\s+/).join(' ')`

---

## 03-classify-repos.yml

### Line 82: Control Character Removal
```javascript
.replace(/[\x00-\x1F\x7F]/g, '')
```
**Purpose:** Strip control characters (ASCII 0-31, 127)  
**Risk:** Medium (security-critical)  
**Alternative (jq):**
```bash
jq 'gsub("[\\u0000-\\u001F\\u007F]"; "")'
```

### Line 83: Whitespace Normalization
```javascript
.replace(/\s+/g, ' ')
```
**Purpose:** Collapse whitespace  
**Risk:** Low  
**Alternative (jq):**
```bash
jq 'gsub("\\s+"; " ")'
```

### Line 84: Consecutive Quote Removal ⚠️ PATCHED
```javascript
.replace(/(['"`])\1+/g, '$1')
```
**Purpose:** Remove duplicate quotes (`"""` → `"`)  
**Risk:** High (was broken: removed ALL quotes)  
**Note:** Fixed in current PR branch  
**Alternative (jq):**
```bash
jq 'gsub("(['\\''\"`])\\\\1+"; "\\\\1")'
```

### Line 90: Repository Name Validation
```javascript
String(r.repo).replace(/[^a-zA-Z0-9/_.-]/g, '')
```
**Purpose:** Strip invalid repo name characters  
**Risk:** Medium (allows path traversal with `/`)  
**Pattern Matches:** `owner/repo`, `owner/repo.name`, `owner/my-repo`  
**Alternative (jq):**
```bash
jq '.repo | gsub("[^a-zA-Z0-9/_.-]"; "")'
```

### Line 156: Markdown Code Block Stripping
```javascript
.replace(/^```json\s*/i, '').replace(/\s*```$/i, '')
```
**Purpose:** Remove AI-generated markdown wrappers  
**Risk:** Low  
**Alternative:** Use start/end position parsing

### Line 160: Trailing Comma Cleanup
```javascript
result.replace(/,(\s*[\]}])/g, '$1')
```
**Purpose:** Fix JSON syntax (`,]` → `]`)  
**Risk:** Low  
**Alternative:** Use JSON5 parser or AST-based fix

### Line 162: Newline in JSON Strings
```javascript
result.replace(/:\s*"([^"]*)\n([^"]*)"/g, (m, a, b) => `: "${a}\\n${b}"`)
```
**Purpose:** Escape literal newlines in JSON values  
**Risk:** High (unsafe: doesn't handle multiple newlines)  
**Bug:** Only fixes ONE newline per string  
**Alternative (jq):** Pre-escape input before AI

### Line 236: Tag Sanitization Pipeline
```javascript
.map(t => String(t).toLowerCase()
  .replace(/[^a-z0-9-:]/g, '-')
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '')
)
```
**Purpose:** Normalize tags (allow `lang:python` namespace)  
**Risk:** Medium (colon creates filename issues on Windows)  
**Pattern Matches:** `lang:python`, `my-tag`, `tag123`  
**Note:** Conflicts with `sanitizeFilename` in 05-generate-readmes.yml  
**Alternative:** Use `jq` pipeline

---

## 05-generate-readmes.yml

### Line 59: Slugify Function
```javascript
text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
```
**Purpose:** Convert text to URL-safe slug  
**Risk:** Low  
**Example:** `"Hello World!"` → `"hello-world"`  
**Alternative:** Use `jq` `gsub`

### Line 73: Namespace Colon Replacement
```javascript
text.replace(/:/g, '-')
```
**Purpose:** Convert `lang:python` → `lang-python`  
**Risk:** Low  
**Note:** THIS is the correct namespace handling  
**Alternative:** `jq '.tag | gsub(":"; "-")'`

### Line 76: Invalid Filename Characters
```javascript
safe.replace(/[<>"|?*\/\\]/g, '-')
```
**Purpose:** Strip Windows-forbidden characters  
**Risk:** Low  
**Characters Blocked:** `< > : " | ? * / \`  
**Alternative:** `jq 'gsub("[<>:\"|?*\\\\/]"; "-")'`

### Line 79: Collapse Multiple Dashes
```javascript
safe.replace(/-+/g, '-')
```
**Purpose:** `my---tag` → `my-tag`  
**Risk:** Low  
**Alternative:** `jq 'gsub("-+"; "-")'`

### Line 82: Trim Leading/Trailing Dashes
```javascript
safe.replace(/^-+|-+$/g, '')
```
**Purpose:** `-tag-` → `tag`  
**Risk:** Low  
**Alternative:** `jq 'gsub("^-+|-+$"; "")'`

### Line 96: Markdown Escaping
```javascript
(text || '').replace(/([*_`\[\]])/g, '\\$1')
```
**Purpose:** Escape special Markdown characters  
**Risk:** Low  
**Escapes:** `* _ \` [ ]`  
**Alternative:** Use markdown library

### Line 103: Newline to Space in Descriptions
```javascript
(repo.summary || 'No description').replace(/\n/g, ' ')
```
**Purpose:** Single-line summaries for tables  
**Risk:** Low  
**Alternative:** `.split('\n').join(' ')`

---

## schemas/repos-schema.json

### Repository Name Pattern
```regex
^[a-zA-Z0-9][a-zA-Z0-9-]*/[a-zA-Z0-9._-]+$
```
**Location:** `properties.repositories.items.properties.repo.pattern`  
**Purpose:** Validate `owner/repo` format  
**Risk:** Low  
**Matches:** `microsoft/vscode`, `rust-lang/rust`, `python/cpython`  
**Does NOT Match:** `/hacker/repo`, `../../../etc/passwd`

### Tag Pattern
```regex
^([a-z]+:)?[a-z0-9][a-z0-9-]*$
```
**Location:** `properties.repositories.items.properties.tags.items.pattern`  
**Purpose:** Validate tag format (with optional namespace)  
**Risk:** Low  
**Matches:** `python`, `lang:rust`, `ai-ml`, `web-dev`  
**Does NOT Match:** `UPPERCASE`, `-leading`, `special!chars`

---

## Risk Assessment

### 🔴 Critical Issues

1. **Line 162 (03-classify-repos.yml)** - Newline handling is incomplete
   - **Impact:** Multi-line strings in JSON will break
   - **Fix:** Use `jq` or proper JSON escaping

2. **Line 236 (03-classify-repos.yml)** - Tag pattern allows colons
   - **Impact:** Conflicts with Windows filename restrictions
   - **Fix:** Already handled by `sanitizeFilename` in 05-generate-readmes.yml

### 🟡 Medium Issues

1. **Line 90 (03-classify-repos.yml)** - Repo name allows `/`
   - **Impact:** Potential path traversal if used in file paths
   - **Mitigation:** Only used for GitHub API calls (safe)

2. **Line 82-84 (03-classify-repos.yml)** - Input sanitization fragility
   - **Impact:** Regex escaping edge cases, prompt injection risk
   - **Fix:** Replace with `jq` transformations

### 🟢 Low Risk

All other patterns are safe string transformations with predictable behavior.

---

## Recommendations

### Priority 1: Replace Sanitization with jq

**Before:**
```javascript
const sanitizeText = (text) => {
  return text
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/(['"`])\1+/g, '$1')
    .trim()
    .slice(0, 500);
};
```

**After:**
```yaml
- name: Sanitize with jq
  run: |
    echo '${{ inputs.batch_data }}' | \
    jq 'map({
      repo: (.repo | gsub("[^a-zA-Z0-9/_.-]"; "")),
      summary: (.summary // "" 
        | gsub("[\\u0000-\\u001F\\u007F]"; "") 
        | gsub("\\s+"; " ") 
        | .[0:500]),
      topics: (.topics // [] | .[0:10])
    })'
```

### Priority 2: Unified Tag/Filename Handling

Create a single source of truth for filename sanitization:

```javascript
// Workflow 03: Generate tags with safe names
const tagToFilename = (tag) => {
  return tag.replace(/:/g, '-')  // namespace
             .replace(/[^a-z0-9-]/g, '-')
             .replace(/-+/g, '-')
             .replace(/^-|-$/g, '');
};
```

### Priority 3: Schema Enforcement

Add JSON Schema validation for AI responses BEFORE processing:

```yaml
- name: Validate AI response
  run: |
    ajv validate -s schemas/ai-response-schema.json -d ai-response.json
```

---

## Testing Checklist

- [ ] Test `lang:python` → `lang-python.md`
- [ ] Test `CON` → `_CON.md` (Windows reserved)
- [ ] Test multi-line JSON strings
- [ ] Test consecutive quotes `"""test"""`
- [ ] Test repo names with special chars
- [ ] Test tags with Unicode (should fail)
- [ ] Test empty strings (should return defaults)

---

**Generated by:** Regex audit script  
**Last Updated:** 2026-01-29  
**Maintainer:** primeinc/github-stars
