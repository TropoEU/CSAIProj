import { describe, it, expect } from 'vitest';
import { safeJsonParse, safeJsonGet } from '../../../src/utils/jsonUtils.js';

describe('jsonUtils', () => {
  describe('safeJsonParse', () => {
    describe('Basic parsing', () => {
      it('should parse valid JSON string', () => {
        const result = safeJsonParse('{"name":"John","age":30}');
        expect(result).toEqual({ name: 'John', age: 30 });
      });

      it('should parse JSON array', () => {
        const result = safeJsonParse('[1,2,3]');
        expect(result).toEqual([1, 2, 3]);
      });

      it('should parse JSON primitives', () => {
        expect(safeJsonParse('"hello"')).toBe('hello');
        expect(safeJsonParse('123')).toBe(123);
        expect(safeJsonParse('true')).toBe(true);
        expect(safeJsonParse('false')).toBe(false);
        expect(safeJsonParse('null')).toBe(null);
      });

      it('should return fallback for invalid JSON', () => {
        const result = safeJsonParse('{invalid json}', { default: true });
        expect(result).toEqual({ default: true });
      });

      it('should return null fallback by default for invalid JSON', () => {
        const result = safeJsonParse('{invalid}');
        expect(result).toBeNull();
      });

      it('should handle empty string', () => {
        const result = safeJsonParse('', { empty: true });
        expect(result).toEqual({ empty: true });
      });
    });

    describe('Null/undefined handling', () => {
      it('should return fallback for null input', () => {
        const result = safeJsonParse(null, { fallback: true });
        expect(result).toEqual({ fallback: true });
      });

      it('should return fallback for undefined input', () => {
        const result = safeJsonParse(undefined, { fallback: true });
        expect(result).toEqual({ fallback: true });
      });

      it('should return default null for null input without fallback', () => {
        const result = safeJsonParse(null);
        expect(result).toBeNull();
      });
    });

    describe('Object handling', () => {
      it('should return object as-is if already parsed', () => {
        const obj = { name: 'Alice', age: 25 };
        const result = safeJsonParse(obj);
        expect(result).toEqual(obj);
      });

      it('should handle array objects', () => {
        const arr = [1, 2, 3];
        const result = safeJsonParse(arr);
        expect(result).toEqual(arr);
      });
    });

    describe('Non-string, non-object handling', () => {
      it('should return fallback for number input', () => {
        const result = safeJsonParse(123, { fallback: true });
        expect(result).toEqual({ fallback: true });
      });

      it('should return fallback for boolean input', () => {
        const result = safeJsonParse(true, { fallback: true });
        expect(result).toEqual({ fallback: true });
      });
    });

    describe('Prototype pollution protection', () => {
      it('should remove __proto__ from parsed JSON', () => {
        const malicious = '{"__proto__":{"isAdmin":true},"name":"hacker"}';
        const result = safeJsonParse(malicious);
        expect(result.__proto__).toBeUndefined();
        expect(result.name).toBe('hacker');
        // Verify pollution didn't happen
        expect({}.isAdmin).toBeUndefined();
      });

      it('should remove constructor from parsed JSON', () => {
        const malicious = '{"constructor":{"prototype":{"isAdmin":true}},"name":"hacker"}';
        const result = safeJsonParse(malicious);
        expect(result.constructor).toBeUndefined();
        expect(result.name).toBe('hacker');
      });

      it('should remove prototype from parsed JSON', () => {
        const malicious = '{"prototype":{"isAdmin":true},"name":"hacker"}';
        const result = safeJsonParse(malicious);
        expect(result.prototype).toBeUndefined();
        expect(result.name).toBe('hacker');
      });

      it('should clean dangerous properties from object input', () => {
        const obj = {
          __proto__: { isAdmin: true },
          constructor: { prototype: { isAdmin: true } },
          prototype: { isAdmin: true },
          name: 'test',
        };
        const result = safeJsonParse(obj);
        expect(result.__proto__).toBeUndefined();
        expect(result.constructor).toBeUndefined();
        expect(result.prototype).toBeUndefined();
        expect(result.name).toBe('test');
      });

      it('should handle nested objects with dangerous properties', () => {
        const malicious = '{"data":{"__proto__":{"isAdmin":true}},"safe":"value"}';
        const result = safeJsonParse(malicious);
        expect(result.safe).toBe('value');
        expect(result.data).toBeDefined();
      });
    });

    describe('Edge cases', () => {
      it('should handle deeply nested JSON', () => {
        const deep = '{"a":{"b":{"c":{"d":"value"}}}}';
        const result = safeJsonParse(deep);
        expect(result.a.b.c.d).toBe('value');
      });

      it('should handle JSON with unicode', () => {
        const unicode = '{"emoji":"😀","hebrew":"שלום"}';
        const result = safeJsonParse(unicode);
        expect(result.emoji).toBe('😀');
        expect(result.hebrew).toBe('שלום');
      });

      it('should handle JSON with special characters', () => {
        const special = '{"quote":"\\"hello\\"","newline":"line1\\nline2"}';
        const result = safeJsonParse(special);
        expect(result.quote).toBe('"hello"');
        expect(result.newline).toBe('line1\nline2');
      });
    });
  });

  describe('safeJsonGet', () => {
    describe('Basic key extraction', () => {
      it('should extract key from valid JSON string', () => {
        const json = '{"name":"John","age":30}';
        expect(safeJsonGet(json, 'name')).toBe('John');
        expect(safeJsonGet(json, 'age')).toBe(30);
      });

      it('should extract key from object', () => {
        const obj = { name: 'Alice', age: 25 };
        expect(safeJsonGet(obj, 'name')).toBe('Alice');
        expect(safeJsonGet(obj, 'age')).toBe(25);
      });

      it('should return fallback for missing key', () => {
        const json = '{"name":"John"}';
        expect(safeJsonGet(json, 'age', 0)).toBe(0);
      });

      it('should return null fallback by default for missing key', () => {
        const json = '{"name":"John"}';
        expect(safeJsonGet(json, 'age')).toBeNull();
      });
    });

    describe('Invalid input handling', () => {
      it('should return fallback for invalid JSON string', () => {
        const result = safeJsonGet('{invalid}', 'key', 'default');
        expect(result).toBe('default');
      });

      it('should return fallback for null input', () => {
        const result = safeJsonGet(null, 'key', 'default');
        expect(result).toBe('default');
      });

      it('should return fallback for undefined input', () => {
        const result = safeJsonGet(undefined, 'key', 'default');
        expect(result).toBe('default');
      });

      it('should return fallback for non-object parsed result', () => {
        const result = safeJsonGet('"just a string"', 'key', 'default');
        expect(result).toBe('default');
      });

      it('should return fallback for number input', () => {
        const result = safeJsonGet(123, 'key', 'default');
        expect(result).toBe('default');
      });
    });

    describe('Nested key extraction', () => {
      it('should extract from nested object', () => {
        const json = '{"user":{"name":"John","email":"john@example.com"}}';
        const user = safeJsonGet(json, 'user');
        expect(user).toEqual({ name: 'John', email: 'john@example.com' });
      });

      it('should handle arrays', () => {
        const json = '{"items":[1,2,3]}';
        const items = safeJsonGet(json, 'items');
        expect(items).toEqual([1, 2, 3]);
      });
    });

    describe('Special value handling', () => {
      it('should distinguish undefined from null in object', () => {
        const obj = { nullValue: null, name: 'test' };
        expect(safeJsonGet(obj, 'nullValue', 'default')).toBeNull();
        expect(safeJsonGet(obj, 'missing', 'default')).toBe('default');
      });

      it('should handle zero values', () => {
        const obj = { count: 0, name: 'test' };
        expect(safeJsonGet(obj, 'count', 10)).toBe(0);
      });

      it('should handle empty string values', () => {
        const obj = { message: '', name: 'test' };
        expect(safeJsonGet(obj, 'message', 'default')).toBe('');
      });

      it('should handle false values', () => {
        const obj = { active: false, name: 'test' };
        expect(safeJsonGet(obj, 'active', true)).toBe(false);
      });
    });

    describe('Prototype pollution protection', () => {
      it('should not extract dangerous __proto__ key', () => {
        const malicious = '{"__proto__":{"isAdmin":true},"name":"hacker"}';
        const result = safeJsonGet(malicious, '__proto__', 'safe');
        expect(result).toBe('safe');
      });

      it('should not extract dangerous constructor key', () => {
        const malicious = '{"constructor":{"prototype":{"isAdmin":true}}}';
        const result = safeJsonGet(malicious, 'constructor', 'safe');
        expect(result).toBe('safe');
      });

      it('should not extract dangerous prototype key', () => {
        const malicious = '{"prototype":{"isAdmin":true}}';
        const result = safeJsonGet(malicious, 'prototype', 'safe');
        expect(result).toBe('safe');
      });
    });
  });
});
