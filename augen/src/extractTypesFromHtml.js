#!/usr/bin/env node
import fs from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const docsdir = process.argv[2]
const extracts = {}
for (const t of ['types', 'interfaces']) {
	const dir = join(docsdir, t)
	if (!fs.existsSync(dir)) continue
	const files = fs.readdirSync(dir)
	for (const fname of files) {
		if (fname.startsWith('.')) continue
		const htmlFilePath = join(dir, fname)
		const text = fs.readFileSync(htmlFilePath)?.toString('utf-8').trim()
		const name = fname.split('.').slice(-2, -1)
		extracts[name] = {
			comment: extractComment(text),
			signature: extractSignature(text)
		}
		if (fname.startsWith('_internal_.')) {
			const linkName = join(dir, `${name}.html`)
			if (!fs.existsSync(linkName)) {
				fs.symlink(join('.', fname), linkName, err => {
					if (err) throw err
				})
			}
		}
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
