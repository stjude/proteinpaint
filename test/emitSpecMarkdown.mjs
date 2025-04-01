import fs from 'fs'
import path from 'path'
import { publicSpecsDir } from '@sjcrh/augen'
// import { getRelevantServerSpecs, extractFiles as serverExtractFiles } from '../server/test/relevant.js'

const workspaces = ['server', 'client', 'augen']

let hasDisplayedMarkdown = false

for (const ws of workspaces) {
	const markdownExtract = `${publicSpecsDir}/${ws}-relevant.md`
	if (fs.existsSync(markdownExtract)) {
		const markdown = fs.readFileSync(markdownExtract, { encoding: 'utf8' })
		console.log(`## ${ws}`)
		console.log(markdown, '\n')
		hasDisplayedMarkdown = true
	}
}

if (!hasDisplayedMarkdown) console.log(`\nThere were no detected relevant specs to run.\n`)
