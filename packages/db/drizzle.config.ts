// Copyright (c) 2025 Makarand Patwardhan
// SPDX-License-Identifier: AGPL-3.0-only

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  out: './src/schema',
  schema: './src/schema/*.ts',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  introspect: {
    casing: 'camel',
  },
});
