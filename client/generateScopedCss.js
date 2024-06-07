const usage = `
	usage from the client dir: 
	
	node ./generateScopedCss.js cssFile [ > outputFile]

	- cssFile is assumed to be well-formatted, with new line after each selector and curly bracket blocks
	- if no outputFile, the output will be logged
	- with outputFile argument, outputFile-unscoped.css and outputFile-scoped.css will be generated

	example:
	node generateScopedCss.js ../../node_modules/normalize.css/normalize.css src/style-normalize
`
const cssFile = process.argv[2]
if (!cssFile) throw usage

const fs = require('fs')
if (!fs.existsSync(cssFile)) throw `not found, file='${cssFile}'`

const cssStr = fs.readFileSync(cssFile).toString('utf-8').trim()
const lines = cssStr.split('\n')
const unscopedRules = []
const scopedRules = []
const sjCls = ['.sja_root_holder', '.sja_menu_div', '.sja_pane']

let currTag,
	unclosed = false,
	currRulesArr = unscopedRules // assumed html, body are declared first in css
for (const line of lines) {
	const l = line.trim()
	if (!l) {
		currRulesArr.push(line)
	} else if (l.includes('}')) {
		currRulesArr.push(line)
		// assume body is the last declared scoped rule
		// this will allow subsequent comments to be on top of the applicable scoped rule
		if (currTag == 'body') currRulesArr = scopedRules
		unclosed = false
	} else if (line.includes('{') || line.endsWith(',')) {
		unclosed = true
		currTag = l.split(' ')[0]
		currRulesArr = currTag == 'html' || currTag == 'body' ? unscopedRules : scopedRules
		if (currRulesArr == unscopedRules) currRulesArr.push(line)
		else {
			const selector = line.replace('{', '').replace(',', '').trim()
			currRulesArr.push(sjCls.map(cls => `${cls} ${selector}`).join(', ') + (line.includes('{') ? ' {' : ''))
		}
	} else if (!currTag || currTag == 'html' || currTag == 'body') {
		currRulesArr.push(line)
	} else if (unclosed) {
		currRulesArr.push(line)
	} else {
		currRulesArr = scopedRules
		currRulesArr.push(line)
	}
}

const outputFile = process.argv[3]
if (!outputFile) {
	console.log(unscopedRules.join('\n'))
	console.log(scopedRules.join('\n'))
} else {
	fs.writeFileSync(`${outputFile}-unscoped.css`, unscopedRules.join('\n'), { encoding: 'utf8' })
	fs.writeFileSync(`${outputFile}-scoped.css`, scopedRules.join('\n'), { encoding: 'utf8' })
}
