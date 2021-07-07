#!/usr/bin/env node

const pkg = require('./package.json')
const serverpkg = require('../../server/package.json')
const clientpkg = require('../../client/package.json')

pkg.dependencies = serverpkg.dependencies
for (const name in clientpkg.dependencies) {
	if (!(name in pkg.dependencies)) {
		pkg.dependencies[name] = clientpkg.dependencies[name]
	}
}

pkg.version = serverpkg.version

console.log(JSON.stringify(pkg, null, '    '))
