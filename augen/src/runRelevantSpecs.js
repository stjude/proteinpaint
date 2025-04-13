import { gitProjectRoot } from './closestSpec.js'
import { emitRelevantSpecCovDetails } from './emitRelevantSpecCovDetails.js'
import path from 'path'
import fs from 'fs'
import { execSync } from 'child_process'

const publicSpecsDir = path.join(gitProjectRoot, 'public/coverage/specs')

export async function runRelevantSpecs({ workspace, specs, dirname }) {
	const reportDir = path.join(dirname, '/.coverage')
	const publicSpecsWsDir = `${publicSpecsDir}/${workspace}`
	const extractFiles = {
		html: `${publicSpecsDir}/${workspace}-relevant.html`,
		markdown: `${publicSpecsDir}/${workspace}-relevant.md`,
		json: `${publicSpecsDir}/${workspace}-relevant.json`
	}

	if (fs.existsSync(publicSpecsWsDir)) fs.rmSync(publicSpecsWsDir, { force: true, recursive: true })
	if (fs.existsSync(extractFiles.html)) fs.rmSync(extractFiles.html, { force: true, recursive: true })
	if (fs.existsSync(extractFiles.markdown)) fs.rmSync(extractFiles.markdown, { force: true, recursive: true })
	if (fs.existsSync(extractFiles.json)) fs.rmSync(extractFiles.json, { force: true, recursive: true })

	if (!specs.matched.length) {
		if (Object.keys(specs.matchedByFile).length) {
			// TODO: may require a matching spec for all relevant files
			console.log('No matching spec for changed files')
		}
		process.exit(0)
	}

	const c8opts = `--experimental-monocart -r=v8 -r=html -r=json-summary -r=markdown-summary -r=markdown-details -o=./.coverage`

	try {
		const html = []
		const markdowns = []
		const json = {}
		//let title
		for (const spec of specs.matched) {
			fs.rmSync(reportDir, { force: true, recursive: true })
			const testLog = execSync(`npx c8 ${c8opts} tsx ${path.join(dirname, spec)}`, { encoding: 'utf8' })
			console.log(testLog)
			if (fs.existsSync(reportDir)) {
				const extracts = await emitRelevantSpecCovDetails({
					workspace,
					relevantSpecs: specs,
					reportDir,
					testedSpecs: [spec]
				})
				//if (!title) title = extracts.title
				html.push(extracts.html)
				markdowns.push(extracts.markdown)
				for (const [file, result] of Object.entries(extracts.json)) {
					if (Object.hasOwn(json, file)) console.log(51, `non-unique coverage result for ${workspace} file='${file}'`)
					else json[file] = result
				}
			}
		}
		if (html.length) {
			const combinedHtml = html.join('\n')
			fs.writeFileSync(extractFiles.html, combinedHtml, { encoding: 'utf8' })
			const combinedMarkdown = markdowns.join('\n')
			fs.writeFileSync(extractFiles.markdown, combinedMarkdown, { encoding: 'utf8' })
		}
		fs.writeFileSync(extractFiles.json, JSON.stringify(json, null, '  '), { encoding: 'utf8' })
	} catch (e) {
		console.log(`\n!!! ${workspace} runRelevantSpecs() error !!!\n`, e, '\n')
	}
}
