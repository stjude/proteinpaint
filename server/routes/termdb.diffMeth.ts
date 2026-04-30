import type { DiffMethEntry, DiffMethFullResponse, DiffMethRequest, RouteApi } from '#types'
import { diffMethPayload } from '#types/checkers'
import { getData } from '../src/termdb.matrix.js'
import { run_R } from '@sjcrh/proteinpaint-r'
import { mayLog } from '#src/helpers.ts'
import { formatElapsedTime } from '#shared'
import { renderVolcano } from '../src/renderVolcano.ts'

export const api: RouteApi = {
	endpoint: 'termdb/diffMeth',
	methods: {
		get: {
			...diffMethPayload,
			init
		},
		post: {
			...diffMethPayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		try {
			const q = req.query
			const genome = genomes[q.genome]
			if (!genome) throw 'unknown genome'
			const ds = genome.datasets?.[q.dslabel]
			if (!ds) throw 'unknown ds'

			// Get confounding variable data if term wrappers are provided
			let term_results: any = []
			if (q.tw) {
				term_results = await getData({ filter: q.filter, filter0: q.filter0, terms: [q.tw] }, ds)
				if (term_results.error) throw new Error(term_results.error)
			}

			let term_results2: any = []
			if (q.tw2) {
				term_results2 = await getData({ filter: q.filter, filter0: q.filter0, terms: [q.tw2] }, ds)
				if (term_results2.error) throw new Error(term_results2.error)
			}

			const results = (await run_diffMeth(req.query as DiffMethRequest, ds, term_results, term_results2)) as any
			if (!results || !results.data)
				throw new Error(
					'Differential methylation analysis returned no data. Please verify sample selections and try again.'
				)
			// preAnalysis short-circuit returns `data: {alert, ...}` (no totalRows).
			// Full mode: throw only when no promoter_data reached the renderer at all;
			// empty dots is valid (strict thresholds) and the PNG should still return.
			if ('totalRows' in results.data && results.data.totalRows === 0)
				throw new Error('No promoters passed filtering. Try relaxing group criteria or selecting more samples.')
			res.send(results)
		} catch (e: any) {
			res.send({ status: 'error', error: e.message || e })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}

async function run_diffMeth(param: DiffMethRequest, ds: any, term_results: any, term_results2: any) {
	if (param.samplelst?.groups?.length != 2)
		throw new Error('Exactly 2 sample groups are required for differential methylation analysis.')
	if (param.samplelst.groups[0].values?.length < 1)
		throw new Error('Group 1 has no samples. Please select at least one sample.')
	if (param.samplelst.groups[1].values?.length < 1)
		throw new Error('Group 2 has no samples. Please select at least one sample.')

	const q = ds.queries.dnaMethylation?.promoter
	if (!q) throw new Error('This dataset does not have promoter-level methylation data configured.')
	if (!q.file) throw new Error('Promoter methylation data file is not configured for this dataset.')

	// Convert integer sample IDs to string sample names, filtering to those present in the H5
	const group1names = [] as string[]
	const conf1_group1: (string | number)[] = []
	const conf2_group1: (string | number)[] = []
	for (const s of param.samplelst.groups[0].values) {
		if (!Number.isInteger(s.sampleId)) continue
		const n = ds.cohort.termdb.q.id2sampleName(s.sampleId)
		if (!n) continue
		if (!q.allSampleSet.has(n)) continue

		if (param.tw && param.tw2) {
			if (term_results.samples[s.sampleId] && term_results2.samples[s.sampleId]) {
				conf1_group1.push(
					param.tw.q.mode == 'continuous'
						? term_results.samples[s.sampleId][param.tw.$id]['value']
						: term_results.samples[s.sampleId][param.tw.$id]['key']
				)
				conf2_group1.push(
					param.tw2.q.mode == 'continuous'
						? term_results2.samples[s.sampleId][param.tw2.$id]['value']
						: term_results2.samples[s.sampleId][param.tw2.$id]['key']
				)
				group1names.push(n)
			}
		} else if (param.tw && !param.tw2) {
			if (term_results.samples[s.sampleId]) {
				conf1_group1.push(
					param.tw.q.mode == 'continuous'
						? term_results.samples[s.sampleId][param.tw.$id]['value']
						: term_results.samples[s.sampleId][param.tw.$id]['key']
				)
				group1names.push(n)
			}
		} else if (!param.tw && param.tw2) {
			if (term_results2.samples[s.sampleId]) {
				conf2_group1.push(
					param.tw2.q.mode == 'continuous'
						? term_results2.samples[s.sampleId][param.tw2.$id]['value']
						: term_results2.samples[s.sampleId][param.tw2.$id]['key']
				)
				group1names.push(n)
			}
		} else {
			group1names.push(n)
		}
	}

	const group2names = [] as string[]
	const conf1_group2: (string | number)[] = []
	const conf2_group2: (string | number)[] = []
	for (const s of param.samplelst.groups[1].values) {
		if (!Number.isInteger(s.sampleId)) continue
		const n = ds.cohort.termdb.q.id2sampleName(s.sampleId)
		if (!n) continue
		if (!q.allSampleSet.has(n)) continue

		if (param.tw && param.tw2) {
			if (term_results.samples[s.sampleId] && term_results2.samples[s.sampleId]) {
				conf1_group2.push(
					param.tw.q.mode == 'continuous'
						? term_results.samples[s.sampleId][param.tw.$id]['value']
						: term_results.samples[s.sampleId][param.tw.$id]['key']
				)
				conf2_group2.push(
					param.tw2.q.mode == 'continuous'
						? term_results2.samples[s.sampleId][param.tw2.$id]['value']
						: term_results2.samples[s.sampleId][param.tw2.$id]['key']
				)
				group2names.push(n)
			}
		} else if (param.tw && !param.tw2) {
			if (term_results.samples[s.sampleId]) {
				conf1_group2.push(
					param.tw.q.mode == 'continuous'
						? term_results.samples[s.sampleId][param.tw.$id]['value']
						: term_results.samples[s.sampleId][param.tw.$id]['key']
				)
				group2names.push(n)
			}
		} else if (!param.tw && param.tw2) {
			if (term_results2.samples[s.sampleId]) {
				conf2_group2.push(
					param.tw2.q.mode == 'continuous'
						? term_results2.samples[s.sampleId][param.tw2.$id]['value']
						: term_results2.samples[s.sampleId][param.tw2.$id]['key']
				)
				group2names.push(n)
			}
		} else {
			group2names.push(n)
		}
	}

	const sample_size1 = group1names.length
	const sample_size2 = group2names.length

	const alerts = validateGroups(sample_size1, sample_size2, group1names, group2names)

	if (param.preAnalysis) {
		const group1Name = param.samplelst.groups[0].name
		const group2Name = param.samplelst.groups[1].name
		return {
			data: {
				[group1Name]: sample_size1,
				[group2Name]: sample_size2,
				...(alerts.length ? { alert: alerts.join(' | ') } : {})
			}
		}
	}

	if (alerts.length) throw new Error(alerts.join(' | '))

	// Group 1 is control, group 2 is case (same convention as DE route)
	const diffMethInput: DiffMethInput = {
		case: group2names.join(','),
		control: group1names.join(','),
		input_file: q.file,
		min_samples_per_group: param.min_samples_per_group
	}

	if (param.tw) {
		diffMethInput.conf1 = [...conf1_group2, ...conf1_group1]
		diffMethInput.conf1_mode = param.tw.q.mode
		if (new Set(diffMethInput.conf1).size === 1) {
			throw new Error('Confounding variable 1 has only one value')
		}
	}

	if (param.tw2) {
		diffMethInput.conf2 = [...conf2_group2, ...conf2_group1]
		diffMethInput.conf2_mode = param.tw2.q.mode
		if (new Set(diffMethInput.conf2).size === 1) {
			throw new Error('Confounding variable 2 has only one value')
		}
	}

	const time1 = Date.now()
	const result = JSON.parse(await run_R('diffMeth.R', JSON.stringify(diffMethInput)))
	mayLog('Time taken to run diffMeth:', formatElapsedTime(Date.now() - time1))

	const rendered = await renderVolcano<DiffMethEntry>(result.promoter_data, param.volcanoRender)
	const output: DiffMethFullResponse = {
		data: rendered,
		sample_size1,
		sample_size2
	}
	return output
}

function validateGroups(sample_size1: number, sample_size2: number, group1names: string[], group2names: string[]) {
	const alerts: string[] = []
	if (sample_size1 < 1) alerts.push('No samples in group 1 have methylation data available.')
	if (sample_size2 < 1) alerts.push('No samples in group 2 have methylation data available.')
	const commonnames = group1names.filter(x => group2names.includes(x))
	if (commonnames.length)
		alerts.push(
			`${commonnames.length} sample(s) appear in both groups: ${commonnames.join(', ')}. Please remove duplicates.`
		)
	return alerts
}

type DiffMethInput = {
	/** Case samples separated by , */
	case: string
	/** Control samples separated by , */
	control: string
	/** Absolute path to promoter-level M-value HDF5 file */
	input_file: string
	/** Minimum non-NA samples required per group */
	min_samples_per_group?: number
	/** Confounding variable 1 values, one per sample */
	conf1?: any[]
	/** Type of the confounding variable 1 (continuous/discrete) */
	conf1_mode?: 'continuous' | 'discrete'
	/** Confounding variable 2 values, one per sample */
	conf2?: any[]
	/** Type of the confounding variable 2 (continuous/discrete) */
	conf2_mode?: 'continuous' | 'discrete'
}
