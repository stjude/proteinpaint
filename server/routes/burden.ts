import type { BurdenRequest, BurdenResponse, RouteApi, CumBurdenData } from '#types'
import { burdenPayload } from '#types/checkers'
// may decide to use these checkers later
//import { validBurdenRequest, validBurdenResponse } from '#types/checkers/routes.js'
import { run_R } from '@sjcrh/proteinpaint-r'
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

//const MAXBOOTNUM = 20

function init({ genomes }) {
	return async function handler(req, res): Promise<void> {
		try {
			const genome = genomes[req.query.genome]
			if (!genome) throw `invalid q.genome=${req.query.genome}`
			const q: BurdenRequest = req.query
			const ds = genome.datasets[q.dslabel]
			if (!ds) throw `invalid q.dslabel=${req.query.dslabel}`
			if (!ds.cohort.cumburden?.files) throw `missing ds.cohort.cumburden.files`
			if (!ds.cohort?.cumburden?.db) throw `missing ds.cohort.cumburden.db`
			if (!ds.cohort?.cumburden?.bootsubdir) throw `missing ds.cohort.cumburden.bootsubdir`

			const result = await getBurdenResult(q, ds.cohort.cumburden)
			if (!q.showCI) {
				res.send({
					status: 'ok',
					/*estimate: result.estimate,*/ ...formatPayload(result.estimate)
				} satisfies BurdenResponse)
			} else {
				if (!result.ci95) await compute95ci(result, ds.cohort.cumburden)
				res.send({ status: 'ok', /*ci95: result.ci95,*/ ...formatPayload(result.ci95) } satisfies BurdenResponse)
			}
		} catch (e: any) {
			res.send({ status: 'error', error: e.message || e })
		}
	}
}

async function getBurdenResult(
	q: BurdenRequest,
	cumburden: CumBurdenData //{ cohort: { cumburden: { files: { fit: any; surv: any; sample: any } } } }
) {
	const { id, jsonInput } = normalizeInput(q, cumburden)
	let result = cumburden.db.connection.prepare('SELECT * FROM estimates WHERE id=?').get(id)
	if (!result) {
		result = { id, status: null, input: jsonInput }
		const estJson = await run_R('burden-main.R', jsonInput, [])
		const estimate = JSON.parse(estJson)

		// compute overall burden by adding burdens from all chc's for each age
		// TODO: may implement this in burden.R
		const ages = Object.keys(estimate[0]).filter(k => k.startsWith('['))
		const overall = { chc: 0 }
		for (const age of ages) {
			overall[age] = [0]
			for (const est of estimate) overall[age][0] += est[age]
		}
		estimate.push(overall)

		// reshape to match the ci95 data shape (see details in compute95ci)
		const burden = {}
		for (const est of estimate) {
			burden[est.chc] = est
		}

		cumburden.db.connection
			.prepare('INSERT INTO estimates (id, input, status, estimate) VALUES (?, ?, ?, ?)')
			.run([result.id, jsonInput, 0, JSON.stringify(burden)])
		result.status = 0
		result.estimate = burden
	}
	for (const [k, v] of Object.entries(result)) {
		if (k !== 'id' && typeof v == 'string') result[k] = JSON.parse(v)
	}
	return result
}

function normalizeInput(q, cumburden) {
	const keys = Object.keys(q)
		.filter(k => k in defaultInputValues)
		.sort()
	const id = keys.map(k => q[k]).join('-')
	const normalized: any = {}
	for (const k of keys) normalized[k] = q[k]
	normalized.datafiles = {
		dir: path.join(serverconfig.tpmasterdir, cumburden.dir),
		files: cumburden.files,
		boosubdir: cumburden.bootsubdir
	}
	const jsonInput = JSON.stringify(normalized)
	return { id, jsonInput }
}

async function compute95ci(result, cumburden) {
	try {
		if (!result.input) throw 'result{} does not have .input'
		// use same input that was used for main burden estimate
		const input = structuredClone(result.input)
		// attach main burden estimate to the input, but filter out overall estimate
		input.burden = Object.values(result.estimate).filter((est: any) => est.chc !== 0)
		const lowup = await run_R('burden-ci95.R', JSON.stringify(input), [])
		const { low, up, overall } = JSON.parse(lowup)

		// ci95 = {
		//   [chcnum]: {
		//     [age]: [burden, lowerCI, upperCI]
		// 	 }
		// }
		// reshape to combine main and 95 %CI estimates as one entry per age per CHC,
		// where chc=0 is overall burden (total burden from all chc's per age)
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

// function sortNumericValue(a, b) {
// 	return a < b ? -1 : 1
// }

function formatPayload(estimates: object[]) {
	const rawKeys = Object.keys(estimates['1']).filter(k => k.startsWith('[')) // estimates key is chcNum, will give age keys
	const renamedKeys = rawKeys.map(k => `burden${k.split(',')[0].slice(1)}`)
	const outKeys = ['chc', ...renamedKeys] as string[]
	const rows: any[] = []
	// estimates{}
	// - key: chc number, where 0 = overall
	// - values: {[age]: []}
	for (const [chc, burdenByAge] of Object.entries(estimates)) {
		const arr: (string | number[])[] = [chc]
		for (const age of rawKeys) arr.push(Array.isArray(burdenByAge[age]) ? burdenByAge[age] : [burdenByAge[age]])
		rows.push(arr)
	}
	return { keys: outKeys, rows }
}

const defaultInputValues = Object.freeze({
	// showCI: false, do not track so it's not computed as part of unique ID
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
