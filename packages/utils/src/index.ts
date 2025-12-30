// Copyright (c) 2025 Makarand Patwardhan
// SPDX-License-Identifier: AGPL-3.0-only

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function makAssert(condition: unknown, message?: string): asserts condition {
  if (!condition) {
    const msg = message ?? 'Assertion failed';
    console.log(msg);
    throw new Error(msg);
  }
}
