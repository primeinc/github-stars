/**
 * Unit tests for taxonomy module
 */

import { describe, it, expect } from 'vitest';
import {
  canonicalize,
  createCanonicalSet,
  isCategoryAllowed,
  isFrameworkAllowed,
  filterValidCategories,
  validateFramework,
} from './taxonomy.js';
import type { Taxonomy } from './types.js';

describe('taxonomy', () => {
  const mockTaxonomy: Taxonomy = {
    categories_allowed: ['dev-tools', 'ui-libraries', 'frameworks'],
    frameworks_allowed: ['react', 'vue', 'angular'],
  };

  describe('canonicalize', () => {
    it('should trim and lowercase', () => {
      expect(canonicalize('  Dev-Tools  ')).toBe('dev-tools');
      expect(canonicalize('UI-LIBRARIES')).toBe('ui-libraries');
      expect(canonicalize('React')).toBe('react');
    });

    it('should handle empty strings', () => {
      expect(canonicalize('')).toBe('');
      expect(canonicalize('   ')).toBe('');
    });
  });

  describe('createCanonicalSet', () => {
    it('should create a set of canonicalized values', () => {
      const set = createCanonicalSet(['Dev-Tools', '  UI-Libraries  ', 'FRAMEWORKS']);
      expect(set.has('dev-tools')).toBe(true);
      expect(set.has('ui-libraries')).toBe(true);
      expect(set.has('frameworks')).toBe(true);
      expect(set.size).toBe(3);
    });
  });

  describe('isCategoryAllowed', () => {
    it('should return true for allowed categories (case-insensitive)', () => {
      expect(isCategoryAllowed('dev-tools', mockTaxonomy)).toBe(true);
      expect(isCategoryAllowed('Dev-Tools', mockTaxonomy)).toBe(true);
      expect(isCategoryAllowed('DEV-TOOLS', mockTaxonomy)).toBe(true);
      expect(isCategoryAllowed('  dev-tools  ', mockTaxonomy)).toBe(true);
    });

    it('should return false for disallowed categories', () => {
      expect(isCategoryAllowed('invalid', mockTaxonomy)).toBe(false);
      expect(isCategoryAllowed('cli-tools', mockTaxonomy)).toBe(false);
    });
  });

  describe('isFrameworkAllowed', () => {
    it('should return true for allowed frameworks (case-insensitive)', () => {
      expect(isFrameworkAllowed('react', mockTaxonomy)).toBe(true);
      expect(isFrameworkAllowed('React', mockTaxonomy)).toBe(true);
      expect(isFrameworkAllowed('REACT', mockTaxonomy)).toBe(true);
      expect(isFrameworkAllowed('  vue  ', mockTaxonomy)).toBe(true);
    });

    it('should return false for disallowed frameworks', () => {
      expect(isFrameworkAllowed('invalid', mockTaxonomy)).toBe(false);
      expect(isFrameworkAllowed('nextjs', mockTaxonomy)).toBe(false);
    });

    it('should return false when frameworks_allowed is undefined', () => {
      const taxonomyNoFrameworks: Taxonomy = {
        categories_allowed: ['dev-tools'],
      };
      expect(isFrameworkAllowed('react', taxonomyNoFrameworks)).toBe(false);
    });
  });

  describe('filterValidCategories', () => {
    it('should filter out invalid categories', () => {
      const categories = ['dev-tools', 'invalid', 'ui-libraries', 'another-invalid'];
      const result = filterValidCategories(categories, mockTaxonomy);
      expect(result).toEqual(['dev-tools', 'ui-libraries']);
    });

    it('should canonicalize valid categories', () => {
      const categories = ['Dev-Tools', '  UI-LIBRARIES  ', 'Frameworks'];
      const result = filterValidCategories(categories, mockTaxonomy);
      expect(result).toEqual(['dev-tools', 'ui-libraries', 'frameworks']);
    });

    it('should return empty array when all categories are invalid', () => {
      const categories = ['invalid1', 'invalid2'];
      const result = filterValidCategories(categories, mockTaxonomy);
      expect(result).toEqual([]);
    });
  });

  describe('validateFramework', () => {
    it('should return canonical framework for valid frameworks', () => {
      expect(validateFramework('React', mockTaxonomy)).toBe('react');
      expect(validateFramework('VUE', mockTaxonomy)).toBe('vue');
      expect(validateFramework('  angular  ', mockTaxonomy)).toBe('angular');
    });

    it('should return null for invalid frameworks', () => {
      expect(validateFramework('invalid', mockTaxonomy)).toBe(null);
      expect(validateFramework('nextjs', mockTaxonomy)).toBe(null);
    });

    it('should return null for null/undefined input', () => {
      expect(validateFramework(null, mockTaxonomy)).toBe(null);
      expect(validateFramework(undefined, mockTaxonomy)).toBe(null);
    });

    it('should return null when frameworks_allowed is undefined', () => {
      const taxonomyNoFrameworks: Taxonomy = {
        categories_allowed: ['dev-tools'],
      };
      expect(validateFramework('react', taxonomyNoFrameworks)).toBe(null);
    });
  });
});
