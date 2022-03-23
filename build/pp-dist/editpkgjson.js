#!/usr/bin/env node

const pkg = require('./package.json')
const serverpkg = require('../../server/package.json')
const clientpkg = require('../../client/package.json')

pkg.version = serverpkg.version

pkg.dependencies = serverpkg.dependencies
for (const name in clientpkg.dependencies) {
	if (!(name in pkg.dependencies)) {
		pkg.dependencies[name] = clientpkg.dependencies[name]
	}
}

console.log(JSON.stringify(pkg, null, '    '))

// for testing only, to detect potential newly added packaged server or client file
// that may also be needed for the pp-dist package
if (0) {
	const missingFiles = []
	for (const f of clientpkg.files) {
		if (!pkg.files.includes(`client/${f}`)) missingFiles.push(`client/${f}`)
	}
	for (const f of serverpkg.files) {
		if (!pkg.files.includes(`server/${f}`)) missingFiles.push(`server/${f}`)
	}
	if (missingFiles.length) console.warn(`pp-dist files may be missing: ${JSON.stringify(missingFiles)}`)
}
