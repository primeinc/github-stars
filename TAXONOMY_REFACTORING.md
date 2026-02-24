# Taxonomy Enforcement Refactoring - Implementation Summary

## Problem Statement
The 03-Classify Repos workflow was failing during Post-Classification Verification because:
- `repos.yml` contained categories/frameworks not in the taxonomy allow-list (e.g., `infrastructure`, `cli-tools`, `devops`)
- Current sanitization only affected the current batch, not legacy data
- Verification validated the entire manifest, causing hard failures

**Example Failures:**
- https://github.com/primeinc/github-stars/actions/runs/22339929257/job/64640771254

## Solution Architecture

### 1. TypeScript Modules (`src/manifest/`)

Created a comprehensive taxonomy enforcement system:

```
src/manifest/
├── types.ts         # TypeScript interfaces for manifest data
├── loader.ts        # Load and parse YAML manifests
├── taxonomy.ts      # Canonicalization and validation logic
├── normalizer.ts    # Normalize categories/frameworks
├── validator.ts     # Strict validation against taxonomy
├── writer.ts        # Write manifests back to YAML
└── index.ts         # Public API exports
```

**Key Features:**
- **Canonicalization**: Trim whitespace and lowercase for case-insensitive matching
- **Automatic Fallback**: Invalid categories → `["unclassified"]`
- **Review Flags**: Set `needs_review: true` when data is normalized
- **Security**: Treat AI output as untrusted

### 2. CLI Tools

Three executable commands for different use cases:

#### `pnpm normalize [file]`
Normalizes the manifest in place:
- Canonicalizes categories and frameworks
- Filters invalid values
- Sets needs_review flags
- Updates manifest_updated_at timestamp

Options:
- `--check` or `--dry-run`: Check if normalization is needed without modifying files

#### `pnpm validate [file]`
Strictly validates against taxonomy:
- Checks all categories (except `unclassified`)
- Validates frameworks
- Warns about tag format issues
- Exits non-zero on errors

#### `pnpm repro:taxonomy`
Demonstrates fail→pass behavior:
- Phase 1: Validates fixture with invalid data (fails with clear errors)
- Phase 2: Normalizes and re-validates (passes)
- Shows exactly what changes are made

### 3. Workflow Integration

Updated `.github/workflows/03-classify-repos.yml`:

```yaml
# New steps added:
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '22'

- name: Install pnpm
  run: npm install -g pnpm@latest

- name: Install dependencies
  run: pnpm install

# After classification:
- name: Normalize Manifest
  if: steps.apply.outputs.count > 0
  run: |
    echo "Running taxonomy normalization..."
    pnpm normalize
    echo "Normalization complete"

- name: Post-Classification Verification
  if: steps.apply.outputs.count > 0
  run: |
    echo "Running strict taxonomy validation..."
    pnpm validate
    echo "Validation passed"
```

**Also updated Apply step** to use canonicalized taxonomy checks inline for AI output.

### 4. CI Integration

Created `.github/workflows/00-ci.yml`:
- Runs on PRs and pushes to main
- Executes unit tests (24 tests)
- Runs repro script
- Validates repos.yml
- Uses explicit permissions for security

### 5. Testing

**Unit Tests** (`src/manifest/*.test.ts`):
- Taxonomy canonicalization (trim, lowercase)
- All-invalid categories → unclassified + needs_review
- Mixed valid/invalid → invalid removed
- Invalid framework → null + needs_review
- Casing/whitespace normalization

**Test Fixture** (`fixtures/repos.invalid.yml`):
- 5 repos with various invalid data
- Tests all normalization scenarios

**All 24 tests passing ✅**

### 6. Documentation

Created `src/manifest/README.md`:
- Architecture overview
- CLI tool usage
- Normalization rules
- Integration with workflows
- Security considerations
- Examples

## Results

### Immediate Impact
- **20 repos normalized** with invalid categories/frameworks
- **repos.yml passes validation** (0 errors)
- **Workflow no longer fails** due to legacy data

### Changes Made
Example repos normalized:
- `purarue/google_takeout_parser`: Removed `cli-tools`
- `Azure-Samples/azure-files-samples`: Removed `infrastructure`
- `julianromli/opencode-template`: Removed `devops`, `infrastructure` → `unclassified`
- `simple-icons/simple-icons`: Removed `design`

### Validation Before/After
**Before:**
```
❌ VALIDATION FAILED: 21 errors
```

**After:**
```
✅ VALIDATION PASSED
```

## Acceptance Criteria - All Met ✅

1. ✅ **pnpm repro:taxonomy** demonstrates fail→pass behavior deterministically
2. ✅ **Workflow no longer fails** due to legacy invalid categories/frameworks
3. ✅ **Strict validation** yields 0 taxonomy violations after normalization
4. ✅ **Logs are auditable and bounded** (max 50 changes shown)
5. ✅ **Tests added** and passing (24 unit tests)
6. ✅ **Executable repro command** exists and is required
7. ✅ **TS code is single source of truth** for normalize+validate

## Security Summary

✅ **No vulnerabilities** detected by CodeQL
✅ **Taxonomy enforcement** treats AI output as untrusted
✅ **All data validated** against allow-lists
✅ **Explicit workflow permissions** configured
✅ **Reproducible builds** with committed pnpm-lock.yaml

## Usage Examples

### For Developers

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Validate current manifest
pnpm validate

# Normalize manifest (dry run)
pnpm normalize --check

# Normalize manifest (apply changes)
pnpm normalize

# See how normalization works
pnpm repro:taxonomy
```

### For CI/CD

The workflows now automatically:
1. Normalize manifest after AI classification
2. Validate strictly before committing
3. Run tests on PRs to prevent regressions

## Future Enhancements

Potential improvements (not required for this PR):
- Add more taxonomy categories (e.g., `cli-tools` → `dev-tools` mapping)
- Implement auto-correction suggestions
- Add metrics/dashboards for needs_review flags
- Create a taxonomy management UI

## References

- **Issue**: Fix 03-Classify Repos failures by refactoring taxonomy enforcement into TS code + executable repro
- **Failing Job**: https://github.com/primeinc/github-stars/actions/runs/22339929257/job/64640771254
- **Code**: `src/manifest/`, `fixtures/repos.invalid.yml`
- **Workflows**: `.github/workflows/03-classify-repos.yml`, `.github/workflows/00-ci.yml`
- **Documentation**: `src/manifest/README.md`

---

**Status**: ✅ Complete and ready for merge
**Tests**: ✅ All passing (24/24)
**Security**: ✅ No vulnerabilities
**Documentation**: ✅ Comprehensive
