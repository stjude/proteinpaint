const glob = require('glob')
const fs = require('fs')
const path = require('path')
const wpCompileTime = path.join(__dirname, '/wpCompileTime')
const minimatch = require('minimatch')

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

const specsCache = {}

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
	// !!! TODO: deprecate this server route !!!
	// With esbuild esm build, all spec files can be bundled quickly for the browser,
	// and the spec pattern matching/filtering can be done easily on the client-side
	// bundled internals.js code. Previously, bundling all the spec files can take a while
	// with webpack, so a server route was triggered to generate only minimal requires()
	// in internals.js
	//
	// the import code to write to the target file
	const importCode = specs.matched.map(file => `import '../${file}'`).join('\n')
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
	const SPECDIR = opts.dir ? `**/${opts.dir}` : '**'
	const SPECNAME = opts.name || '*'
	const exclude = 'exclude' in opts ? opts.exclude : SPECNAME.includes('_x_.') ? '' : '_x_.'
	const pattern = path.join(__dirname, `../${SPECDIR}/test/${SPECNAME}.spec.*s`)
	const specs =
		getFromCache(pattern) ||
		glob.sync(pattern, { cwd: path.join(__dirname, `../**`) }).filter(f => !exclude || !f.includes(exclude))
	specs.sort()
	if (!specsCache[pattern]) specsCache[pattern] = specs
	if (SPECDIR == '**' && SPECNAME == '*') {
		// this is a request for all spec files, can cache the results for
		// all other targeted spec searches, since glob.sync could be slow
		specsCache['*'] = specs
	}

	const clientDir = __dirname.replace('client/test', 'client')
	// sorting preference for running the tests
	const specOrder = [] //; console.log(75, clientDir, specs)
	specs.sort((a, b) => {
		const i = specOrder.indexOf(a)
		const j = specOrder.indexOf(b)
		if (i == -1 && j == -1) return 0
		if (i == -1) return 1
		if (j == -1) return -1
		return i - j
	})

	return {
		matched: specs.map(file => file.replace(clientDir + '/', '')),
		n: specs.length,
		pattern,
		exclude
	}
}
exports.findMatchingSpecs = findMatchingSpecs

function getFromCache(pattern) {
	if (specsCache[pattern]) return specsCache[pattern]
	// prefer minimatch() against in-memory cache, which is much faster than glob.sync() against disk
	return specsCache['*']?.filter(f => minimatch(f, pattern))
}

function getImportedSpecs(targetFile, format = '') {
	if (!fs.existsSync(targetFile)) throw `missing '${targetFile}' in getImportedSpecs()`
	const importedSpecs = fs.readFileSync(targetFile, { encoding: 'utf8' })
	// return the string
	if (!format) return importedSpecs
	else if (format == 'array') {
		if (!importedSpecs) return []
		const specs = importedSpecs
			.split('\n')
			.filter(line => line.includes('import'))
			.map(line => line.split(' ')[1].slice(1, -1))
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
		compiler.hooks.beforeCompile.tapAsync('SpecsHelperPlugin', (compilation, callback) => {
			const internalsFilename = path.join(__dirname, './internals.js')
			const internals = fs.readFileSync(internalsFilename).toString('utf-8').trim()
			const importedFiles = internals
				.split('\n')
				.map(line => line.split(' ')[1]?.slice(1, -1))
				.filter(f => f && true)
			if (importedFiles.length) {
				// remove quotes
				const exists = []
				for (const f of importedFiles) {
					if (f && fs.existsSync(path.join(__dirname, f))) exists.push(f)
				}
				if (exists.length < importedFiles.length) {
					console.log('\n--- adjusting the imported spec files in internals.js ---\n')
					fs.writeFileSync(internalsFilename, exists.map(f => `import '${f}'`).join('\n'))
				}
			}
			callback()
		})
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
