const glob = require('glob')
const fs = require('fs')
const path = require('path')

const opts = process.argv
	.filter(v => v.includes('='))
	.reduce((obj, opt) => {
		const [key, val] = opt.split('=')
		obj[key] = val
		return obj
	}, {})

const SPECDIR = opts.dir || '**'
const SPECNAME = opts.name || '*'
const srcDir = __dirname.replace('client/test', 'client/src')
const pattern = path.join(__dirname, `../src/${SPECDIR}/test/${SPECNAME}.spec.js`)

// hardcoded list of excluded specs, unless specified using SPECNAME
const exclude = ['examples']
const specs = glob.sync(pattern).filter(f => f === SPECNAME || !exclude.includes(f))

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

const code = specs.map(file => `import '${file.replace(srcDir, '../src')}'`).join('\n')
const targetFile = path.join(__dirname, './internals.js')
fs.writeFileSync(targetFile, code, { encoding: 'utf8' })
