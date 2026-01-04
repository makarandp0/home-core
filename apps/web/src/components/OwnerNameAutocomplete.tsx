// Copyright (c) 2025 Makarand Patwardhan
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import {
  SuggestedOwnerNamesResponseSchema,
  OwnerAliasListResponseSchema,
  type OwnerAlias,
} from '@ohs/types';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface OwnerNameAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  className?: string;
}

interface SuggestionItem {
  name: string;
  isCanonical: boolean;
  documentCount?: number;
}

interface PatternMatch {
  pattern: string;
  canonicalName: string;
}

export function OwnerNameAutocomplete({
  value,
  onChange,
  placeholder = 'e.g., John Smith',
  id,
  className,
}: OwnerNameAutocompleteProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState<SuggestionItem[]>([]);
  const [aliases, setAliases] = React.useState<OwnerAlias[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);

  // Fetch suggestions and aliases
  const fetchData = React.useCallback(async () => {
    setLoading(true);
    const [suggestionsResult, aliasesResult] = await Promise.all([
      api.get('/api/settings/owner-names', SuggestedOwnerNamesResponseSchema),
      api.get('/api/settings/owner-aliases', OwnerAliasListResponseSchema),
    ]);
    if (suggestionsResult.ok) {
      setSuggestions(suggestionsResult.data.names);
    }
    if (aliasesResult.ok) {
      setAliases(aliasesResult.data.aliases);
    }
    setLoading(false);
  }, []);

  // Check if current value matches any pattern
  const patternMatch = React.useMemo((): PatternMatch | null => {
    if (!value.trim() || aliases.length === 0) return null;

    for (const alias of aliases) {
      try {
        const regex = new RegExp(alias.aliasName, 'i');
        if (regex.test(value)) {
          // Don't suggest if already the canonical name
          if (value.toLowerCase() !== alias.canonicalName.toLowerCase()) {
            return { pattern: alias.aliasName, canonicalName: alias.canonicalName };
          }
        }
      } catch {
        // Invalid regex, skip
      }
    }
    return null;
  }, [value, aliases]);

  // Fetch data on mount to detect pattern matches
  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter suggestions based on input
  const filteredSuggestions = React.useMemo(() => {
    if (!value.trim()) return suggestions;
    const lowerValue = value.toLowerCase();
    return suggestions.filter((s) => s.name.toLowerCase().includes(lowerValue));
  }, [suggestions, value]);

  // Handle input focus
  const handleFocus = () => {
    setIsOpen(true);
  };

  // Handle input blur (with delay to allow click on suggestions)
  const handleBlur = () => {
    setTimeout(() => {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }, 150);
  };

  // Handle selecting a suggestion
  const handleSelect = (name: string) => {
    onChange(name);
    setIsOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.blur();
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    // Check if we have any items to navigate (pattern match or suggestions)
    const hasPatternMatch = patternMatch !== null;
    const hasSuggestions = filteredSuggestions.length > 0;
    if (!hasPatternMatch && !hasSuggestions) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((i) => {
          // If at pattern match (-2) or not started (-1), move to first suggestion
          if (i < 0) {
            return hasSuggestions ? 0 : -1;
          }
          // Otherwise move down in suggestions list
          return Math.min(i + 1, filteredSuggestions.length - 1);
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((i) => {
          // If at first suggestion or above, move to pattern match if exists
          if (i <= 0) {
            return hasPatternMatch ? -2 : -1;
          }
          // Otherwise move up in suggestions list
          return i - 1;
        });
        break;
      case 'Enter':
        e.preventDefault();
        // Handle pattern match selection (index -2)
        if (highlightedIndex === -2 && patternMatch) {
          handleSelect(patternMatch.canonicalName);
        } else if (highlightedIndex >= 0 && highlightedIndex < filteredSuggestions.length) {
          handleSelect(filteredSuggestions[highlightedIndex].name);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  // Scroll highlighted item into view
  React.useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightedIndex];
      if (item instanceof HTMLElement) {
        item.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  return (
    <div className="relative">
      {/* Pattern match banner - shown when not editing */}
      {patternMatch && !isOpen && (
        <div className="mb-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm text-amber-800 dark:text-amber-200">
              <span className="font-medium">Matches pattern:</span>{' '}
              <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded text-xs">{patternMatch.pattern}</code>
            </div>
            <button
              type="button"
              onClick={() => onChange(patternMatch.canonicalName)}
              className="px-2 py-1 text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white rounded transition-colors"
            >
              Use "{patternMatch.canonicalName}"
            </button>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        className={cn(
          'w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500',
          className
        )}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-autocomplete="list"
      />

      {isOpen && (
        <ul
          ref={listRef}
          className="absolute z-50 w-full mt-1 max-h-60 overflow-auto rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg"
          role="listbox"
        >
          {/* Pattern match suggestion at top of dropdown */}
          {patternMatch && (
            <li
              onClick={() => handleSelect(patternMatch.canonicalName)}
              onMouseEnter={() => setHighlightedIndex(-2)}
              className={cn(
                'px-3 py-2 cursor-pointer border-b border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20',
                highlightedIndex === -2 && 'ring-2 ring-inset ring-amber-400'
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-amber-800 dark:text-amber-200">
                    {patternMatch.canonicalName}
                  </span>
                  <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
                    (matches pattern)
                  </span>
                </div>
                <span className="px-1.5 py-0.5 text-xs bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 rounded">
                  suggested
                </span>
              </div>
            </li>
          )}

          {loading ? (
            <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
              Loading suggestions...
            </li>
          ) : filteredSuggestions.length === 0 ? (
            !patternMatch ? (
              <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                {value.trim() ? 'No matches found. Press Enter to use custom name.' : 'No suggestions available'}
              </li>
            ) : null // Pattern match shown above, no need for additional message
          ) : (
            filteredSuggestions.map((suggestion, index) => (
              <li
                key={suggestion.name}
                onClick={() => handleSelect(suggestion.name)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={cn(
                  'px-3 py-2 cursor-pointer',
                  highlightedIndex === index
                    ? 'bg-blue-100 dark:bg-blue-900/50'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                )}
                role="option"
                aria-selected={highlightedIndex === index}
              >
                <span className="text-gray-900 dark:text-gray-100">{suggestion.name}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
