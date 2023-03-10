#!/usr/bin/env node

// create minimal package.json to help with Dockerfile build caching
const path = require('path')
const pkgfile = path.join(process.cwd(), process.argv[2])
const pkg = require(pkgfile)
const min = {}
if (pkg.dependencies) min.dependencies = pkg.dependencies
if (pkg.devDependencies) min.devDependencies = pkg.devDependencies
if (pkg.workspaces) min.workspaces = pkg.workspaces
console.log(min)
