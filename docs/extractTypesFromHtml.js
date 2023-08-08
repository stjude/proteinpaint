#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const extracts = {}
for (const t of ['types', 'interfaces']) {
	const dir = path.join(__dirname, `../public/docs/server/${t}`)
	if (!fs.existsSync(dir)) continue
	const files = fs.readdirSync(dir)
	for (const fname of files) {
		if (fname.startsWith('.')) continue
		const htmlFilePath = path.join(dir, fname)
		const text = fs.readFileSync(htmlFilePath)?.toString('utf-8').trim()
		const name = fname.split('.').slice(-2, -1)
		extracts[name] = {
			comment: extractComment(text),
			signature: extractSignature(text)
		}
		if (fname.startsWith('_internal_.')) fs.renameSync(htmlFilePath, path.join(dir, `${name}.html`))
	}
}

console.log(JSON.stringify(extracts)) //, null, '  '))

function extractComment(text) {
	const i = text.indexOf(`<div class="tsd-comment tsd-typography">`)
	const j = text.indexOf('</div>', i)
	return text
		.slice(i, j + 6)
		.replaceAll(';', '')
		.replaceAll('<wbr/>', '')
		.replaceAll(`<span>    </span>`, `<span> </span>`)
}

function extractSignature(text) {
	const i = text.indexOf(`<div class="tsd-signature">`)
	const j = text.indexOf('</div>', i)
	// TODO:
	return text
		.slice(i, j + 6)
		.replaceAll(';', '')
		.replaceAll('<wbr/>', '')
		.replaceAll('_internal_.', '')
		.replaceAll(`<span>    </span>`, `<span> </span>`)
}
