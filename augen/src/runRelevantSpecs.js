import { gitProjectRoot, emitRelevantSpecCovDetails } from './closestSpec.js'
import path from 'path'
import fs from 'fs'
import { execSync } from 'child_process'

const publicSpecsDir = path.join(gitProjectRoot, 'public/coverage/specs')

export async function runRelevantSpecs({ workspace, specs, dirname }) {
	const reportDir = path.join(dirname, '/.coverage')
	const publicSpecsWsDir = `${publicSpecsDir}/${workspace}`
	const extractFiles = {
		html: `${publicSpecsDir}/${workspace}-relevant.html`,
		markdown: `${publicSpecsDir}/${workspace}-relevant.md`
	}

	if (fs.existsSync(publicSpecsWsDir)) fs.rmSync(publicSpecsWsDir, { force: true, recursive: true })

	if (!specs.matched.length) {
		if (Object.keys(specs.matchedByFile).length) {
			// TODO: may require a matching spec for all relevant files
			console.log('No matching spec for changed files')
		}
		process.exit(0)
	}

	const c8opts = `--all --experimental-monocart -r=v8 -r=html -r=json -r=markdown-summary -r=markdown-details -o=./.coverage`

	try {
		const html = []
		const markdowns = []
		//let title
		for (const spec of specs.matched) {
			fs.rmSync(reportDir, { force: true, recursive: true })
			const testLog = execSync(`npx c8 ${c8opts} tsx ${path.join(dirname, spec)}`, { encoding: 'utf8' })
			console.log(testLog)
			if (fs.existsSync(reportDir)) {
				const extracts = emitRelevantSpecCovDetails({
					workspace,
					relevantSpecs: specs,
					reportDir,
					testedSpecs: [spec]
				})
				//if (!title) title = extracts.title
				html.push(extracts.html)
				markdowns.push(extracts.markdown)
			}
		}
		if (html.length) {
			const combinedHtml = html.join('\n')
			fs.writeFileSync(extractFiles.html, combinedHtml, { encoding: 'utf8' })
			const combinedMarkdown = markdowns.join('\n')
			fs.writeFileSync(extractFiles.markdown, combinedMarkdown, { encoding: 'utf8' })
		}
	} catch (e) {
		console.log(`\n!!! ${workspace} runRelevantSpecs() error !!!\n`, e, '\n')
	}
}
