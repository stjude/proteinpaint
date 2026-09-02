import type { RoutePayload, RouteApi, TermdbDmrRequest, TermdbDmrSuccessResponse } from '#types'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import { run_R } from '@sjcrh/proteinpaint-r'
import { invalidcoord } from '#shared/common.js'
import { mayLog } from '#src/helpers.ts'
import { resolveElementQuery } from '../../routes/termdb.diffMeth.ts'
import { buildGroupValues } from '#src/utils/sampleGroups.ts'
import serverconfig from '#src/serverconfig.js'
import { formatElapsedTime } from '#shared'

export const payload: RoutePayload = {
	init,
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

			/* Three backings, one analysis, finest first:

			  .cpgByChr   per-chromosome CpG matrices, the resolution region calling actually wants
			  .file       one genome-wide CpG matrix
			  elements    the element matrix behind the element type the volcano was showing, where
			              one row is a cCRE rather than a CpG

			The element fallback is what makes the drill-down reachable at all from a hit of ANY cCRE
			class on a cohort with no CpG matrix, but it is a fallback: cCREs are median 316bp/4 CpGs
			against DMRs of median 737bp/12 CpGs, so element averaging cannot resolve sub-element
			structure. Prefer building the CpG shards.

			The element path is deliberately NOT restricted to that element type's element_class the
			way the volcano is: the classes are sparse genome-wide (PLS promoters run ~1 per Mb), so a
			class-restricted window would hold two or three elements -- nothing to smooth or segment.
			Every element in the matrix is tested instead, which does mean the per-element FDRs come
			from a larger universe than the volcano's class-restricted DM and will not match it.

			The fallback is per chromosome, not per dataset: a cohort part-way through building its
			shards serves CpG resolution where a shard exists and elements everywhere else, rather
			than failing on the chromosomes it has not built yet. */
			/* An explicit element_type that names nothing is a caller bug and resolveElementQuery says
			so precisely. Its ABSENCE is not: the DMR chart can be launched straight from the group
			menu with only a region, never having been through the volcano. So fall back to the
			dataset's default class when one resolves, and to no entry at all when none does -- the
			entry is wanted for its eligible-sample set, and is only load-bearing when the element
			matrix is also the analysis matrix, which the branch below requires. */
			const hasElements = !!(dm.promoter || Object.keys(dm.elements ?? {}).length)
			let elementEntry: any
			if (q.element_type) {
				elementEntry = resolveElementQuery(ds, q.element_type).q
			} else if (hasElements) {
				try {
					elementEntry = resolveElementQuery(ds, undefined).q
				} catch {
					elementEntry = undefined // dataset declares classes but no default 'promoter' one
				}
			}

			let matrixFile: string
			let mvalues = false
			let useElement = false
			if (dm.cpgChroms?.has(q.chr)) {
				matrixFile = dm.cpgByChr.replace('{chr}', q.chr)
			} else if (dm.file) {
				matrixFile = dm.file
			} else if (elementEntry) {
				matrixFile = elementEntry.file
				// element matrices may hold either scale; the ds config entry declares which
				mvalues = /m-?value/i.test(elementEntry.unit || '')
				useElement = true
			} else {
				throw new Error('This dataset does not support DNA methylation region analysis.')
			}

			if (!Array.isArray(q.group1) || q.group1.length == 0)
				throw new Error('Group 1 has no samples. Please select at least one sample.')
			if (!Array.isArray(q.group2) || q.group2.length == 0)
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

			/* The client sends group membership the way every two-group analysis does -- as termdb
			sample ids -- while the matrices are keyed by sample NAME, so the ids are resolved here
			through the same resolver differential methylation uses. Reading a `sample` field off
			the request instead silently produced empty groups for every caller whose group values
			carry ids alone, which is most of them.

			The eligible set is the element entry's when the dataset has one, because that set
			already has the dataset's excludeSampleNamesMatching applied: a specimen type the
			volcano withheld must not reappear here, or the region view would contrast a different
			set of samples than the hit being drilled into. Names absent from the region matrix are
			dropped by the analysis itself. */
			const eligible: Set<string> = elementEntry?.allSampleSet || dm.regionSampleSet
			const [g1, g2] = await Promise.all([
				buildGroupValues(q.group1, eligible, ds, undefined, undefined, undefined, undefined),
				buildGroupValues(q.group2, eligible, ds, undefined, undefined, undefined, undefined)
			])
			const group1 = g1.names
			const group2 = g2.names
			if (group1.length < 3)
				throw new Error(`Group 1 needs at least 3 samples with methylation data, got ${group1.length}.`)
			if (group2.length < 3)
				throw new Error(`Group 2 needs at least 3 samples with methylation data, got ${group2.length}.`)

			const useR = q.backend === 'r'
			// dmrcate_full.R reads the CpG layout only (chrom_lengths attribute, meta/probe/probeID)
			if (useR && useElement)
				throw new Error('The R backend does not read element-level methylation matrices. Use the Rust backend.')
			const dmrInput = {
				probe_h5_file: matrixFile,
				mvalues,
				cachedir: serverconfig.cachedir,
				genome: q.genome,
				chr: q.chr,
				start: q.start,
				stop: q.stop,
				case: group2.join(','),
				control: group1.join(','),
				fdr_cutoff: q.fdr_cutoff,
				lambda: q.lambda,
				C: q.C,
				blockWidth: q.blockWidth,
				devicePixelRatio: q.devicePixelRatio,
				maxLoessRegion: q.maxLoessRegion,
				colors: q.colors
			}

			const time1 = Date.now()
			const result = useR
				? JSON.parse(await run_R('dmrcate_full.R', JSON.stringify(dmrInput)))
				: JSON.parse(await run_rust('dmrcate', JSON.stringify(dmrInput)))
			mayLog(`DMR analysis (${useR ? 'R' : 'Rust'}) time:`, formatElapsedTime(Date.now() - time1))
			if (result.error) throw new Error(result.error)

			// Debug: log per-probe stats for R vs Rust comparison. Will remove once confident in Rust implementation.
			if (result.diagnostic?.probes) {
				const p = result.diagnostic.probes
				mayLog(
					`${useR ? 'R' : 'Rust'} probes logFC:`,
					p.logFC,
					'fdr:',
					p.fdr?.map((f: number) => f.toExponential(4))
				)
			}

			res.send({
				status: 'ok',
				dmrs: result.dmrs,
				diagnostic: result.diagnostic
			} as TermdbDmrSuccessResponse)
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e)
			res.send({ error: msg })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}
