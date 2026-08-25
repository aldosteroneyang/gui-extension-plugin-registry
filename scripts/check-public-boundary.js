#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const EXCLUDED_DIRECTORIES = new Set(['.git', 'node_modules']);
const TEXT_FILE_PATTERN = /\.(?:c?js|json|md|ya?ml|txt)$/i;
const RULES = [
  {
    name: 'private IPv4 address',
    pattern: /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})\b/
  },
  {
    name: 'loopback host',
    pattern: new RegExp(`\\b(?:${['local', 'host'].join('')}|127\\.0\\.0\\.1)\\b`, 'i')
  },
  {
    name: 'internal hospital-style hostname',
    pattern: /\b[a-z0-9.-]+\.hosp\.[a-z0-9.-]+\b/i
  },
  {
    name: 'private key material',
    pattern: new RegExp(['BEGIN', 'PRIVATE', 'KEY'].join(' '))
  },
  {
    name: 'GitHub token',
    pattern: /\b(?:ghp_|github_pat_)[A-Za-z0-9_]+/
  },
  {
    name: 'provider credential',
    pattern: /\bsk-[A-Za-z0-9_-]{20,}/
  },
  {
    name: 'clinical identifier field',
    pattern: new RegExp(
      `\\b(?:${['patient', '[_-]?', 'id'].join('')}|${['pat', 'no'].join('')}|${['refer', 'no'].join('')})\\b`,
      'i'
    )
  }
];

function listTextFiles(directory = ROOT) {
  const results = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (EXCLUDED_DIRECTORIES.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) results.push(...listTextFiles(fullPath));
    else if (TEXT_FILE_PATTERN.test(entry.name)) results.push(fullPath);
  }
  return results;
}

function scanPublicBoundary(files = listTextFiles()) {
  const violations = [];
  for (const file of files) {
    const contents = fs.readFileSync(file, 'utf8');
    for (const rule of RULES) {
      if (rule.pattern.test(contents)) {
        violations.push({ file: path.relative(ROOT, file), rule: rule.name });
      }
    }
  }
  return violations;
}

function main() {
  const violations = scanPublicBoundary();
  if (violations.length > 0) {
    for (const violation of violations) {
      console.error(`Public boundary failed: ${violation.file}: ${violation.rule}`);
    }
    process.exitCode = 1;
    return;
  }
  console.log(`Public boundary OK: files=${listTextFiles().length}`);
}

if (require.main === module) main();

module.exports = { listTextFiles, scanPublicBoundary };
