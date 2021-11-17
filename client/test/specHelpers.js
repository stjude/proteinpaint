const glob = require('glob')
const fs = require('fs')
const path = require('path')
const bundleFile = path.join(__dirname, '../../public/bin/proteinpaint.js')

/*
	Creates a target file to import matching test spec files.
	Whenever that target file is updated, it will 
	trigger a rebundling of the app in development mode

	opts{}
	.name 
		- a glob string to match against spec filenames under client/src
		- defaults to '*'
		- name=? (question mark) will create a target file if missing,
			but will not overwrite if it exists
	
	.dir 
		- a glob string to match against spec dir names under client/src
		- defaults to '**'
*/
exports.writeImportCode = async function writeImportCode(opts, targetFile) {
	// detect if the targetFile is missing and create as needed
	if (!fs.existsSync(targetFile)) {
		console.log(`Creating '${targetFile}'.`)
		fs.writeFileSync(targetFile, '', { encoding: 'utf8' })
	}
	// target file should exist at this point,
	// may exit now if this function is meant to just
	// create a missing target file and not overwrite
	if (opts.name == '?') return

	const specs = findMatchingSpecs(opts)
	// the import code to write to the target file
	const importCode = specs.map(file => `import '${file}'`).join('\n')
	// the current import code as found in the target file
	const currImportCode = getImportedSpecs(targetFile)
	if (currImportCode != importCode) {
		console.log(`Writing ${specs.length} import(s) of test specs to '${targetFile}'.`)
		// remember the bundle's modified time before editing the target file
		const mtime = await getModTime(bundleFile)
		// editing the targetFile would trigger rebundling by webpack
		fs.writeFileSync(targetFile, importCode, { encoding: 'utf8' })
		// detect when the rebundling is completed, by comparing its modified time
		for (let i = 0; i < 60; i++) {
			const time = await getModTime(bundleFile)
			if (time > mtime) break
			await sleep(400)
		}
	}
	return specs.length
}

function findMatchingSpecs(opts) {
	// may assign default patterns
	const SPECDIR = opts.dir || '**'
	const SPECNAME = opts.name || '*'
	const pattern = path.join(__dirname, `../src/${SPECDIR}/test/${SPECNAME}.spec.js`)

	// hardcoded list of excluded specs, unless specified using SPECNAME
	const exclude = ['examples']
	const specs = glob.sync(pattern).filter(f => f === SPECNAME || !exclude.includes(f))

	const srcDir = __dirname.replace('client/test', 'client/src')
	// sorting preference for running the tests
	const specOrder = [`${srcDir}/common/test/rx.core.spec.js`]
	specs.sort((a, b) => {
		const i = specOrder.indexOf(a)
		const j = specOrder.indexOf(b)
		if (i == -1 && j == -1) return 0
		if (i == -1) return 1
		if (j == -1) return -1
		return i - j
	})

	return specs.map(file => file.replace(srcDir, '../src'))
}
exports.findMatchingSpecs = findMatchingSpecs

function getImportedSpecs(targetFile, format = '') {
	if (!fs.existsSync(targetFile)) throw `missing '${targetFile}' in getImportedSpecs()`
	const importedSpecs = fs.readFileSync(targetFile, { encoding: 'utf8' })
	// return the string
	if (!format) return importedSpecs
	else if (format == 'array') {
		if (!importedSpecs) return []
		const specs = importedSpecs.split('\n').map(line => line.split(' ')[1].slice(1, -1))
		return specs
	} else {
		throw `unsupported format='${format}'`
	}
}
exports.getImportedSpecs = getImportedSpecs

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

async function getModTime(file) {
	const mtime = (await fs.promises.stat(file)).mtime
	return +new Date(mtime)
}
