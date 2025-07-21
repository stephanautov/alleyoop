#!/usr/bin/env node
// scripts/check-client-directives.mjs
// Simple gate that fails CI if a component appears to need
// the "use client" directive but doesn't declare it.

import { promises as fs } from 'node:fs';
import fg from 'fast-glob';

// Hooks or browser APIs that imply the file must run in the browser
const HOOKS = [
    'useState',
    'useEffect',
    'useReducer',
    'useLayoutEffect',
    'useRef',
];
const PATTERN = new RegExp(`\\b(${HOOKS.join('|')})\\b|\\bwindow\\b|\\bdocument\\b`);

// Locate every .tsx file under src (skip tests)
const files = await fg(['src/**/*.tsx'], {
    ignore: ['**/*.test.*', '**/node_modules/**'],
});

const offenders = [];
for (const file of files) {
    const src = await fs.readFile(file, 'utf8');
    const trimmed = src.trimStart();
    const hasBrowserCode = PATTERN.test(src);
    const hasDirective = /^['"]use client['"];?/.test(trimmed);
    if (hasBrowserCode && !hasDirective) {
        offenders.push(file);
    }
}

if (offenders.length) {
    console.error('🚨  Possibly-client components missing "use client" directive:');
    offenders.forEach((f) => console.error('  •', f));
    process.exit(1);
} 