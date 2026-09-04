import type { RoutePayload, RouteApi, TermdbDmrBatchRequest, TermdbDmrBatchSuccessResponse } from '#types'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import { invalidcoord } from '#shared/common.js'
import { mayLog } from '#src/helpers.ts'
import serverconfig from '#src/serverconfig.js'
import { formatElapsedTime } from '#shared'
import { resolveMethylationMatrix, resolveGroupNames } from '#src/utils/methylationMatrix.ts'
import {
	resolveExcludeBeds,
	loadMaskIntervals,
	maskedFraction,
	DM_DEFAULT_BLACKLISTS,
	DEFAULT_OVERLAP_FRAC
} from '#src/utils/regionMask.ts'

/* Call DMRs across many regions at once — the whole hit list of a differential methylation run,
rather than one clicked element at a time.

Why this is a route and not a client loop: dmrcate fits eBayes and applies the BH correction over
the WHOLE matrix before subsetting to a region, so that cost is identical for every region drawn
from the same matrix. Grouping regions by chromosome and invoking once per shard pays it once per
chromosome instead of once per region. Measured on 55 windows from one MMRF shard: 285.7s
one-at-a-time against 5.3s batched, with identical DMR calls for all 55.

The consequence is that cost scales with CHROMOSOMES, not regions, so drilling an entire 17,000-row
hit list costs barely more than drilling the top 400. */

export const payload: RoutePayload = {
	init,
	request: { typeId: 'TermdbDmrBatchRequest' },
	response: { typeId: 'TermdbDmrBatchResponse' }
}

export const api: RouteApi = {
	endpoint: 'termdb/dmrBatch',
	methods: {
		get: payload,
		post: payload
	}
}

/** Guards a request that would pin a core for an unbounded time. Regions are cheap individually;
 * it is the count that has to be bounded, and 25k is well past any real hit list. */
const MAX_REGIONS = 25_000
/** Per region, the same hard cap the single-region route applies. */
const SERVER_MAX_REGION_BP = 10_000_000

/* Overlapping windows are the norm, not the exception: neighbouring elements from one hit list
routinely sit a few hundred bp apart and belong to the SAME underlying DMR. Drilling both calls
that DMR twice, and any width distribution built from the output then counts it twice. Merging
first also cuts the work. Each merged window records which inputs it came from, so a caller can
still map a DMR back to the elements that asked for it. */
export function mergeWindows(regions: { chr: string; start: number; stop: number }[]) {
	const byChr = new Map<string, { start: number; stop: number; members: number[] }[]>()
	const order = regions.map((r, i) => ({ ...r, i })).sort((a, b) => a.chr.localeCompare(b.chr) || a.start - b.start)
	for (const r of order) {
		const lst = byChr.get(r.chr) || []
		const last = lst[lst.length - 1]
		if (last && r.start <= last.stop) {
			last.stop = Math.max(last.stop, r.stop)
			last.members.push(r.i)
		} else {
			lst.push({ start: r.start, stop: r.stop, members: [r.i] })
		}
		byChr.set(r.chr, lst)
	}
	return byChr
}

/* Turn a list of chromosome names into whole-chromosome regions.
 *
 * Names are resolved through the genome's own lookup rather than trusted, so casing and aliases
 * behave the same as everywhere else in the app and an unknown name fails with a message naming
 * the chromosome instead of silently scanning nothing. The stop is the chromosome's full length:
 * a scan deliberately has no window, which is the whole point of the mode. */
