const glob = require('glob')
const fs = require('fs')
const path = require('path')
const wpCompileTime = path.join(__dirname, '/wpCompileTime')

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

	.exclude
		- a substring for excluding any glob-matched files 
		- defaults to '_x_.': by convention spec
			files that are prefixed by this string require
			external test data that is not tracked by git.
			The default exclusion is meant to support continuous
			integration use case where all artifacts and tests must 
			be built from tracked source code.
	.
*/

if (!fs.existsSync(wpCompileTime)) {
	fs.writeFileSync(wpCompileTime, '', { encoding: 'utf8' })
}

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
	const importCode = specs.matched.map(file => `import '${file}'`).join('\n')
	// the current import code as found in the target file
	const currImportCode = getImportedSpecs(targetFile)
	if (currImportCode != importCode || !currImportCode.includes(importCode)) {
		const prevModTime = await getModTime(wpCompileTime)
		console.log(`Writing ${specs.n} import(s) of test specs to '${targetFile}'.`)
		// editing the targetFile would trigger rebundling by webpack
		fs.writeFileSync(targetFile, importCode, { encoding: 'utf8' })
		await monitorBundling(prevModTime)
	}
	return specs
}

function findMatchingSpecs(opts) {
	// may assign default patterns
	const SPECDIR = opts.dir || '**'
	const SPECNAME = opts.name || '*'
	const exclude = 'exclude' in opts ? opts.exclude : SPECNAME.includes('_x_.') ? '' : '_x_.'
	const pattern = path.join(__dirname, `../src/${SPECDIR}/test/${SPECNAME}.spec.js`)
	const specs = glob
		.sync(pattern, { cwd: path.join(__dirname, `../src`) })
		.filter(f => !exclude || !f.includes(exclude))

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

	return {
		matched: specs.map(file => file.replace(srcDir, '../src')),
		n: specs.length,
		pattern,
		exclude
	}
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

async function getModTime(file) {
	const mtime = (await fs.promises.stat(file)).mtime
	return +new Date(mtime)
}

class WpPlugin {
	apply(compiler) {
		compiler.hooks.afterEmit.tapAsync('SpecsHelperPlugin', (compilation, callback) => {
			touchFile(wpCompileTime)
			callback()
		})
	}
}

exports.SpecHelpersWpPlugin = WpPlugin

function touchFile(filename) {
	const time = new Date()
	fs.utimesSync(filename, time, time)
}

async function monitorBundling(prevModTime) {
	//const startTime = currModTime
	// a rebundling has been triggered, monitor when it ends
	for (let i = 0; i < 50; i++) {
		await sleep(400)
		currModTime = await getModTime(wpCompileTime)
		if (currModTime > prevModTime) return
	}
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}
