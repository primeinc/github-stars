/**
 * Taxonomy module for validation and canonicalization of categories and frameworks
 */

import type { Taxonomy } from './types.js';

/**
 * Canonicalize a category or framework name (trim + lowercase)
 */
export function canonicalize(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Create a canonicalized Set from an array of strings for fast lookups
 */
export function createCanonicalSet(values: string[]): Set<string> {
  return new Set(values.map(canonicalize));
}

/**
 * Check if a category is in the allowed list (case-insensitive)
 */
export function isCategoryAllowed(category: string, taxonomy: Taxonomy): boolean {
  const canonical = canonicalize(category);
  const allowedSet = createCanonicalSet(taxonomy.categories_allowed);
  return allowedSet.has(canonical);
}

/**
 * Check if a framework is in the allowed list (case-insensitive)
 */
export function isFrameworkAllowed(framework: string, taxonomy: Taxonomy): boolean {
  if (!taxonomy.frameworks_allowed) {
    return false;
  }
  const canonical = canonicalize(framework);
  const allowedSet = createCanonicalSet(taxonomy.frameworks_allowed);
  return allowedSet.has(canonical);
}

/**
 * Filter categories to only those in the allowed list, with canonicalization
 * Returns canonical versions of valid categories
 */
export function filterValidCategories(categories: string[], taxonomy: Taxonomy): string[] {
  const allowedSet = createCanonicalSet(taxonomy.categories_allowed);
  
  return categories
    .map(canonicalize)
    .filter(cat => allowedSet.has(cat));
}

/**
 * Validate and return canonical framework name, or null if invalid
 */
export function validateFramework(framework: string | null | undefined, taxonomy: Taxonomy): string | null {
  if (!framework || typeof framework !== 'string') {
    return null;
  }

  const canonical = canonicalize(framework);
  
  if (!taxonomy.frameworks_allowed) {
    return null;
  }

  const allowedSet = createCanonicalSet(taxonomy.frameworks_allowed);
  return allowedSet.has(canonical) ? canonical : null;
}
