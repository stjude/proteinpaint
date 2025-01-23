import type { BurdenRequest, BurdenResponse, RouteApi, CumBurdenData } from '#types'
import { burdenPayload } from '#types/checkers'
// may decide to use these checkers later
//import { validBurdenRequest, validBurdenResponse } from '#types/checkers/routes.js'
import run_R from '#src/run_R.js'
import path from 'path'
import serverconfig from '#src/serverconfig.js'

export const api: RouteApi = {
	endpoint: 'burden',
	methods: {
		get: {
			init,
			...burdenPayload
		},
		post: {
			init,
			...burdenPayload
		}
	}
}

const MAXBOOTNUM = 20

function init({ genomes }) {
	return async function handler(req, res): Promise<void> {
		try {
			const genome = genomes[req.query.genome]
			if (!genome) throw `invalid q.genome=${req.query.genome}`
			const q: BurdenRequest = req.query
			const ds = genome.datasets[q.dslabel]
			if (!ds) throw `invalid q.genome=${req.query.dslabel}`
			if (!ds.cohort.cumburden?.files) throw `missing ds.cohort.cumburden.files`
			if (!ds.cohort?.cumburden?.db) throw `missing ds.cohort.cumburden.db`

			const result = await getBurdenResult(q, ds.cohort.cumburden)
			if (result.status < MAXBOOTNUM) await computeBootstrap(result, ds.cohort.cumburden)
			if (!result.ci95 || !Object.keys(result.ci95).length) await compute95ci(result, ds.cohort.cumburden)

			res.send({ status: 'ok', ...formatPayload(result.ci95) } satisfies BurdenResponse)
		} catch (e: any) {
			res.send({ status: 'error', error: e.message || e })
		}
	}
}

async function getBurdenResult(
	q: BurdenRequest,
	cumburden: CumBurdenData //{ cohort: { cumburden: { files: { fit: any; surv: any; sample: any } } } }
) {
	const { id, jsonInput } = normalizeInput(q)
	let result = cumburden.db.connection.prepare('SELECT * FROM estimates WHERE id=?').get(id)
	if (!result) {
		result = { id, status: null, input: jsonInput }
		//console.log(40, input, JSON.stringify(input))
		// TODO: use the dataset location
		const { fit, surv, sample } = cumburden.files
		if (!fit || !surv || !sample) throw `missing one or more of ds.cohort.burden.files.{fit, surv, sample}`
		const args = [
			`${serverconfig.tpmasterdir}/${fit}`,
			`${serverconfig.tpmasterdir}/${surv}`,
			`${serverconfig.tpmasterdir}/${sample}`
		]
		const estimate = await run_R(path.join(serverconfig.binpath, 'utils', 'burden.R'), jsonInput, args)
		cumburden.db.connection
			.prepare('INSERT INTO estimates (id, input, status, estimate) VALUES (?, ?, ?, ?)')
			.run([result.id, jsonInput, 0, estimate])
		result.status = 0
		result.estimate = estimate
	}
	for (const [k, v] of Object.entries(result)) {
		if (k !== 'id' && typeof v == 'string') result[k] = JSON.parse(v)
	}
	return result
}

function normalizeInput(q) {
	const keys = Object.keys(q)
		.filter(k => k in defaultInputValues)
		.sort()
	const id = keys.map(k => q[k]).join('-')
	const normalized = {}
	for (const k of keys) normalized[k] = q[k]
	const jsonInput = JSON.stringify(normalized)
	return { id, jsonInput }
}

