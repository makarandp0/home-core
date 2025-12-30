import { describe, it, expect } from 'vitest';
import { trimField, toTitleCase, sanitizeFilename, trimAndTitleCase } from './string-sanitize.js';

describe('trimField', () => {
  it('trims leading and trailing whitespace', () => {
    expect(trimField('  hello  ')).toBe('hello');
    expect(trimField('\t world\n')).toBe('world');
    expect(trimField('  foo bar  ')).toBe('foo bar');
  });

  it('returns the same string when no whitespace to trim', () => {
    expect(trimField('hello')).toBe('hello');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(trimField('   ')).toBe('');
    expect(trimField('\t\n')).toBe('');
  });

  it('preserves null values', () => {
    expect(trimField(null)).toBeNull();
  });

  it('preserves undefined values', () => {
    expect(trimField(undefined)).toBeUndefined();
  });
});

describe('toTitleCase', () => {
  it('converts uppercase string to title case', () => {
    expect(toTitleCase('JOHN DOE')).toBe('John Doe');
    expect(toTitleCase('HELLO WORLD')).toBe('Hello World');
  });

  it('converts lowercase string to title case', () => {
    expect(toTitleCase('john doe')).toBe('John Doe');
    expect(toTitleCase('hello world')).toBe('Hello World');
  });

  it('handles mixed case input', () => {
    expect(toTitleCase('jOhN dOe')).toBe('John Doe');
  });

  it('handles single word', () => {
    expect(toTitleCase('HELLO')).toBe('Hello');
    expect(toTitleCase('hello')).toBe('Hello');
  });

  it('handles empty string', () => {
    expect(toTitleCase('')).toBe('');
  });

  it('handles multiple spaces between words', () => {
    expect(toTitleCase('hello  world')).toBe('Hello  World');
  });

  it('handles leading and trailing spaces', () => {
    expect(toTitleCase(' hello ')).toBe(' Hello ');
  });

  it('handles single character words', () => {
    expect(toTitleCase('a b c')).toBe('A B C');
  });
});

describe('sanitizeFilename', () => {
  it('removes file extension and converts to title case', () => {
    expect(sanitizeFilename('my_document.pdf')).toBe('My Document');
    expect(sanitizeFilename('PASSPORT-SCAN.jpg')).toBe('Passport Scan');
  });

  it('replaces underscores with spaces', () => {
    expect(sanitizeFilename('hello_world.txt')).toBe('Hello World');
    expect(sanitizeFilename('first_second_third.doc')).toBe('First Second Third');
  });

  it('replaces hyphens with spaces', () => {
    expect(sanitizeFilename('hello-world.txt')).toBe('Hello World');
    expect(sanitizeFilename('first-second-third.doc')).toBe('First Second Third');
  });

  it('handles mixed underscores and hyphens', () => {
    expect(sanitizeFilename('hello_world-test.pdf')).toBe('Hello World Test');
  });

  it('handles filenames without extension', () => {
    expect(sanitizeFilename('my_document')).toBe('My Document');
    expect(sanitizeFilename('HELLO-WORLD')).toBe('Hello World');
  });

  it('handles dotfiles (leading dot)', () => {
    expect(sanitizeFilename('.gitignore')).toBe('.gitignore');
    expect(sanitizeFilename('.env')).toBe('.env');
  });

  it('handles multiple dots in filename', () => {
    expect(sanitizeFilename('my.document.backup.pdf')).toBe('My.document.backup');
  });

  it('trims leading and trailing whitespace', () => {
    expect(sanitizeFilename('  my_doc.pdf  ')).toBe('My Doc');
  });

  it('handles empty string', () => {
    expect(sanitizeFilename('')).toBe('');
  });
});

describe('trimAndTitleCase', () => {
  it('trims whitespace and converts to title case', () => {
    expect(trimAndTitleCase('  john doe  ')).toBe('John Doe');
    expect(trimAndTitleCase('\tHELLO WORLD\n')).toBe('Hello World');
  });

  it('handles string without leading/trailing whitespace', () => {
    expect(trimAndTitleCase('john doe')).toBe('John Doe');
  });

  it('preserves null values', () => {
    expect(trimAndTitleCase(null)).toBeNull();
  });

  it('preserves undefined values', () => {
    expect(trimAndTitleCase(undefined)).toBeUndefined();
  });

  it('handles empty string after trimming', () => {
    expect(trimAndTitleCase('   ')).toBe('');
  });

  it('handles single word', () => {
    expect(trimAndTitleCase('  HELLO  ')).toBe('Hello');
  });
});
