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

			for (const k in q) {
				if (k != 'dslabel' && k != 'genome') q[k] = Number(q[k])
			}
			const data = Object.assign({}, defaults, q)
			console.log(56, data)

			// const id = Object.keys(q).filter(k => k != 'genome' && k != 'dslabel').sort().map(k => q[k]).join('-')
			// const db = ds.cohort?.cumburden?.db
			// let result = db.connection.prepare('SELECT id, status FROM estimates WHERE id=?').get(id); console.log(36, result)
			// if (!result) result = {id, status: null}
			const result = await getBurdenResult(q, data, ds.cohort.cumburden)

			res.send({ status: 'ok', result }) // satisfies BurdenResponse)
		} catch (e: any) {
			res.send({ status: 'error', error: e.message || e })
		}
	}
}

async function getBurdenResult(
	q: BurdenRequest,
	data: any,
	cumburden: CumBurdenData //{ cohort: { cumburden: { files: { fit: any; surv: any; sample: any } } } }
) {
	const id = Object.keys(q)
		.filter(k => k in defaults)
		.sort()
		.map(k => q[k])
		.join('-')
	let result = cumburden.db.connection.prepare('SELECT * FROM estimates WHERE id=?').get(id)
	console.log(36, result)
	if (!result) {
		result = { id }
		//console.log(40, data, JSON.stringify(data))
		// TODO: use the dataset location
		const { fit, surv, sample } = cumburden.files
		if (!fit || !surv || !sample) throw `missing one or more of ds.cohort.burden.files.{fit, surv, sample}`
		const args = [
			`${serverconfig.tpmasterdir}/${fit}`,
			`${serverconfig.tpmasterdir}/${surv}`,
			`${serverconfig.tpmasterdir}/${sample}`
		]

		const promises: any[] = []
		const estimate = await run_R(path.join(serverconfig.binpath, 'utils', 'burden.R'), JSON.stringify(data), args)
		cumburden.db.connection
			.prepare('INSERT INTO estimates (id, status, estimate) VALUES (?, ?, ?)')
			.run([result.id, 0, estimate])
		result.status = 0
		result.estimate = estimate
	}
	for (const [k, v] of Object.entries(result)) {
		if (k !== 'id' && typeof v == 'string') result[k] = JSON.parse(v)
	}
	return result
}

function formatPayload(estimates: object[]) {
	const rawKeys = Object.keys(estimates[0])
	const outKeys = [] as string[]
	const keys = [] as string[]
	for (const k of rawKeys) {
		if (k == 'chc') {
			keys.push(k)
			outKeys.push(k)
		} else {
			const age = Number(k.slice(1).split(',')[0])
			if (age <= 60 && age % 2 == 0) {
				keys.push(k)
				outKeys.push(`burden${age}`)
			}
		}
	}
	const rows = [] as number[][]
	// v = an array of objects with age as keys as cumulative burden as value for a given CHC
	for (const v of estimates) {
		rows.push(keys.map(k => v[k]))
	}
	return { keys: outKeys, rows }
}

const defaults = Object.freeze({
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
