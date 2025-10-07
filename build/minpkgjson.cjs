#!/usr/bin/env node

// create minimal package.json to help with Dockerfile build caching
const path = require('path')
const pkgfile = path.join(process.cwd(), process.argv[2])
const pkg = require(pkgfile)
const min = {}
for (const propName of ['dependencies', 'devDependencies', 'workspaces', 'imports']) {
	if (pkg[propName]) min[propName] = pkg[propName]
}
console.log(JSON.stringify(min, null, '    '))
