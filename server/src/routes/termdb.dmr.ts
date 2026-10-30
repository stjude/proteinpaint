import type { RoutePayload, RouteApi, TermdbDmrRequest, TermdbDmrSuccessResponse, DmrScanYAxis } from '#types'
import { DMR_SCAN_Y_AXES } from '#types'

type Dmr = TermdbDmrSuccessResponse['dmrs'][number]
import { invalidcoord } from '#shared/common.js'
import { mayLog } from '#src/helpers.ts'
import {
	resolveMethylationMatrix,
	resolveGroupNames,
	admitDmrcateRegion,
	dmrcateValues,
	eligibleMethylationSamples,
	runDmrcate
} from '#src/utils/methylationMatrix.ts'
import { resolveGroupPair } from '#src/utils/sampleGroups.ts'
import { formatElapsedTime } from '#shared'
import { genomes } from '#src/initGenomesDs.js'
import { hasDnaMethylationDs } from './termdb.diffMeth.ts'
import { scanChromosomes } from '../../routes/termdb.diffMeth.ts'
import { runDmrBatch } from './termdb.dmrBatch.ts'

export const payload: RoutePayload = {
	// only set up when at least one ds has ds.queries.dnaMethylation, see termdb.diffMeth.ts
	get init() {
		return hasDnaMethylationDs(genomes) ? init : null
	},
	request: { typeId: 'TermdbDmrRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'TermdbDmrResponse' }
}

export const api: RouteApi = {
	endpoint: 'termdb/dmr',
	methods: {
		get: payload,
		post: payload
	}
}

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		try {
			const q: TermdbDmrRequest = req.query
			const genome = genomes[q.genome]
			if (!genome) throw 'unknown genome'
			const ds = genome.datasets?.[q.dslabel]
			if (!ds) throw 'unknown ds'
			const dm = ds.queries?.dnaMethylation
			if (!dm) throw new Error('This dataset does not support DNA methylation region analysis.')

			/* The matrix a scan runs on: the region view is a window on a scan and takes no element class,
			so an element-class result can never be drawn under DMRcate's calls. */
			const matrix = resolveMethylationMatrix(ds, q.chr, undefined)
			const { matrixFile } = matrix

			// a group may be defined by a filter
			const [list1, list2] = await resolveGroupPair(q, ds)
			if (!Array.isArray(list1) || list1.length == 0)
				throw new Error('Group 1 has no samples. Please select at least one sample.')
			if (!Array.isArray(list2) || list2.length == 0)
				throw new Error('Group 2 has no samples. Please select at least one sample.')
			if (invalidcoord(genome, q.chr, q.start, q.stop))
				throw new Error(`Invalid genomic coordinates: ${q.chr}:${q.start}-${q.stop}`)

			// Hard server-side safety cap — prevents expensive requests regardless of client settings.
			// The client enforces its own configurable limit (settings.dmr.maxRegionSize, default 5 Mb)
			// which should always be <= this cap. This guard catches direct API calls or buggy clients.
			const SERVER_MAX_REGION_BP = 10_000_000
			const span = q.stop - q.start
			if (span > SERVER_MAX_REGION_BP)
				throw new Error(
					`Region too large (${(span / 1e6).toFixed(1)} Mb). Server maximum is ${SERVER_MAX_REGION_BP / 1e6} Mb.`
				)

			// the run's own sample set (runDmrBatch), whose prior and cutoffs this view applies
			const { group1, group2 } = await resolveGroupNames(
				list1,
				list2,
				eligibleMethylationSamples(ds, undefined),
				ds,
				q.__protected__
			)
			// checked after id-to-name resolution, which is where a group actually shrinks
			if (group1.length < 3 || group2.length < 3)
				throw new Error(
					`Each group needs at least 3 samples with methylation data (got ${group1.length} and ${group2.length}).`
				)

			/* A window on a DMRcate run, not an analysis of its own: DMRcate's prior, its BH corrections
			and its adaptive cutoff are all over the run, so a region analysed alone would call different
			DMRs. Opened from a scan, it windows that scan's run, already cached, so it shows the DMRs the
			volcano drew. Otherwise it is the genome-wide run, about a minute the first time per contrast
			on DISCOVER and cached after. Not the region's own chromosome, though that takes seconds: the
			adaptive cutoff calibrated on one chromosome is far from the genome's (chr16 of DISCOVER NM
			Background vs ATRT SHH: 2.2e-22 against 9.1e-17), and only 68 of its 5,787 DMRs had the
			genome-wide run's coordinates, which also called 2,258 DMRs there that it missed. */
			const genomeChroms = scanChromosomes({} as any, genome)
			const fromScan =
				Array.isArray(q.scanChromosomes) && q.scanChromosomes.length
					? q.scanChromosomes.filter((c: unknown) => typeof c == 'string' && genomeChroms.includes(c))
					: []
			if (!genomeChroms.includes(q.chr)) throw new Error(`Unknown chromosome: ${q.chr}`)
			// a chromosome outside the scan's run would be another run, with its own prior and cutoffs
			if (fromScan.length && !fromScan.includes(q.chr))
				throw new Error(`${q.chr} was not in the DMR scan this view was opened from.`)
			const runChroms = fromScan.length ? fromScan : genomeChroms
			const { payload: run } = await runDmrBatch(
				{
					genome: q.genome,
					dslabel: q.dslabel,
					group1: q.group1,
					group2: q.group2,
					filter: q.filter,
					filter0: q.filter0,
					scanChromosomes: runChroms,
					binMethylation: true,
					lambda: q.lambda,
					C: q.C,
					fdr_cutoff: q.fdr_cutoff,
					// in the run's cache key: the scan's own setting, or this misses its run and refits
					backgroundCorrection: !!q.backgroundCorrection,
					__protected__: q.__protected__
				},
				genomes,
				// this chromosome only, held in memory after the first request, so a pan or zoom does not parse the genome
				{ chr: q.chr }
			)
			if (!run.constants) throw new Error('This DMR run predates region views; run the scan again.')
			// the scan's CpG floor: a DMR the scan dropped is not drawn as one it counted
			const minCpgs = Math.max(1, Math.floor(Number(q.minCpgs) || 1))
			/* nor any other DMR the volcano leaves out of its rows: one with no Δβ, and one without the plotted
			statistic -- the background p under the correction, else the scan's y axis */
			const yAxis: DmrScanYAxis = DMR_SCAN_Y_AXES.includes(q.yAxis as DmrScanYAxis) ? q.yAxis! : 'min_smoothed_fdr'
			const plotted = (d: Dmr) =>
				d.no_cpgs >= minCpgs && d.delta_beta_mean != null && (q.backgroundCorrection ? d.bgP : d[yAxis]) != null
			const dmrInput = {
				matrices: [{ file: matrixFile, chrs: [q.chr] }],
				...dmrcateValues(matrix),
				case: group2.join(','),
				control: group1.join(','),
				lambda: run.constants.lambda,
				C: run.constants.C,
				region: { chr: q.chr, start: q.start, stop: q.stop },
				constants: run.constants,
				dmrs: run.regions
					.filter(r => r.chr == q.chr)
					.flatMap(r => r.dmrs)
					.filter(plotted),
				blockWidth: q.blockWidth,
				devicePixelRatio: q.devicePixelRatio,
				maxLoessRegion: q.maxLoessRegion,
				colors: q.colors
			}

			const releaseMemory = await admitDmrcateRegion(
				matrixFile,
				'Server memory is too low to analyze this region right now. Try again later.'
			)
			const time1 = Date.now()
			let result
			try {
				result = JSON.parse(await runDmrcate(dmrInput, 'Try a smaller region.'))
			} finally {
				releaseMemory()
			}
			mayLog('DMR region time:', formatElapsedTime(Date.now() - time1))
			if (result.error) throw new Error(result.error)
			result.diagnostic.total_probes_analyzed = run.totalProbesAnalyzed

			const maskedDmrs = run.regions
				.filter(r => r.chr == q.chr)
				.flatMap(r => r.masked || [])
				// inclusive, as dmrcate's region mode selects the drawn DMRs, so the two agree at the window's edges
				.filter(d => d.start <= q.stop && d.stop >= q.start && d.no_cpgs >= minCpgs)
			res.send({
				status: 'ok',
				dmrs: result.dmrs,
				...(maskedDmrs.length ? { maskedDmrs } : {}),
				diagnostic: result.diagnostic
			} as TermdbDmrSuccessResponse)
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e)
			res.send({ error: msg })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}
