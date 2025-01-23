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
			Object.assign(q, defaultInputValues)
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
		const estJson = await run_R(path.join(serverconfig.binpath, 'utils', 'burden.R'), jsonInput, args)
		const estimate = JSON.parse(estJson)

		// compute overall burden by adding burdens from all chc's for each age
		// TODO: may implement this in burden.R
		const ages = Object.keys(estimate[0]).filter(k => k.startsWith('['))
		const overall = { chc: 0 }
		for (const age of ages) {
			overall[age] = 0
			for (const est of estimate) overall[age] += est[age]
		}
		estimate.push(overall)

		cumburden.db.connection
			.prepare('INSERT INTO estimates (id, input, status, estimate) VALUES (?, ?, ?, ?)')
			.run([result.id, jsonInput, 0, JSON.stringify(estimate)])
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
	const boots: any[] = []
	for (const [bootNum, bootResults] of Object.entries(result)) {
		if (!bootNum.startsWith('boot') || !bootResults) continue
		// process only boot* columns
		for (const est of bootResults as any[]) {
			boots.push({ ...est, boot: bootNum })
		}
	}

	try {
		const args = [result.input.diaggrp]
		const input = JSON.stringify({ boots, burden: result.estimate.filter(est => est.chc !== 0) })
		const lowup = await run_R(path.join(serverconfig.binpath, 'utils', 'burden-ci95.R'), input, args)
		const { low, up, overall } = JSON.parse(lowup)
		const ci95 = { 0: {} }
		for (const est of Object.values(result.estimate as any[])) {
			if (!ci95[est.chc]) ci95[est.chc] = {}
			const lower = low.find(l => l.chc === est.chc)
			const upper = up.find(u => u.chc === est.chc)
			for (const [age, val] of Object.entries(est)) {
				// age keys are in the format "[20,21)"
				if (!age.startsWith('[')) continue
				const burden = est.chc === 0 ? overall[0][age] : val
				ci95[est.chc][age] = [burden, lower[age], upper[age]]
			}
		}
		result.ci95 = ci95
	} catch (e) {
		console.log(e)
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
	sex: 1,
	white: 1,
	agedx: 6,
	// chemotherapy
	steriod: 0,
	bleo: 0,
	vcr: 12, // Vincristine
	etop: 2500, // Etoposide
	itmt: 0, // Intrathecal methothrexate_grp: 0,
	ced: 1.6, // Cyclophosphamide, 0.7692 mean 7692.
	cisp: 300, // Cisplatin
	dox: 0, // Anthracycline, 3 mean 300 ml/m2
	carbo: 0, //  Carboplatin
	hdmtx: 0, // High-Dose Methotrexate
	// radiation
	brain: 5.4,
	chest: 2.4,
	heart: 0,
	pelvis: 0,
	abd: 2.4
})
