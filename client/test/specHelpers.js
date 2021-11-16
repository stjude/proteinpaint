const glob = require('glob')
const fs = require('fs')
const path = require('path')

exports.writeImportCode = function writeImportCode(opts, targetFile) {
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

	// the import code to write to the target file
	const importCode = specs.map(file => `import '${file.replace(srcDir, '../src')}'`).join('\n')
	const currImportCode = getImportedSpecs(targetFile)
	if (currImportCode != importCode) {
		console.log(`Writing ${specs.length} import(s) of test specs to '${targetFile}'.`)
		// editing the targetFile would trigger rebundling by webpack
		fs.writeFileSync(targetFile, importCode, { encoding: 'utf8' })
	}
}

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
