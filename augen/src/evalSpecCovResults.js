import { publicSpecsDir } from './closestSpec.js'
import path from 'path'
import fs from 'fs'

const publicCovDir = path.dirname(publicSpecsDir)

if (process.argv[2]) evalSpecCovResults({ workspace: process.argv[2] })

export async function evalSpecCovResults({ workspace }) {
	const jsonFile = path.join(publicSpecsDir, `${workspace}-relevant.json`)
	if (!fs.existsSync(jsonFile)) return { ok: true }
	const { default: relevantCoverage } = await import(jsonFile, { with: { type: 'json' } })
	const coveredFilenames = Object.keys(relevantCoverage)
	if (!coveredFilenames.length) return { ok: true }
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

	//console.log(11, previousCoverage)
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
		console.log(`\n👏 ${workspace} branch coverage test PASSED! 🎉`)
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
