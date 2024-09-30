import type { BurdenRequest, BurdenResponse } from '#routeTypes/burden.ts'
import run_R from '#src/run_R.js'
import path from 'path'
import serverconfig from '#src/serverconfig.js'
import { write_file } from '#src/utils.js'

export const api = {
	endpoint: 'burden',
	methods: {
		get: {
			init({ genomes }) {
				return async (req: any, res: any): Promise<void> => {
					try {
						const genome = genomes[req.query.genome]
						if (!genome) throw `invalid q.genome=${req.query.genome}`
						const q = req.query as BurdenRequest
						const ds = genome.datasets[q.dslabel]
						if (!ds) throw `invalid q.genome=${req.query.dslabel}`
						if (!ds.cohort.cumburden?.files) throw `missing ds.cohort.cumburden.files`

						const estimates = await getBurdenEstimates(req, ds)
						const { keys, rows } = formatPayload(estimates)
						res.send({ status: 'ok', keys, rows } as BurdenResponse)
					} catch (e: any) {
						res.send({ status: 'error', error: e.message || e })
					}
				}
			},
			request: {
				typeId: 'BurdenRequest'
			},
			response: {
				typeId: 'BurdenResponse'
			},
			examples: [
				{
					request: {
						body: {
							genome: 'hg38',
							// TODO: !!! use hg38-test and TermdbTest !!!
							dslabel: 'SJLife',
							diaggrp: 5,
							sex: 1,
							white: 1,
							agedx: 1,
							bleo: 0,
							etop: 0,
							cisp: 0,
							carbo: 0,
							steriod: 0,
							vcr: 0,
							hdmtx: 0,
							itmt: 0,
							ced: 0,
							dox: 0,
							heart: 0,
							brain: 0,
							abd: 0,
							pelvis: 0,
							chest: 0
						}
					},
					response: {
						header: { status: 200 }
					}
				}
			]
		}
	}
}

async function getBurdenEstimates(
	q: { query: { [x: string]: any } },
	ds: { cohort: { cumburden: { files: { fit: any; surv: any; sample: any } } } }
) {
	for (const k in q.query) {
		q.query[k] = Number(q.query[k])
	}
	const data = Object.assign({}, defaults, q.query)
	//console.log(40, data, JSON.stringify(data))
	// TODO: use the dataset location
	const { fit, surv, sample } = ds.cohort.cumburden.files
	if (!fit || !surv || !sample) throw `missing one or more of ds.cohort.burden.files.{fit, surv, sample}`
	const args = [
		`${serverconfig.tpmasterdir}/${fit}`,
		`${serverconfig.tpmasterdir}/${surv}`,
		`${serverconfig.tpmasterdir}/${sample}`
	]
	const estimates = JSON.parse(
		await run_R(path.join(serverconfig.binpath, 'utils', 'burden.R'), JSON.stringify(data), args)
	)
	return estimates
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
