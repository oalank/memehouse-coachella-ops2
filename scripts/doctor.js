#!/usr/bin/env node
/**
 * doctor — Run from repo root. Prints cwd and whether required files exist.
 */
const fs = require('fs');
const path = require('path');

const cwd = process.cwd();
const rootPkg = path.join(cwd, 'package.json');
const clientPkg = path.join(cwd, 'client', 'package.json');
const serverPkg = path.join(cwd, 'server', 'package.json');

const hasRoot = fs.existsSync(rootPkg);
const hasClient = fs.existsSync(clientPkg);
const hasServer = fs.existsSync(serverPkg);

console.log('');
console.log('  doctor');
console.log('  ──────');
console.log('  process.cwd():     ', cwd);
console.log('  package.json:      ', hasRoot ? 'yes' : 'NO');
console.log('  client/package.json:', hasClient ? 'yes' : 'NO');
console.log('  server/package.json:', hasServer ? 'yes' : 'NO');
console.log('');

if (!hasRoot || !hasClient || !hasServer) {
  process.exit(1);
}
