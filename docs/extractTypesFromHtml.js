#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const files = fs.readdirSync(path.join(__dirname, '../public/docs/server/types'))
const extracts = {}

for (const fname of files) {
	if (fname.startsWith('.')) continue
	const htmlFilePath = path.join(__dirname, `../public/docs/server/types/${fname}`)
	const text = fs.readFileSync(htmlFilePath)?.toString('utf-8').trim()
	extracts[fname.split('.').slice(0, -1)] = extractSection(text)
}

console.log(JSON.stringify(extracts)) //, null, '  '))

function extractSection(text) {
	const i = text.indexOf(`<div class="tsd-signature">`)
	const j = text.indexOf('</div>', i)
	// TODO:
	return text
		.slice(i, j + 6)
		.replaceAll(';', '')
		.replaceAll('<wbr/>', '')
		.replaceAll(`<span>    </span>`, `<span> </span>`)
}
