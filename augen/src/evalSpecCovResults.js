import { publicSpecsDir, gitProjectRoot } from './closestSpec.js'
import path from 'path'
import fs from 'fs'
import { execSync } from 'child_process'

const publicCovDir = path.dirname(publicSpecsDir)

if (process.argv[2] && fs.existsSync(path.join(publicSpecsDir, `${process.argv[2]}-relevant.json`))) {
	evalSpecCovResults({ workspace: process.argv[2] })
}

export async function evalSpecCovResults({ workspace, jsonExtract }) {
	let relevantCoverage
	if (jsonExtract) relevantCoverage = jsonExtract
	else {
		const jsonFile = path.join(publicSpecsDir, `${workspace}-relevant.json`)
		if (!fs.existsSync(jsonFile)) return { ok: true }
		// not using await import(jsonFile) since it triggers server restart when the json file is regenerated
		const json = fs.readFileSync(jsonFile, { encoding: 'utf8' })
		relevantCoverage = JSON.parse(json)
	}

	const coveredFilenames = Object.keys(relevantCoverage)
	if (!coveredFilenames.length) return { ok: true }
	const covFile = path.join(publicCovDir, `${workspace}-coverage.json`)

	let previousCoverage
	try {
		if (!fs.existsSync(covFile)) previousCoverage = {}
		else {
			// not using await import(jsonFile) since it triggers server restart when the json file is regenerated
			const json = fs.readFileSync(covFile, { encoding: 'utf8' })
			previousCoverage = JSON.parse(json)
			if (!previousCoverage) throw `unable to read spec coverage file='${covFile}'`
		}
	} catch (e) {
		console.log(e)
		previousCoverage = {}
	}

	// console.log(40, previousCoverage)
	const failedCoverage = new Map()
	const getPct = v => (Object.hasOwn(v, 'pct') ? v.pct : 0)
	for (const f of coveredFilenames) {
		if (!Object.hasOwn(previousCoverage, f)) continue
		{
			const prev = getLowestPct(previousCoverage[f])
			const curr = getLowestPct(relevantCoverage[f])
			const diff = curr - prev
			relevantCoverage[f].lowestPct = { curr, prev, diff }
			if (diff < 0) failedCoverage.set(f, relevantCoverage[f])
		}
		{
			const prev = getAveragePct(previousCoverage[f])
			const curr = getAveragePct(relevantCoverage[f])
			const diff = curr - prev
			relevantCoverage[f].averagePct = { curr, prev, diff }
			if (diff < 0) failedCoverage.set(f, relevantCoverage[f])
		}
		// TODO: require other, stricter criteria later
	}

	// if there is a jsonExtract in the argument, it is only a partial extract
	// as supplied by emitRelevantSpecCovDetails(), which use the results from
	// here to update the html extract, and this partial content should not overwrite
	// the fuller covFile content, which should be done only in master
	//
	// NOTE: running `npm run spec:coverage` from the pp dir should trigger tracking of coverage report changes
	//
	if (!jsonExtract) {
		if (!failedCoverage.size) {
			console.log(`\n👏 ${workspace} branch coverage test PASSED! 🎉`)
			console.log('--- Percent coverage was maintained or improved across relevant files! ---\n')
			// only commit updated coverage json when running in github CI as indicated by repeated 'proteinpaint' path,
			// or add TRACK_SPEC_COVERAGE=1 when running a script that calls this function
			if (gitProjectRoot.endsWith('proteinpaint/proteinpaint') || process.env.TRACK_SPEC_COVERAGE) {
				try {
					fs.writeFileSync(covFile, JSON.stringify(relevantCoverage, null, '  '))
					const out = execSync(`cd ${gitProjectRoot} && git add ${covFile}`, { encoding: 'utf8' })
					console.log(out)
				} catch (e) {
					console.log(`error updating '${covFile}'`, e)
				}
			}
		} else {
			console.log(
				`\n!!! Failed ${workspace} coverage: average and/or lowest percent coverage decreased for ${failedCoverage.size} relevant files !!!`
			)
			console.log(Object.fromEntries(failedCoverage.entries()))
			console.log(`\n`)
			//process.exit(1)
		}
	}

	return {
		ok: !failedCoverage.size,
		failedCoverage: Object.fromEntries(failedCoverage.entries()),
		workspace,
		relevantCoverage
	}
}

const relevantKeys = new Set(['lines', 'functions', 'statements', 'branches'])

function getLowestPct(result) {
	if (Object.hasOwn(result, 'lowestPct')) return result.lowestPct.curr
	const entries = Object.entries(result).filter(kv => relevantKeys.has(kv[0]))
	if (!entries.length) return 0
	let min
	for (const [k, v] of entries) {
		if (!Object.hasOwn(v, 'pct')) continue
		if (min === undefined || min > v.pct) min = v.pct
	}
	return min
}

function getAveragePct(result) {
	if (Object.hasOwn(result, 'averagePct')) return result.averagePct.curr
	const entries = Object.entries(result).filter(kv => relevantKeys.has(kv[0]))
	if (!entries.length) return 0
	let total = 0
	for (const [k, v] of entries) {
		total += Object.hasOwn(v, 'pct') ? v.pct : 0
	}
	return total / entries.length
}