async function computeBootstrap(result, cumburden) {
	if (typeof result.status != 'number' || !Number.isInteger(result.status))
		throw `burden result.status is not an integer`
	if (!cumburden.files.boot) throw `ds.cohort.cumburden.files.boot is missing`
	const { dir, fit, surv, template } = cumburden.files.boot
	const input = JSON.stringify(result.input)
	for (let i = result.status + 1; i <= MAXBOOTNUM; i++) {
		const args = [
			`${serverconfig.tpmasterdir}/${dir}${i}/${fit}`,
			`${serverconfig.tpmasterdir}/${dir}${i}/${surv}`,
			`${serverconfig.tpmasterdir}/${template}`
		]
		// run serially to throttle CPU/memory usage for burden app
		const estimate = await run_R(path.join(serverconfig.binpath, 'utils', 'burden.R'), input, args)
		cumburden.db.connection.prepare(`UPDATE estimates SET status=?, boot${i}=? WHERE id=?`).run(i, estimate, result.id)
		result.status = i
	}
}

async function compute95ci(result, cumburden) {
	const bootEstByChc = new Map()
	// first loop through results for bootstrap runs 1-20
	for (const [bootNum, bootResults] of Object.entries(result)) {
		if (!bootNum.startsWith('boot') || !bootResults) continue
		// process only boot* columns
		for (const est of bootResults as any[]) {
			if (!bootEstByChc.has(est.chc)) {
				// for each chc, track bootstrap estimates by age
				const ages = Object.keys(est).filter(k => k.startsWith('[') && k.endsWith(')'))
				bootEstByChc.set(est.chc, new Map(ages.map(age => [age, []])))
			}
			if (!bootEstByChc.get(est.chc)) continue
			for (const [age, burdenArr] of bootEstByChc.get(est.chc).entries()) {
				burdenArr.push(est[age])
			}
		}
	}
	const lower = 0 // MAXBOOTNUM * 0.025
	const upper = 19 // MAXBOOTNUM - 1 // MAXBOOTNUM * 0.975
	result.ci95 = {}
	for (const est of Object.values(result.estimate)) {
		if (!bootEstByChc.get(est.chc)) continue
		if (!result.ci95[est.chc]) result.ci95[est.chc] = {}
		for (const [age, burdenArr] of bootEstByChc.get(est.chc).entries()) {
			burdenArr.sort(sortNumericValue)
			result.ci95[est.chc][age] = [
				est[age],
				Math.min(1, Math.max(burdenArr[lower], 0)),
				Math.min(1, Math.max(burdenArr[upper], 0))
			]
		}
	}
	await cumburden.db.connection
		.prepare(`UPDATE estimates SET ci95=? WHERE id=?`)
		.run(JSON.stringify(result.ci95), result.id)
}

function sortNumericValue(a, b) {
	return a < b ? -1 : 1
}

function formatPayload(estimates: object[]) {
	const rawKeys = Object.keys(estimates['1']) // estimates key is chcNum, will give age keys
	const renamedKeys = rawKeys.map(k => `burden${k.split(',')[0].slice(1)}`)
	const outKeys = ['chc', ...renamedKeys] as string[]
	const rows = [] as any[] // number[][]
	// v = an array of objects with age as keys as cumulative burden as value for a given CHC
	for (const [chc, burdenByAge] of Object.entries(estimates)) {
		const arr = [chc]
		for (const age of rawKeys) arr.push(burdenByAge[age])
		rows.push(arr)
	}
	return { keys: outKeys, rows }
}

const defaultInputValues = Object.freeze({
	diaggrp: 5,
	sex: 0,
	white: 1,
	agedx: 1,
	// chemotherapy
	steriod: 0,
	bleo: 0,
	vcr: 0, //12, // Vincristine
	etop: 0, //2500, // Etoposide
	itmt: 0, // Intrathecal methothrexate_grp: 0,
	ced: 0, //1.6, // Cyclophosphamide, 0.7692 mean 7692.
	cisp: 0, //300, // Cisplatin
	dox: 0, // Anthracycline, 3 mean 300 ml/m2
	carbo: 0, //  Carboplatin
	hdmtx: 0, // High-Dose Methotrexate
	// radiation
	brain: 0, //5.4,
	chest: 0, //2.4,
	heart: 0,
	pelvis: 0,
	abd: 0 //2.4
})
