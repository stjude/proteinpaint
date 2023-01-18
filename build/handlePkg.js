#!/usr/bin/env node
'use strict'

// this is a helper script to filter and reformat a package.json
//console.log(process.argv)
const pkg = JSON.parse(process.argv[2])

// filter to only this project's workspace dependencies
for (const ws in pkg) {
	for (const depType of ['dependencies', 'devDependencies']) {
		if (!pkg[ws][depType]) continue
		for (const name in pkg[ws][depType]) {
			if (!name.startsWith('@stjude')) delete pkg[ws][depType][name]
		}
		if (!Object.keys(pkg[ws][depType]).length) delete pkg[ws][depType]
	}
}

if (process.argv[3]) {
	const patch = JSON.parse(process.argv[3])
	const value = patch.pop()
	const key = patch.pop()
	let obj = pkg
	for (const k of patch) {
		obj = obj[k]
	}
	obj[key] = value
}

console.log(JSON.stringify(pkg, null, '    '))