export function buildScanRegions(genome: any, chromosomes: string[]) {
	return chromosomes.map(c => {
		const info = genome.chrlookup?.[String(c).toUpperCase()]
		if (!info) throw new Error(`Unknown chromosome '${c}' for genome ${genome.name || ''}.`.replace(' .', '.'))
		return { chr: info.name, start: 0, stop: info.len }
	})
}

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		try {
			const q: TermdbDmrBatchRequest = req.query
			const genome = genomes[q.genome]
			if (!genome) throw 'unknown genome'
			const ds = genome.datasets?.[q.dslabel]
			if (!ds) throw 'unknown ds'

			/* Two ways to ask: a list of windows (drill a hit list), or a list of chromosomes to scan
			end to end (find DMRs without deciding in advance where to look). The scan is affordable
			because the fit is already chromosome-wide and the smoothing is linear in CpGs, so the
			extra cost over drilling a few windows on that chromosome is small. */
			const scanning = Array.isArray(q.scanChromosomes) && q.scanChromosomes.length > 0
			let regions: { chr: string; start: number; stop: number }[]
			if (scanning) {
				regions = buildScanRegions(genome, q.scanChromosomes!)
			} else {
				if (!Array.isArray(q.regions) || !q.regions.length) throw new Error('No regions requested.')
				if (q.regions.length > MAX_REGIONS)
					throw new Error(`Too many regions (${q.regions.length}). Maximum is ${MAX_REGIONS}.`)
				regions = q.regions
			}
			if (!Array.isArray(q.group1) || q.group1.length == 0)
				throw new Error('Group 1 has no samples. Please select at least one sample.')
			if (!Array.isArray(q.group2) || q.group2.length == 0)
				throw new Error('Group 2 has no samples. Please select at least one sample.')
			for (const r of regions) {
				if (invalidcoord(genome, r.chr, r.start, r.stop))
					throw new Error(`Invalid genomic coordinates: ${r.chr}:${r.start}-${r.stop}`)
				/* The size cap guards against an unbounded drill-down request. A scan region is a whole
				chromosome by construction, so the cap would reject every one of them -- and the cost it
				exists to bound is paid per chromosome either way, since the model fit is chromosome-wide
				regardless of how much of it is asked about. */
				if (!scanning && r.stop - r.start > SERVER_MAX_REGION_BP)
					throw new Error(`Region too large: ${r.chr}:${r.start}-${r.stop}`)
			}

			/* Artifact-region mask. Applied AFTER the fit, to the called DMRs, rather than by dropping
			probes first: the fit is chromosome-wide and its variance and FDR estimates are better for
			having seen every probe, and a DMR is the thing a reader acts on. Names default to the
			methylation subset, not to every declared source -- see DM_DEFAULT_BLACKLISTS. */
			const maskNames = q.excludeOptions?.blacklists ?? DM_DEFAULT_BLACKLISTS
			const maskFiles = resolveExcludeBeds(genome, maskNames)
			/* Report what was applied, not what was asked for. A source is dropped at genome init when
			its BED is unreadable, and a deployment missing one must not be told it was masked. */
			const appliedNames = maskNames.filter(n =>
				(genome.blacklists as { name: string }[] | undefined)?.some(b => b.name == n)
			)
			const rawFrac = Number(q.excludeOptions?.overlapFrac)
			const overlapFrac = Number.isFinite(rawFrac) ? Math.min(Math.max(rawFrac, 0), 1) : DEFAULT_OVERLAP_FRAC
			let dmrsDropped = 0

			const merged = mergeWindows(regions)
			const time1 = Date.now()
			const out: TermdbDmrBatchSuccessResponse['regions'] = []
			let totalProbes = 0
			/* Global methylation is accumulated per chromosome and pooled here weighted by how many
			values each contributed, so the result is a genuine cohort-wide mean rather than an
			average of chromosome averages (which would over-weight the small chromosomes). */
			let gCtrl = 0
			let gCase = 0
			let gN = 0

			/* One rust invocation per chromosome, a couple at a time. Each holds one chromosome's matrix
			(~400MB on the MMRF shards) and saturates a single core, so the work parallelises cleanly
			across chromosomes; running them strictly sequentially left every other core idle and made
			the request as slow as the sum of its parts.

			Default 2, NOT derived from the machine's core count. os.availableParallelism() and
			os.cpus() report the HOST's cores, not a container's CPU quota, so on a 4-core-limited
			container sitting on a large host they would happily return 32 and oversubscribe it. Two
			also leaves headroom on a 4-core deployment: this route must not starve every other request
			on the server while it runs. Raise it per deployment via serverconfig where the cores and
			the ~400MB-per-job memory are actually known. */
			const CONCURRENCY = Math.max(1, Number(serverconfig.dmrBatchConcurrency) || 2)
			const chrEntries = [...merged.entries()]
			/* Biggest chromosomes first. With a fixed pool the tail is set by the slowest job still
			running, so starting chr1 last would leave it running alone after everything else finished. */
			chrEntries.sort((a, b) => b[1].length - a[1].length)
			const results: { chr: string; windows: (typeof chrEntries)[0][1]; result: any; useElement: boolean }[] = []
			let next = 0
			await Promise.all(
				Array.from({ length: Math.min(CONCURRENCY, chrEntries.length) }, async () => {
					while (true) {
						const i = next++
						if (i >= chrEntries.length) return
						const [chr, windows] = chrEntries[i]
						/* Resolved per chromosome, because the backing can differ per chromosome: a cohort
						part-way through building its CpG shards serves those where they exist and falls
						back to the element matrix elsewhere. */
						const { matrixFile, mvalues, useElement, eligible } = resolveMethylationMatrix(ds, chr, q.element_type)
						const { group1, group2 } = await resolveGroupNames(q.group1, q.group2, eligible, ds)
						if (group1.length < 3 || group2.length < 3)
							throw new Error(
								`Each group needs at least 3 samples with methylation data (got ${group1.length} and ${group2.length}).`
							)
						const input = {
							probe_h5_file: matrixFile,
							mvalues,
							cachedir: serverconfig.cachedir,
							genome: q.genome,
							chr,
							start: 0,
							stop: 0,
							regions: windows.map(w => ({ chr, start: w.start, stop: w.stop })),
							case: group2.join(','),
							control: group1.join(','),
							fdr_cutoff: q.fdr_cutoff,
							lambda: q.lambda,
							C: q.C
						}
						const result = JSON.parse(await run_rust('dmrcate', JSON.stringify(input)))
						if (result.error) throw new Error(`${chr}: ${result.error}`)
						/* Masked here rather than in the assembly loop below so each chromosome's BED
						query runs inside its own worker slot, alongside the fit it belongs to, instead
						of serially after every fit has finished. */
						if (maskFiles.length) {
							const chrLen = genome.chrlookup?.[chr.toUpperCase()]?.len
							if (chrLen) {
								const mask = await loadMaskIntervals(maskFiles, chr, chrLen)
								if (mask.length) {
									for (const r of result.regions || []) {
										if (!r?.dmrs?.length) continue
										const kept = r.dmrs.filter((d: any) => maskedFraction(mask, d.start, d.stop) < overlapFrac)
										dmrsDropped += r.dmrs.length - kept.length
										r.dmrs = kept
									}
								}
							}
						}
						results.push({ chr, windows, result, useElement })
					}
				})
			)
			/* Restore the caller's region order. A worker pool finishes in whatever order jobs land, so
			without this the response ordering varies run to run for byte-identical results -- which
			makes two runs impossible to diff and quietly breaks any caller that assumes request order.
			Sorting by smallest member index puts windows back in the order the regions arrived. */
			results.sort((a, b) => Math.min(...a.windows[0].members) - Math.min(...b.windows[0].members))
			for (const { chr, windows, result, useElement } of results) {
				totalProbes += result.diagnostic?.total_probes_analyzed || 0
				const gm = result.diagnostic?.global_methylation
				if (gm && Number.isFinite(gm.control_mean_beta) && Number.isFinite(gm.case_mean_beta) && gm.values_counted) {
					// halved because values_counted pools both arms; each mean covers its own half
					const w = gm.values_counted / 2
					gCtrl += gm.control_mean_beta * w
					gCase += gm.case_mean_beta * w
					gN += w
				}
				for (let i = 0; i < windows.length; i++) {
					const r = result.regions?.[i]
					if (!r) continue
					out.push({
						chr,
						start: windows[i].start,
						stop: windows[i].stop,
						// which of the caller's regions merged into this window
						members: windows[i].members,
						n_probes: r.n_probes,
						n_sig_probes: r.n_sig_probes,
						dmrs: r.dmrs,
						elementResolution: useElement
					})
				}
			}

			mayLog(
				`DMR ${scanning ? 'scan' : 'batch'}: ${regions.length} regions -> ${out.length} windows over ${
					merged.size
				} chromosomes,`,
				formatElapsedTime(Date.now() - time1)
			)
			res.send({
				status: 'ok',
				regions: out,
				chromosomes: merged.size,
				totalProbesAnalyzed: totalProbes,
				regionMask: maskFiles.length ? { sources: appliedNames, overlapFrac, dmrsDropped } : undefined,
				globalMethylation: gN
					? {
							controlMeanBeta: gCtrl / gN,
							caseMeanBeta: gCase / gN,
							shift: (gCase - gCtrl) / gN,
							valuesCounted: gN * 2
					  }
					: undefined
			} as TermdbDmrBatchSuccessResponse)
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e)
			res.send({ error: msg })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}
