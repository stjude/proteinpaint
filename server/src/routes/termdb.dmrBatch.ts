import type { RoutePayload, RouteApi, TermdbDmrBatchRequest, TermdbDmrBatchSuccessResponse } from '#types'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import { invalidcoord } from '#shared/common.js'
import { mayLog } from '#src/helpers.ts'
import { formatElapsedTime, sampleLimitAlert } from '#shared'
import { chrSeed } from '#src/utils/dmrStats.ts'
import {
	resolveMethylationMatrix,
	requireCpgShards,
	resolveGroupNames,
	eligibleMethylationSamples,
	validateChromosomes,
	admitDmrcateRun
} from '#src/utils/methylationMatrix.ts'
import {
	resolveExcludeBeds,
	loadMaskIntervals,
	maskedFraction,
	DM_DEFAULT_BLACKLISTS,
	DEFAULT_OVERLAP_FRAC
} from '#src/utils/regionMask.ts'
import { buildGeneIndex, genesAt, genesInBody, MAX_GENES_PER_DMR } from '#src/utils/dmrGenes.ts'
import {
	buildExclusion,
	sampleBackground,
	scoreAgainstBackground,
	BG_WINDOWS_PER_CHR
} from '#src/utils/dmrBackground.ts'
import { cacheOrRecompute } from '#src/utils/cacheOrRecompute.ts'
import { sampleFilterScope, resolveGroupPair } from '#src/utils/sampleGroups.ts'
import fs from 'fs'
import { genomes } from '#src/initGenomesDs.js'
import { hasDnaMethylationDs } from './termdb.diffMeth.ts'

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
	// only set up when at least one ds has ds.queries.dnaMethylation, see termdb.diffMeth.ts
	get init() {
		return hasDnaMethylationDs(genomes) ? init : null
	},
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
/* Bin width for the genome-wide methylation profile. 100 kb because that is the width the field
plots this metric at: Zhou 2018 (Nat Genet 50:591) bins the genome at 100 kb, "so that the segments
would contain a sufficient number of solo-WCGWs to give reliable methylation averages, without
losing resolution to detect the majority of PMD positions, which fall within PMDs of 500 kb or
greater". Fixed rather than derived from the genome, so a profile means the same thing on every
cohort and can be read against a published one. */
export const METHYLATION_BIN_BP = 100_000

/** Smoothing bandwidth for an element matrix, whose rows sit ~10 kb apart: the client's element-scale
 * default (client/plots/dmr/settings/defaults.ts). The rust default of 1 kb is the CpG scale. */
const ELEMENT_SCALE_LAMBDA = 50_000

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
	/* Bounded and deduplicated before anything is built from the list: a scan request skips the
	per-region cap, so this is the only thing standing between an arbitrarily long list of repeated
	names and one rust fit per entry. Shared with every other route taking a chromosome list. */
	return validateChromosomes(genome, chromosomes).map(c => ({
		chr: c,
		start: 0,
		stop: genome.chrlookup[c.toUpperCase()].len
	}))
}

/** Bump when a change to this route or to dmrcate alters results for an unchanged request.
 * Without it, a cache written before the change keeps serving the old answer forever. */
// 2: background correction added; v1 entries were written before dmrcate emitted background
// windows for a regions-less call, so they hold an empty correction
// 3: DMRs now carry inGeneBody
// 5: members in the key; DMRs carry bodyGenes; background p tail follows the excess direction
// 6: results record the genome and dslabel they belong to, which dmrGeneLink requires
// 8: one DMRcate run across the chromosomes, aligned with upstream; constants for the region view
// 9: masked DMRs kept per window, with the sources that masked them, for the region view
// 10: a DMR's direction is the sign of its delta-beta, not of DMRcate's logit-scale meandiff;
// global methylation carries each group's mean read depth
const CACHE_VERSION = 10

/* Fingerprint the data files a result was computed from.
 *
 * A cache keyed only on the request silently serves stale answers the moment a matrix is rebuilt,
 * which is exactly how the topve cache went wrong. Keying on size+mtime means rebuilding a CpG
 * shard, swapping a blacklist BED or updating the gene database invalidates only what actually
 * depended on it. A missing file contributes a null rather than throwing: the compute below will
 * report the real error, and it must not be masked by one raised while building a cache key. */
export function fingerprint(files: string[]) {
	return files
		.filter(Boolean)
		.sort()
		.map(f => {
			try {
				const st = fs.statSync(f)
				return { f, size: st.size, mtimeMs: st.mtimeMs }
			} catch {
				return { f, size: null, mtimeMs: null }
			}
		})
}

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		try {
			const { payload } = await runDmrBatch(req.query, genomes)
			res.send(payload)
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e)
			res.send({ error: msg })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}

