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
	const covFile = path.join(publicCovDir, `${workspace.replaceAll('/', '-')}-coverage.json`)

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
		// TODO: coveredFilenames is Object.keys(relevantCoverage), not sure why this
		// was being detected as undefined sometimes and giving an error?
		// maybe the filename was being truncated as object key???
		if (!relevantCoverage[f]) continue
		const hasPrev = Object.hasOwn(previousCoverage, f) && previousCoverage[f] !== undefined
		{
			const prev = hasPrev ? getLowestPct(previousCoverage[f], 'target') : 0
			const curr = getLowestPct(relevantCoverage[f])
			const diff = curr - prev
			relevantCoverage[f].lowestPct = { curr, prev, diff }
			if (diff < 0) failedCoverage.set(f, relevantCoverage[f])
		}
		{
			const prev = hasPrev ? getAveragePct(previousCoverage[f], 'target') : 0
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
		} else {
			console.log(
				`\n!!! Failed ${workspace} coverage: average and/or lowest percent coverage decreased for ${failedCoverage.size} relevant files !!!`
			)
			console.log(Object.fromEntries(failedCoverage.entries()))
			console.log(`\n`)
			//process.exit(1)
		}

		// NOTE: should save updated workspace coverage json even if failed, since the lowestPct.prev and/or
		// averagePct.prev will be used if higher than current corresponding value in subsequent evaluations;
		// not committing the latest results will cause the commitRef to fall behind and give inaccurate
		// relevant and changed files lists.
		//
		// only commit updated coverage json when running in github CI as indicated by repeated 'proteinpaint' path,
		// or add TRACK_SPEC_COVERAGE=1 when running a script that calls this function
		if (gitProjectRoot.endsWith('proteinpaint/proteinpaint') || process.env.TRACK_SPEC_COVERAGE) {
			try {
				const updatedCov = Object.assign({}, previousCoverage, relevantCoverage)
				fs.writeFileSync(covFile, JSON.stringify(updatedCov, null, '  '))
				const out = execSync(`cd ${gitProjectRoot} && git add ${covFile}`, { encoding: 'utf8' })
				console.log(out)
			} catch (e) {
				console.log(`error updating '${covFile}'`, e)
			}
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

function getLowestPct(result, useCase = '') {
	if (Object.hasOwn(result, 'lowestPct'))
		return useCase != 'target' ? result.lowestPct.curr : Math.max(result.lowestPct.curr, result.lowestPct.prev)
	const entries = Object.entries(result).filter(kv => relevantKeys.has(kv[0]))
	if (!entries.length) return 0
	let min
	for (const [k, v] of entries) {
		if (!Object.hasOwn(v, 'pct')) continue
		if (min === undefined || min > v.pct) min = v.pct
	}
	return min
}

function getAveragePct(result, useCase = '') {
	if (Object.hasOwn(result, 'averagePct'))
		return useCase != 'target' ? result.averagePct.curr : Math.max(result.averagePct.curr, result.averagePct.prev)
	const entries = Object.entries(result).filter(kv => relevantKeys.has(kv[0]))
	if (!entries.length) return 0
	let total = 0
	for (const [k, v] of entries) {
		total += Object.hasOwn(v, 'pct') ? v.pct : 0
	}
	return total / entries.length
}
