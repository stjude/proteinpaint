import { publicSpecsDir } from './closestSpec.js'
import path from 'path'
import fs from 'fs'

const publicCovDir = path.dirname(publicSpecsDir)

const relevantCoverage = {
	'filter/tvs.js': {
		lines: {
			total: 106,
			covered: 96,
			skipped: 0,
			pct: 90.56
		},
		functions: {
			total: 29,
			covered: 26,
			skipped: 0,
			pct: 89.65
		},
		statements: {
			total: 118,
			covered: 102,
			skipped: 0,
			pct: 86.44
		},
		branches: {
			total: 78,
			covered: 55,
			skipped: 0,
			pct: 60.51
		}
	}
}

evalSpecCovResults({ workspace: 'client', relevantCoverage })

export async function evalSpecCovResults({ workspace, relevantCoverage }) {
	const coveredFilenames = Object.keys(relevantCoverage)
	if (!coveredFilenames.length) return

	const covFile = path.join(publicCovDir, `${workspace}-coverage.json`)

	let previousCoverage
	try {
		if (!fs.existsSync(covFile)) previousCoverage = {}
		else {
			const c = await import(covFile, { with: { type: 'json' } })
			if (!c) throw `unable to read spec coverage file='${covFile}'`
			else previousCoverage = c.default
		}
	} catch (e) {
		console.log(e)
		previousCoverage = {}
	}

	console.log(11, previousCoverage)
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

	if (!failedCoverage.size) {
		console.log('\n👏 Branch coverage test PASSED! 🎉')
		console.log('--- Percent coverage was maintained or improved across relevant files! ---\n')
		fs.writeFileSync(covFile, JSON.stringify(relevantCoverage, null, '  '))
	} else {
		console.log(
			`\n!!! Failed coverage: average and/or lowest percent coverage decreased for ${failedCoverage.size} relevant files !!!`
		)
		console.log(Object.fromEntries(failedCoverage.entries()))
		console.log(`\n`)
		//process.exit(1)
	}

	return { ok: !failedCoverage.size, failedCoverage }
}

function getLowestPct(result) {
	if (Object.hasOwn(result, 'lowestPct')) return result.lowestPct.curr
	const values = Object.values(result)
	if (!values.length) return 0
	let min
	for (const v of values) {
		if (!Object.hasOwn(v, 'pct')) continue
		if (min === undefined || min > v.pct) min = v.pct
	}
	return min
}

function getAveragePct(result) {
	if (Object.hasOwn(result, 'averagePct')) return result.averagePct.curr
	const values = Object.values(result)
	if (!values.length) return 0
	let total = 0
	for (const v of values) total += Object.hasOwn(v, 'pct') ? v.pct : 0
	return total / values.length
}
