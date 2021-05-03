#!/usr/bin/env node

// called from the project root folder or proteinpaint/tmppack

const pkg = require('./package.json')
const serverpkg = require('../../server/package.json')
const clientpkg = require('../../client/package.json')

pkg.dependencies = serverpkg.dependencies
for (const name in clientpkg.dependencies) {
	if (!(name in pkg.dependencies)) {
		pkg.dependencies[name] = clientpkg.dependencies[name]
	}
}

console.log(JSON.stringify(pkg, null, '    '))
