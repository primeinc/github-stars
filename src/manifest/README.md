# Taxonomy Enforcement System

This directory contains TypeScript modules for enforcing taxonomy constraints on the `repos.yml` manifest.

## Overview

The taxonomy enforcement system ensures that all repositories in the manifest have valid categories and frameworks according to the taxonomy allow-lists. It provides:

1. **Canonicalization**: Normalizes categories and frameworks (trim + lowercase)
2. **Validation**: Strict checking against taxonomy allow-lists
3. **Normalization**: Automatic fixing of invalid data with `needs_review` flags
4. **Security**: Treats AI output as untrusted and validates everything

## Architecture

```
src/manifest/
├── types.ts         # TypeScript type definitions
├── loader.ts        # Load and parse YAML manifests
├── taxonomy.ts      # Taxonomy validation and canonicalization
├── normalizer.ts    # Normalize categories/frameworks
├── validator.ts     # Strict validation logic
├── writer.ts        # Write manifests back to YAML
└── index.ts         # Public API exports
```

## CLI Tools

### Normalize

Normalize the manifest in place:

```bash
pnpm normalize [file]
```

Options:
- `--check` or `--dry-run`: Check if normalization is needed without modifying files

### Validate

Validate the manifest against taxonomy:

```bash
pnpm validate [file]
```

### Repro

Demonstrate fail->pass behavior with test fixtures:

```bash
pnpm repro:taxonomy
```

## Normalization Rules

### Categories

1. **Canonicalization**: Trim whitespace and convert to lowercase
2. **Validation**: Filter against `taxonomy.categories_allowed`
3. **Fallback**: If all categories are invalid, default to `["unclassified"]`
4. **Review Flag**: Set `needs_review: true` if categories were invalid

### Frameworks

1. **Canonicalization**: Trim whitespace and convert to lowercase
2. **Validation**: Check against `taxonomy.frameworks_allowed`
3. **Fallback**: Set to `null` if invalid
4. **Review Flag**: Set `needs_review: true` if framework was invalid

## Integration with Workflows

The taxonomy enforcement is integrated into `.github/workflows/03-classify-repos.yml`:

1. **During Classification**: AI-generated categories/frameworks are canonicalized and validated
2. **After Classification**: The entire manifest is normalized
3. **Verification**: Strict validation ensures no taxonomy violations

## Testing

Unit tests cover:
- All-invalid categories => unclassified + needs_review
- Mixed valid/invalid => invalid removed
- Invalid framework => null + needs_review
- Casing/whitespace normalization

Run tests:

```bash
pnpm test
```

## Security Considerations

- **Untrusted Input**: All AI-generated data is treated as untrusted
- **Taxonomy Authority**: The taxonomy allow-lists are the single source of truth
- **Strict Validation**: No data can bypass taxonomy checks
- **Audit Trail**: Changes are logged and bounded

## Example

Before normalization:

```yaml
categories:
  - infrastructure
  - cli-tools
framework: React
```

After normalization:

```yaml
categories:
  - unclassified
framework: react
needs_review: true
```

## See Also

- [fixtures/repos.invalid.yml](../../fixtures/repos.invalid.yml) - Test fixture with invalid data
- [src/repro-taxonomy.ts](repro-taxonomy.ts) - Executable reproduction script