/** Run (or serve from cache) one batch or scan request. Exported so the differential-methylation
 * volcano can present a scan as an element class: it calls this, maps the DMRs to rows and hands
 * them to the same renderer every other class goes through. */
export async function runDmrBatch(
	q: TermdbDmrBatchRequest,
	genomes: any
): Promise<{ payload: TermdbDmrBatchSuccessResponse; cacheId: string }> {
	const genome = genomes[q.genome]
	if (!genome) throw 'unknown genome'
	const ds = genome.datasets?.[q.dslabel]
	if (!ds) throw 'unknown ds'

	/* Two ways to ask: a list of windows (drill a hit list), or a list of chromosomes to scan
	end to end (find DMRs without deciding in advance where to look). Either way the run is DMRcate
	over every CpG of the chromosomes named -- its prior and corrections span the run -- and the
	windows only choose which of its DMRs are reported. */
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
	// a group may be defined by a filter
	const [list1, list2] = await resolveGroupPair(q, ds)
	if (!Array.isArray(list1) || list1.length == 0)
		throw new Error('Group 1 has no samples. Please select at least one sample.')
	if (!Array.isArray(list2) || list2.length == 0)
		throw new Error('Group 2 has no samples. Please select at least one sample.')
	for (const r of regions) {
		if (invalidcoord(genome, r.chr, r.start, r.stop))
			throw new Error(`Invalid genomic coordinates: ${r.chr}:${r.start}-${r.stop}`)
		/* The size cap guards against an unbounded drill-down request. A scan region is a whole
		chromosome by construction, so the cap would reject every one of them -- and the cost it
		exists to bound is paid per chromosome either way, since the run reads every CpG of a
		chromosome regardless of how much of it is asked about. */
		if (!scanning && r.stop - r.start > SERVER_MAX_REGION_BP)
			throw new Error(`Region too large: ${r.chr}:${r.start}-${r.stop}`)
	}

	/* Artifact-region mask. Applied AFTER the fit, to the called DMRs, rather than by dropping
	probes first: DMRcate's prior and FDR corrections are better for having seen every CpG, and a
	DMR is the thing a reader acts on. Names default to the
	methylation subset, not to every declared source -- see DM_DEFAULT_BLACKLISTS. */
	const maskNames = q.excludeOptions?.blacklists ?? DM_DEFAULT_BLACKLISTS
	const maskFiles = resolveExcludeBeds(genome, maskNames)
	// the same sources by name, to say which masked a DMR
	const maskSources = ((genome.blacklists || []) as { name: string; file: string }[]).filter(b =>
		maskNames.includes(b.name)
	)
	/* Report what was applied, not what was asked for. A source is dropped at genome init when
	its BED is unreadable, and a deployment missing one must not be told it was masked. */
	const appliedNames = maskNames.filter(n =>
		(genome.blacklists as { name: string }[] | undefined)?.some(b => b.name == n)
	)
	const rawFrac = Number(q.excludeOptions?.overlapFrac)
	const overlapFrac = Number.isFinite(rawFrac) ? Math.min(Math.max(rawFrac, 0), 1) : DEFAULT_OVERLAP_FRAC
	let dmrsDropped = 0
	const bgTotals = { windows: 0, scored: 0, unscored: 0, significant: 0 }

	/* Built once for the request, not once per DMR: a genome scan calls >100,000 of them and
	one sqlite round trip each would cost more than the model fits. Absent on a genome with no
	gene2coord table, in which case the column is simply omitted. */
	const geneIdx = buildGeneIndex(genome)

	const merged = mergeWindows(regions)
	/* Refuses a chromosome with no CpG shard rather than fitting it on the element matrix; in debugmode
	it is skipped instead. Before the cache key and the fan-out, so neither can be built from it. */
	const kept = new Set(requireCpgShards(ds, [...merged.keys()], 'dmrBatch'))
	for (const chr of [...merged.keys()]) if (!kept.has(chr)) merged.delete(chr)
	const chrEntriesAll = [...merged.entries()]
	type ChrEntry = (typeof chrEntriesAll)[0]

	/* Matrix resolution is hoisted out of the worker pool so the cache key can name the exact
	files the answer depends on. It stays per chromosome because the backing can differ per
	chromosome: a cohort part-way through building its CpG shards serves those where they
	exist and falls back to the element matrix elsewhere. */
	const resolved = new Map<string, ReturnType<typeof resolveMethylationMatrix>>()
	for (const [chr] of chrEntriesAll) resolved.set(chr, resolveMethylationMatrix(ds, chr, q.element_type))

	/* Everything whose identity changes the answer, and nothing that does not. Sample ids are
	sorted so that two callers naming the same cohort in a different order share a cache entry;
	the merged windows rather than the raw request, so two hit lists that collapse to the same
	windows also share one. */
	/* One DMRcate run over every chromosome asked about, so its genome-wide steps are genome-wide;
	see rust/src/dmrcate.rs. requireCpgShards above leaves either CpG shards throughout or, on a
	dataset with no CpG matrix, the element matrix throughout -- never a mix in one run. */
	const files = new Map<string, string[]>()
	for (const [chr] of chrEntriesAll) {
		const f = resolved.get(chr)!.matrixFile
		files.set(f, [...(files.get(f) || []), chr])
	}
	const first = chrEntriesAll[0] && resolved.get(chrEntriesAll[0][0])
	if (!first) throw new Error('No chromosome to analyze.')
	/* The parameters in effect, defaults filled in, so a caller naming a default (the region view)
	and one leaving it out (the scan) share one cached run. An element matrix's rows sit ~10 kb apart
	against a CpG's ~100 bp, so the CpG-scale kernel would smooth nothing there: its default is the
	client's 50 kb (client/plots/dmr/settings/defaults.ts). */
	const lambda = q.lambda ?? (first.useElement ? ELEMENT_SCALE_LAMBDA : 1000)
	const C = q.C ?? 2
	const fdr_cutoff = q.fdr_cutoff ?? 0.05

	const cacheKey = {
		v: CACHE_VERSION,
		genome: q.genome,
		dslabel: q.dslabel,
		group1: list1.map(x => x.sampleId).sort(),
		group2: list2.map(x => x.sampleId).sort(),
		/* members included: the cached payload returns them, and two requests that merge to the same
		windows from different region lists ([100,200]+[150,300] against [100,300]) need different
		mappings back to their own inputs. */
		windows: [...merged.entries()].map(([chr, ws]) => [chr, ws.map(w => [w.start, w.stop, w.members])]).sort(),
		binBp: q.binMethylation ? METHYLATION_BIN_BP : 0,
		lambda,
		C,
		fdr_cutoff,
		element_type: q.element_type ?? null,
		mask: { sources: [...appliedNames].sort(), overlapFrac },
		background: !!q.backgroundCorrection,
		files: fingerprint([...[...resolved.values()].map(r => r.matrixFile), ...maskFiles, genome?.genedb?.dbfile])
	}

	const time1 = Date.now()
	/* Cached because a scan is ~40s of fresh compute with nothing reused: the same contrast
	re-run, or a second person running it, would otherwise pay in full again. The identical
	request arriving twice concurrently is deduplicated to one compute by cacheOrRecompute,
	so a demo and a colleague clicking along cost one scan, not two. */
	const scope = sampleFilterScope(q, ds)
	const { result: payload, cacheId } = await cacheOrRecompute<typeof cacheKey, TermdbDmrBatchSuccessResponse>({
		computeArgument: cacheKey,
		cacheScope: scope,
		cacheSubdir: 'dmr',
		computeFresh: async () => {
			const out: TermdbDmrBatchSuccessResponse['regions'] = []
			/* One cohort for the whole run, resolved once, so every chromosome compares the same
			samples and the matched cohort handed to the expression follow-ups is that one. */
			const { group1, group2 } = await resolveGroupNames(
				list1,
				list2,
				eligibleMethylationSamples(ds, q.element_type),
				ds,
				q.__protected__
			)
			if (group1.length < 3 || group2.length < 3)
				throw new Error(
					`Each group needs at least 3 samples with methylation data (got ${group1.length} and ${group2.length}).`
				)
			// the limit that the differential methylation pre-analysis reports, on the same samples with data
			const limitAlert = sampleLimitAlert(group1.length + group2.length, ds.cohort?.termdb?.uiLabels?.samples)
			if (limitAlert) throw new Error(limitAlert)
			const nodeRss0 = process.memoryUsage().rss
			const nodeCpu0 = process.cpuUsage()
			const perChromosome: NonNullable<TermdbDmrBatchSuccessResponse['resources']>['perChromosome'] = []
			const account = (label: string, d: any) => {
				if (!d) return
				perChromosome.push({
					chr: label,
					probes: d.total_probes_analyzed || 0,
					peakMemoryMb: Number(d.peak_memory_mb) || 0,
					cpuSeconds: Number(d.cpu_seconds) || 0,
					elapsedMs: Number(d.elapsed_ms) || 0
				})
			}
			const input = {
				matrices: [...files].map(([file, chrs]) => ({ file, chrs })),
				mvalues: first.mvalues,
				case: group2.join(','),
				control: group1.join(','),
				fdr_cutoff,
				lambda,
				C
			}
			const releaseMemory = await admitDmrcateRun(
				`DMR ${scanning ? 'scan' : 'batch'}`,
				[...files.keys()],
				'Server memory is too low to run this DMR scan right now. Try again later, or scan one chromosome.'
			)
			let result: any
			try {
				result = JSON.parse(
					await run_rust(
						'dmrcate',
						JSON.stringify({
							...input,
							windows: chrEntriesAll.flatMap(([chr, ws]) => ws.map(w => ({ chr, start: w.start, stop: w.stop }))),
							bin_bp: q.binMethylation ? METHYLATION_BIN_BP : 0
						})
					)
				)
				if (result.error) throw new Error(result.error)
				account([...files.values()].flat().join(','), result.diagnostic)

				/* Per chromosome from here: the windows come back in input order, so each chromosome's
				slice is its own. */
				const perChr: { chr: string; windows: ChrEntry[1]; regions: any[]; called: any[] }[] = []
				let offset = 0
				for (const [chr, windows] of chrEntriesAll) {
					const regions = (result.regions || []).slice(offset, offset + windows.length)
					offset += windows.length
					/* The artifact mask filters DMRs after the run, as upstream's betacutoff filters after
					its region-wise corrections. */
					if (maskFiles.length) {
						const chrLen = genome.chrlookup?.[chr.toUpperCase()]?.len
						if (chrLen) {
							const mask = await loadMaskIntervals(maskFiles, chr, chrLen)
							if (mask.length) {
								/* The dropped DMRs stay on the window, named by the sources that cover them: the
								region view draws them as masked, where its per-CpG track would otherwise show
								significant CpGs under an empty DMR track with nothing to say why. */
								let bySource: { name: string; mask: Awaited<ReturnType<typeof loadMaskIntervals>> }[] | undefined
								for (const r of regions) {
									if (!r?.dmrs?.length) continue
									const kept: any[] = []
									const masked: any[] = []
									for (const d of r.dmrs) (maskedFraction(mask, d.start, d.stop) < overlapFrac ? kept : masked).push(d)
									if (!masked.length) continue
									bySource ??= await Promise.all(
										maskSources.map(async b => ({ name: b.name, mask: await loadMaskIntervals([b.file], chr, chrLen) }))
									)
									dmrsDropped += masked.length
									r.dmrs = kept
									r.masked = masked.map(d => ({
										...d,
										maskedBy: bySource!.filter(s => maskedFraction(s.mask, d.start, d.stop) > 0).map(s => s.name)
									}))
								}
							}
						}
					}
					/* Name the regions. A scan returns coordinates; the element volcano returns "XIST",
					and that word is the difference between a row a reader can act on and one they
					have to look up. */
					if (geneIdx) {
						for (const r of regions) {
							for (const d of r?.dmrs || []) {
								const g = genesAt(geneIdx, chr, d.start, d.stop)
								/* Body overlap is tracked separately from gene membership: promoter and
								gene-body methylation relate to transcription in opposite directions, so a
								downstream test about gene bodies must be able to exclude a region that only
								clips a promoter -- on MMRF that would enlarge the set by 17%. */
								const body = genesInBody(geneIdx, chr, d.start, d.stop)
								if (body.length) {
									d.inGeneBody = true
									/* Uncapped and body-specific: the gene-body loss set is built from this, not
									from `genes`, which also holds promoter-only neighbours and is capped. */
									d.bodyGenes = body
								}
								if (!g.length) continue
								d.genes = g.slice(0, MAX_GENES_PER_DMR)
								if (g.length > MAX_GENES_PER_DMR) d.genesTruncated = g.length
							}
						}
					}
					perChr.push({ chr, windows, regions, called: regions.flatMap((r: any) => r?.dmrs || []) })
				}
				/* Matched intergenic background, sampled per chromosome and scored per chromosome. A second
				run, because the windows are matched to the widths of the DMRs the first one called; it
				reads only each window's delta-beta, with no model. */
				if (q.backgroundCorrection) {
					const draws: { called: any[]; windows: any[] }[] = []
					for (const { chr, called } of perChr) {
						const chrLen = genome.chrlookup?.[chr.toUpperCase()]?.len
						const excl = chrLen ? await buildExclusion(genome, chr, chrLen, geneIdx as any) : null
						if (!excl || !chrLen || !called.length) continue
						const windows = sampleBackground(
							chr,
							chrLen,
							excl,
							called.map((d: any) => d.stop - d.start),
							BG_WINDOWS_PER_CHR,
							// seeded from the chromosome name so the draw is reproducible and cacheable
							chrSeed(chr)
						)
						if (windows.length) draws.push({ called, windows })
					}
					if (draws.length) {
						const bgRes = JSON.parse(
							await run_rust('dmrcate', JSON.stringify({ ...input, background_regions: draws.flatMap(d => d.windows) }))
						)
						if (bgRes.error) throw new Error(bgRes.error)
						account('background', bgRes.diagnostic)
						let bgOffset = 0
						for (const { called, windows } of draws) {
							const background = (bgRes.background || []).slice(bgOffset, bgOffset + windows.length)
							bgOffset += windows.length
							const { scored, unscored } = scoreAgainstBackground(called, background)
							called.forEach((d: any, i: number) => {
								const sc = scored[i]
								if (!sc) return
								d.excess = Math.round(sc.excess * 100000) / 100000
								d.bgP = sc.p
							})
							bgTotals.windows += background.length
							bgTotals.scored += scored.filter(Boolean).length
							bgTotals.unscored += unscored
							bgTotals.significant += scored.filter(s2 => s2 && s2.p < 0.05).length
						}
					}
				}
				for (const { chr, windows, regions } of perChr) {
					for (let i = 0; i < windows.length; i++) {
						const r = regions[i]
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
							...(r.masked ? { masked: r.masked } : {}),
							elementResolution: first.useElement
						})
					}
				}
			} finally {
				releaseMemory()
			}

			/* Restore the caller's region order: byte-identical output for identical requests, and
			request order for any caller that assumes it. */
			out.sort((a, b) => Math.min(...a.members) - Math.min(...b.members))
			mayLog(
				`DMR ${scanning ? 'scan' : 'batch'} computed: ${regions.length} regions -> ${out.length} windows over ${
					merged.size
				} chromosomes,`,
				formatElapsedTime(Date.now() - time1)
			)
			const nodeCpu = process.cpuUsage(nodeCpu0)
			const resources: TermdbDmrBatchSuccessResponse['resources'] = {
				workers: 1,
				threadsPerWorker: Number(result.diagnostic?.threads) || 1,
				wallMs: Date.now() - time1,
				peakWorkerMemoryMb: Math.max(0, ...perChromosome.map(r => r.peakMemoryMb)),
				peakPoolMemoryMb: Math.max(0, ...perChromosome.map(r => r.peakMemoryMb)),
				workerCpuSeconds: perChromosome.reduce((a, r) => a + r.cpuSeconds, 0),
				nodeRssDeltaMb: Math.max(0, process.memoryUsage().rss - nodeRss0) / 1048576,
				nodeCpuSeconds: (nodeCpu.user + nodeCpu.system) / 1e6,
				perChromosome
			}
			const gm = result.diagnostic?.global_methylation
			return {
				status: 'ok',
				// which dataset and cacheScope this result belongs to, so a consumer holding only a cacheId can check it
				genome: q.genome,
				dslabel: q.dslabel,
				scope,
				regions: out,
				chromosomes: merged.size,
				totalProbesAnalyzed: result.diagnostic?.total_probes_analyzed || 0,
				/* What a region view needs to recompute any region of this run exactly as the run saw it
				(termdb/dmr). Along with the parameters, which a region view must match. */
				constants: { ...result.constants, lambda, C, fdr_cutoff },
				resources,
				binMethylation: q.binMethylation
					? { binBp: METHYLATION_BIN_BP, bins: result.bin_methylation || [] }
					: undefined,
				regionMask: maskFiles.length ? { sources: appliedNames, overlapFrac, dmrsDropped } : undefined,
				backgroundCorrection: q.backgroundCorrection ? { ...bgTotals, matchedOn: ['CpG density', 'width'] } : undefined,
				globalMethylation:
					gm && Number.isFinite(gm.control_mean_beta) && Number.isFinite(gm.case_mean_beta)
						? {
								controlMeanBeta: gm.control_mean_beta,
								caseMeanBeta: gm.case_mean_beta,
								shift: gm.shift,
								valuesCounted: gm.values_counted,
								...(Number.isFinite(gm.control_mean_depth) ? { controlMeanDepth: gm.control_mean_depth } : {}),
								...(Number.isFinite(gm.case_mean_depth) ? { caseMeanDepth: gm.case_mean_depth } : {})
						  }
						: undefined
			} as TermdbDmrBatchSuccessResponse
		}
	})
	mayLog(`DMR ${scanning ? 'scan' : 'batch'} served ${cacheId} in`, formatElapsedTime(Date.now() - time1))
	return { payload, cacheId }
}
