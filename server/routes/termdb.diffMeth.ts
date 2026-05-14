import type { DiffMethEntry, DiffMethFullResponse, DiffMethRequest, RouteApi } from '#types'
import { diffMethPayload } from '#types/checkers'
import { mayLog } from '#src/helpers.ts'
import { run_R } from '@sjcrh/proteinpaint-r'
import { formatElapsedTime } from '#shared'
import { renderVolcano } from '../src/renderVolcano.ts'
import { cacheOrRecompute, canonicalizeSamplelst, writeJsonCache } from '#src/utils/cacheOrRecompute.ts'
import { buildGroupValues, resolveDaContext, type SampleGroups } from '#src/utils/sampleGroups.ts'
import type { DmCacheEnvelope } from './types.ts'

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
			const q = req.query as DiffMethRequest

			if ((q as any).preAnalysis) {
				const { ds, term_results, term_results2 } = await resolveDaContext(q, genomes)
				const groups = resolveDmSampleGroups(q, ds, term_results, term_results2)
				const group1Name = q.samplelst.groups[0].name
				const group2Name = q.samplelst.groups[1].name
				res.send({
					data: {
						[group1Name]: groups.group1names.length,
						[group2Name]: groups.group2names.length,
						...(groups.alerts.length ? { alert: groups.alerts.join(' | ') } : {})
					}
				})
				return
			}

			const { envelope, cacheId, fromCache } = await getDmEnvelope(q, genomes)

			const rendered = await renderVolcano<DiffMethEntry>(envelope.promoterRows, q.volcanoRender)
			rendered.cacheId = cacheId

			// Empty dots is valid (strict thresholds) and the PNG should still
			// return; only abort if no rows reached the renderer at all.
			if (rendered.totalRows === 0)
				throw new Error('No promoters passed filtering. Try relaxing group criteria or selecting more samples.')

			const output: DiffMethFullResponse = {
				data: rendered,
				sample_size1: envelope.sample_size1,
				sample_size2: envelope.sample_size2
			}
			void fromCache
			res.send(output)
		} catch (e: any) {
			res.send({ status: 'error', error: e.message || e })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}

/** The subset of a DiffMethRequest that determines the cache identity.
 * Rendering parameters are excluded because changing them does not
 * change the DM result. */
function dmKeyInputs(req: DiffMethRequest) {
	return {
		genome: req.genome,
		dslabel: req.dslabel,
		samplelst: canonicalizeSamplelst(req.samplelst),
		min_samples_per_group: req.min_samples_per_group ?? null,
		tw: req.tw ?? null,
		tw2: req.tw2 ?? null,
		filter: (req as any).filter ?? null,
		filter0: (req as any).filter0 ?? null
	}
}

/** Single read-or-recompute entry point for the DM cache. Used by the
 * route handler above and by genesetEnrichment.ts when projecting
 * gene_name + fold_change off a cached DM envelope. cacheOrRecompute's
 * pending map dedupes concurrent identical calls. */
export async function getDmEnvelope(
	req: DiffMethRequest,
	genomes: any
): Promise<{ envelope: DmCacheEnvelope; cacheId: string; fromCache: boolean }> {
	const { result, cacheId, fromCache } = await cacheOrRecompute<ReturnType<typeof dmKeyInputs>, DmCacheEnvelope>({
		computeArgument: dmKeyInputs(req),
		cacheSubdir: 'dm',
		computeFresh: async (_args, _id, file) => {
			const { ds, term_results, term_results2 } = await resolveDaContext(req, genomes)
			return runDmFresh(req, ds, term_results, term_results2, file)
		}
	})
	return { envelope: result, cacheId, fromCache }
}

/** Resolve the two sample groups + any confounder value arrays for DM.
 * Wraps the shared `buildGroupValues` with DM-specific dataset query
 * lookup and user-facing alert messages (rendered directly in the
 * volcano UI, vs DE's engineer-facing strings). */
export function resolveDmSampleGroups(
	param: DiffMethRequest,
	ds: any,
	term_results: any,
	term_results2: any
): SampleGroups {
	if (param.samplelst?.groups?.length != 2)
		throw new Error('Exactly 2 sample groups are required for differential methylation analysis.')
	if (param.samplelst.groups[0].values?.length < 1)
		throw new Error('Group 1 has no samples. Please select at least one sample.')
	if (param.samplelst.groups[1].values?.length < 1)
		throw new Error('Group 2 has no samples. Please select at least one sample.')

	const q = ds.queries.dnaMethylation?.promoter
	if (!q) throw new Error('This dataset does not have promoter-level methylation data configured.')
	if (!q.file) throw new Error('Promoter methylation data file is not configured for this dataset.')

	const g1 = buildGroupValues(param.samplelst.groups[0].values, q, ds, param.tw, param.tw2, term_results, term_results2)
	const g2 = buildGroupValues(param.samplelst.groups[1].values, q, ds, param.tw, param.tw2, term_results, term_results2)

	const alerts: string[] = []
	if (g1.names.length < 1) alerts.push('No samples in group 1 have methylation data available.')
	if (g2.names.length < 1) alerts.push('No samples in group 2 have methylation data available.')
	const commonnames = g1.names.filter(x => g2.names.includes(x))
	if (commonnames.length)
		alerts.push(
			`${commonnames.length} sample(s) appear in both groups: ${commonnames.join(', ')}. Please remove duplicates.`
		)

	return {
		group1names: g1.names,
		group2names: g2.names,
		conf1_group1: g1.conf1,
		conf1_group2: g2.conf1,
		conf2_group1: g1.conf2,
		conf2_group2: g2.conf2,
		alerts
	}
}

type DiffMethInput = {
	case: string
	control: string
	input_file: string
	min_samples_per_group?: number
	conf1?: any[]
	conf1_mode?: 'continuous' | 'discrete'
	conf2?: any[]
	conf2_mode?: 'continuous' | 'discrete'
}

async function runDmFresh(
	param: DiffMethRequest,
	ds: any,
	term_results: any,
	term_results2: any,
	cacheFile: string
): Promise<DmCacheEnvelope> {
	const groups = resolveDmSampleGroups(param, ds, term_results, term_results2)
	if (groups.alerts.length) throw new Error(groups.alerts.join(' | '))

	const q = ds.queries.dnaMethylation.promoter

	const diffMethInput: DiffMethInput = {
		// Group 1 is control, group 2 is case (same convention as DE).
		case: groups.group2names.join(','),
		control: groups.group1names.join(','),
		input_file: q.file,
		min_samples_per_group: param.min_samples_per_group
	}

	if (param.tw) {
		diffMethInput.conf1 = [...groups.conf1_group2, ...groups.conf1_group1]
		diffMethInput.conf1_mode = param.tw.q.mode
		if (new Set(diffMethInput.conf1).size === 1) throw new Error('Confounding variable 1 has only one value')
	}

	if (param.tw2) {
		diffMethInput.conf2 = [...groups.conf2_group2, ...groups.conf2_group1]
		diffMethInput.conf2_mode = param.tw2.q.mode
		if (new Set(diffMethInput.conf2).size === 1) throw new Error('Confounding variable 2 has only one value')
	}

	const time1 = Date.now()
	const result = JSON.parse(await run_R('diffMeth.R', JSON.stringify(diffMethInput)))
	mayLog('Time taken to run diffMeth:', formatElapsedTime(Date.now() - time1))

	const envelope: DmCacheEnvelope = {
		promoterRows: result.promoter_data,
		sample_size1: groups.group1names.length,
		sample_size2: groups.group2names.length
	}
	await writeJsonCache(cacheFile, envelope)
	return envelope
}
