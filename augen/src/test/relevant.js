import { getClosestSpec, emitRelevantSpecCovDetails, gitProjectRoot } from '../closestSpec.js'
import path from 'path'
import tape from 'tape'
import fs from 'fs'
import { execSync } from 'child_process'

const dirname = path.join(import.meta.dirname, '../..')
const relevantSubdirs = ['src']
const opts = {
	// changedFiles: ['tvs.js', 'tvs.categorical.js', 'tvs.numeric.js', 'FilterPrompt.js'].map(f => `client/filter/${f}`),
	// changedFiles: ['handlers/snp.ts'].map(f => `client/termsetting/${f}`)
	ignore: ['src/toyApp']
}

export const reportDir = path.join(import.meta.dirname, '../../.coverage')

const publicSpecsDir = path.join(gitProjectRoot, 'public/coverage/specs')
export const extractFiles = {
	html: `${publicSpecsDir}/augen-relevant.html`,
	markdown: `${publicSpecsDir}/augen-relevant.md`
}

if (process.argv.includes('-p')) runRelevantSpecs()

export function getRelevantAugenSpecs() {
	return getClosestSpec(dirname, relevantSubdirs, opts)
}

async function runRelevantSpecs() {
	const publicSpecsAugenDir = `${publicSpecsDir}/augen`
	if (fs.existsSync(publicSpecsAugenDir)) fs.rmSync(publicSpecsAugenDir, { force: true, recursive: true })

	const specs = getRelevantAugenSpecs()
	if (!specs.matched.length) {
		if (Object.keys(specs.matchedByFile).length) {
			// TODO: may require a matching spec for all relevant files
			console.log('No matching spec for changed files')
		}
		process.exit(0)
	}

	const c8opts = `--all --src=src --experimental-monocart -r=v8 -r=html -r=json -r=markdown-summary -r=markdown-details -o=./.coverage`

	try {
		const html = []
		const markdowns = []
		const promises = []
		let title
		for (const spec of specs.matched) {
			fs.rmSync(reportDir, { force: true, recursive: true })
			const testLog = execSync(`npx c8 ${c8opts} tsx ${path.join(dirname, spec)}`, { encoding: 'utf8' })
			console.log(testLog)
			if (fs.existsSync(reportDir)) {
				const extracts = emitRelevantSpecCovDetails({
					workspace: 'augen',
					relevantSpecs: specs,
					reportDir,
					testedSpecs: [spec]
				})
				if (!title) title = extracts.title
				html.push(extracts.html)
				markdowns.push(extracts.markdown)
			}
		}
		await Promise.all(promises)
		if (html.length) {
			const combinedHtml = `<h3>${title}</h3>\n` + html.join('\n')
			fs.writeFileSync(extractFiles.html, combinedHtml, { encoding: 'utf8' })
			const combinedMarkdown = markdowns.join('\n')
			fs.writeFileSync(extractFiles.markdown, combinedMarkdown, { encoding: 'utf8' })
		}
	} catch (e) {
		console.log(`\n!!! augen runRelevantSpecs() error !!!\n`, e, '\n')
		//test.fail(`Error running relevant augen specs`)
		//test.end()
	}
}
