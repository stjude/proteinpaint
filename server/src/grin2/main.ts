import type { GRIN2Request, GRIN2Response } from '#types'
import serverconfig from '../serverconfig.js'
import path from 'path'
import { run_python } from '@sjcrh/proteinpaint-python'
import { renderManhattan } from '../renderManhattan.ts'
import { mayLog } from '../helpers.ts'
import { get_samples } from '../termdb.sql.js'
import { dtsnvindel, dtcnv, dtfusionrna, dtsv, dtitd, dt2lesion, optionToDt, formatElapsedTime } from '#shared'
import { cacheOrRecompute } from '../utils/cacheOrRecompute.ts'
import { mapConcurrent } from '../utils/concurrencyLimiter.ts'
import { getMaxLesions } from './memory.ts'
import { processSampleMlst, buildLesionTypeMap } from './lesions.ts'
import type { CnvType, Grin2CacheResult, Grin2Processing, Lesion } from './types.ts'

/**
 * General GRIN2 analysis route
 * Processes user-provided snvindel, CNV, fusion, and sv filters and performs GRIN2 analysis
 *
 * Data Flow:
 * 1. Extract samples via the cohort filter
 * 2. Process and validate file paths for the JSON files:
 *    - Each sample has a JSON file containing mutation data (mlst array)
 *    - Each file is processed to extract lesions in the format:
 *      [ID, chrom, loc.start, loc.end, lsn.type]
 *        - ID: Unique sample ID
 *        - chrom: Chromosome name (e.g., "chr1")
 *        - loc.start: Start position of the lesion
 *        - loc.end: End position of the lesion
 *        - lsn.type: Type of lesion ("mutation", "gain", "loss", "fusion", "sv"). A comprehensive set of lesion types can be found in dt2lesion
 * 3. Read and filter file contents based on snvindelOptions, cnvOptions, fusionOptions, and svOptions:
 *    - SNV/indel: Filter by consequence types and an optional MAF filter. The MAF filter is the refined
 *      replacement for the original minTotalDepth/minAltAlleleCount cutoffs (it covers total depth and
 *      alt-allele count), so those original request fields are superseded and have been removed.
 *    - CNV: Filter by max segment length, then classify each segment as gain/loss according to how the
 *      dataset quantifies cnv values (ds.queries.cnv.type, defaulting to 'log2ratio'):
 *        - 'log2ratio'/'segmean': numeric value, diploid baseline 0 (gain >= gainThreshold, loss <= lossThreshold)
 *        - 'copyNumber': numeric absolute copy number, diploid baseline 2 (e.g. loss <= 1, gain >= 3, neutral = 2)
 *        - 'category': qualitative call carried in the segment's class; thresholds ignored. Gain-like classes
 *          (CNV_amp/CNV_amplification) => gain, loss-like (CNV_loss/CNV_homozygous_deletion) => loss, and
 *          cnvOptions.cnvCategories (UI checkboxes) restricts which classes are included.
 *      See filterAndConvertCnv() and the CnvType type in ./types.ts
 *    - Fusion: No filtering applied; each breakpoint (chrA, and chrB when present) becomes a lesion.
 *    - SV: No filtering applied; same breakpoint-to-lesion conversion as fusion.
 *    - Hypermutator: To be implemented at later date
 * 4. Convert filtered data to lesion format and apply overall lesion cap
 * 5. Pass lesion data and maxGenesToShow to Python for GRIN2 statistical analysis and then pass device pixel ratio, width, and height to Rust for plot generation
 * 6. Return Manhattan plot from renderManhattan() as base64 string, top gene table, timing information, statistically significant results that are displayed as an interactive svg, and cache file name for future use
 */

/*
 * Cache flow (uniform across cacheOrRecompute consumers):
 *   init  →  xKeyInputs  →  getXCacheResult  →  cacheOrRecompute  →  runXFresh
 *   GRIN2 follows this with a trailing run_rust plot step in runGrin2.
 *
 * Within this file the function order mirrors that flow:
 *   init → runGrin2 → grin2KeyInputs → getGrin2CacheResult →
 *   runGrin2Fresh → helpers
 */

export function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		// __abortSignal is set by maySetAbortCtrl() middleware in app.middlewares.js
		const signal: AbortSignal | undefined = req.query.__abortSignal

		try {
			const request = req.query as GRIN2Request

			// Get genome and dataset from request parameters
			const g = genomes[request.genome]
			if (!g) throw new Error('genome missing')

			const ds = g.datasets?.[request.dslabel]
			if (!ds) throw new Error('ds missing')

			if (typeof ds.queries?.singleSampleMutation?.get != 'function')
				throw new Error('singleSampleMutation query missing from dataset')

			const result = await runGrin2(g, ds, request, signal)
			res.json(result)
		} catch (e: any) {
			if (signal?.aborted) {
				// Client disconnected, no point sending a response
				mayLog('[GRIN2] Analysis aborted due to client disconnect')
				return
			}

			console.error('[GRIN2] Error stack:', e.stack)

			const errorResponse: GRIN2Response = {
				status: 'error',
				error: e.message || String(e),
				code: e.code
			}

			res.status(e.status || 500).send(errorResponse)
		}
	}
}

async function runGrin2(g: any, ds: any, request: GRIN2Request, signal?: AbortSignal): Promise<GRIN2Response> {
	// Build the chromosome list once. It depends only on the genome reference,
	// not the request, so it's safe to compute outside the cache (and Rust
	// needs it for plotting on every request).
	const chromosomelist: { [key: string]: number } = {}
	for (const c in g.majorchr) {
		chromosomelist[c] = g.majorchr[c]
	}

	const {
		result: cacheResult,
		freshCompute,
		cohortTime,
		processingTime,
		grin2AnalysisTime
	} = await getGrin2CacheResult(request, g, ds, chromosomelist, signal)

	const { resultData, processing } = cacheResult

	// Step 5: Render Manhattan PNG. Always re-rendered because rendering
	// depends on view params (width, height, etc.) that aren't in the cache key.
	// `geneHits` is read straight from the cached Python result rather than
	// re-parsed from the cache JSON file (the Rust binary used to do the latter).
	const manhattanPlotStart = Date.now()
	const manhattanPlotData = await renderManhattan({
		geneHits: resultData?.geneHits ?? [],
		chrSizes: chromosomelist,
		plotWidth: request.width!,
		plotHeight: request.height!,
		devicePixelRatio: request.devicePixelRatio ?? 1,
		pngDotRadius: request.pngDotRadius ?? 2,
		qValueThreshold: request.qValueThreshold ?? 0.05,
		maxCappedPoints: request.maxCappedPoints,
		hardCap: request.hardCap,
		binSize: request.binSize,
		lesionTypeColors: request.lesionTypeColors
	})
	const manhattanPlotTime = Date.now() - manhattanPlotStart
	mayLog(`[GRIN2] Manhattan plot generation took ${formatElapsedTime(manhattanPlotTime)}`)

	// Validate render output
	if (!manhattanPlotData?.png) {
		throw new Error('Invalid manhattan render output: missing PNG data')
	}

	const totalTime = cohortTime + processingTime + grin2AnalysisTime + manhattanPlotTime

	// compact stat-row helpers: fracOfTotal formats "N / totalSamples"; optRow yields one row only when
	// count > 0 (spread into the summary); note appends a cap/coverage "Note" row.
	const total = processing.totalSamples!
	const fracOfTotal = (n?: number) => `${(n ?? 0).toLocaleString()} / ${total.toLocaleString()}`
	const optRow = (count: number | undefined, label: string): string[][] => (count ? [[label, fracOfTotal(count)]] : [])
	const capWarningRows: string[][] = []
	const note = (msg: string) => capWarningRows.push(['Note', msg])

	// Build lesion type display rows
	const lesionTypeRows: string[][] = []
	if (processing.lesionCounts?.byType) {
		const typeLabels: Record<string, string> = {}
		Object.values(dt2lesion).forEach(config => {
			config.lesionTypes.forEach(lt => {
				typeLabels[lt.lesionType] = lt.name
			})
		})
		for (const [type, data] of Object.entries(processing.lesionCounts.byType)) {
			const { count, samples } = data as { count: number; samples: number }
			lesionTypeRows.push([typeLabels[type] || type, `${count.toLocaleString()} (${samples.toLocaleString()} samples)`])
		}
	}

	// Build region-mask report rows (artifact-region exclude mask). Only shown
	// when the mask actually ran (resultData.maskReport is non-null).
	const maskReport = resultData?.maskReport
	const maskRows: string[][] = []
	if (maskReport) {
		const examples: string[] = maskReport.dropped_examples || []
		const examplesStr = examples.length > 0 ? examples.join(', ') : 'none'
		maskRows.push(
			['Genes In', Number(maskReport.genes_in ?? 0).toLocaleString()],
			['Genes Excluded', Number(maskReport.genes_dropped ?? 0).toLocaleString()],
			['Examples', examplesStr],
			['Genome Fraction Masked', `${((maskReport.genome_fraction_masked ?? 0) * 100).toFixed(2)}%`],
			['Overlap Threshold', `${maskReport.overlap_frac ?? 0.5}`]
		)
	}

	// Build cap warning if applicable
	const cap = processing.lesionCap?.toLocaleString()
	const expectedToProcess = processing.totalSamples! - processing.failedSamples!
	if (processing.processedSamples! < expectedToProcess) {
		note(
			`Lesion cap of ${cap} was reached before all samples could be processed. ` +
				`Analysis ran on ${processing.processedSamples!.toLocaleString()} of ${expectedToProcess.toLocaleString()} samples.`
		)
	} else if (processing.ssmCapReached) {
		// The batched SNV/indel fetch hit the cap and skipped some samples' mutations, but the per-sample
		// loop still processed every sample — so the check above won't catch it. Warn the same way.
		note(
			`Lesion cap of ${cap} was reached while loading mutations. SNV/indel data was not loaded for ` +
				`${(processing.ssmSamplesDropped ?? 0).toLocaleString()} of ${expectedToProcess.toLocaleString()} samples.`
		)
	}
	// The batched CNV fetch has its own cap (independent of ssm's), so warn separately when it truncated.
	if (processing.cnvCapReached) {
		note(
			`Lesion cap of ${cap} was reached while loading CNV segments. CNV data was not loaded for ` +
				`${(processing.cnvSamplesDropped ?? 0).toLocaleString()} of ${expectedToProcess.toLocaleString()} samples.`
		)
	}

	// Coverage note: samples that contributed no open-access SNV/indel lesions, broken down by reason so the
	// user can see why. Independent of the lesion cap above — both can apply — so it's its own note.
	if (processing.ssmSamplesNoOpenAccess || processing.unmatchedSamples) {
		const reasons: string[] = []
		if (processing.ssmSamplesControlledAccess)
			reasons.push(
				`${processing.ssmSamplesControlledAccess.toLocaleString()} are in controlled-access GDC projects ` +
					`(their mutation data requires a logged-in GDC session with the appropriate authorization)`
			)
		if (processing.ssmSamplesNoMutations)
			reasons.push(`${processing.ssmSamplesNoMutations.toLocaleString()} are open-access but had no SNV/indel mutation`)
		if (processing.unmatchedSamples)
			reasons.push(`${processing.unmatchedSamples.toLocaleString()} could not be matched to a GDC case`)
		const affected = (processing.ssmSamplesNoOpenAccess ?? 0) + (processing.unmatchedSamples ?? 0)
		note(
			`${affected.toLocaleString()} of ${total.toLocaleString()} samples contributed no SNV/indel lesions: ${reasons.join(
				'; '
			)}.`
		)
	}

	// Coverage note: samples dropped from a data type by the hypermutator cutoff (too many raw records for
	// that dt). Per-dt, so a sample can appear under both counts; each is shown with its cutoff.
	if (processing.ssmSamplesHypermutated || processing.cnvSamplesHypermutated) {
		const parts: string[] = []
		if (processing.ssmSamplesHypermutated)
			parts.push(
				`${processing.ssmSamplesHypermutated.toLocaleString()} exceeded the SNV/indel cutoff (${request.snvindelOptions?.hyperMutator?.toLocaleString()})`
			)
		if (processing.cnvSamplesHypermutated)
			parts.push(
				`${processing.cnvSamplesHypermutated.toLocaleString()} exceeded the CNV cutoff (${request.cnvOptions?.hyperMutator?.toLocaleString()})`
			)
		note(`Hypermutated samples excluded from a data type: ${parts.join('; ')}.`)
	}

	const response: GRIN2Response = {
		status: 'success',
		fromCache: !freshCompute,
		pngImg: manhattanPlotData.png,
		plotData: manhattanPlotData.plot_data as any,
		topGeneTable: resultData.topGeneTable,
		stats: {
			lst: [
				{
					name: 'Summary',
					rows: [
						['Total Genes', resultData.totalGenes.toLocaleString()],
						['Total Samples', processing.totalSamples!.toLocaleString()],
						['Processed Samples', processing.processedSamples!.toLocaleString()],
						// unique samples that actually had >=1 qualifying lesion — distinct from the cohort size
						// above, so users don't misread "Processed Samples" as "samples with mutations"
						[
							'Samples with data',
							`${(processing.samplesWithData ?? 0).toLocaleString()} / ${processing.processedSamples!.toLocaleString()}`
						],
						// coverage rows, each shown only when non-zero (batched GDC path): controlled-access (data
						// exists but isn't open) vs genuinely no mutation; queried samples with no cnv segment; and
						// samples that matched no GDC case at all — surfaced so the cohort tallies reconcile.
						...optRow(processing.ssmSamplesControlledAccess, 'Samples in controlled-access projects'),
						...optRow(processing.ssmSamplesNoMutations, 'Open-access samples without mutations'),
						...optRow(processing.cnvSamplesNoData, 'Samples without CNV data'),
						...optRow(processing.unmatchedSamples, 'Unmatched samples (no GDC case)'),
						['Unprocessed Samples', (processing.unprocessedSamples ?? 0).toLocaleString()],
						['Failed Samples', processing.failedSamples!.toLocaleString()],
						['Total Lesions', processing.totalLesions!.toLocaleString()],
						['Processed Lesions', processing.processedLesions!.toLocaleString()]
					]
				},
				{
					name: 'Lesion Counts',
					rows: lesionTypeRows
				},
				...(maskRows.length > 0 ? [{ name: 'Excluded Genes (region mask)', rows: maskRows }] : []),
				{
					name: 'Memory Usage',
					rows: [
						['Start', `${resultData.memory?.start} MB`],
						['After Prep', `${resultData.memory?.after_prep} MB`],
						['After Overlaps', `${resultData.memory?.after_overlaps} MB`],
						['After Counts', `${resultData.memory?.after_counts} MB`],
						['After Stats', `${resultData.memory?.after_stats} MB`],
						['Peak', `${resultData.memory?.peak} MB`]
					]
				},
				{
					name: 'Timing',
					rows: [
						// Sample retrieval is the cohort fetch before processing. For API-backed datasets (GDC)
						// it's a network round-trip; for sqlite it's a fast local query (sub-second).
						['Sample retrieval', freshCompute ? formatElapsedTime(cohortTime) : 'cached'],
						['Processing', freshCompute ? formatElapsedTime(processingTime) : 'cached'],
						['GRIN2', freshCompute ? formatElapsedTime(grin2AnalysisTime) : 'cached'],
						['Plotting', formatElapsedTime(manhattanPlotTime)],
						['Total', formatElapsedTime(totalTime)],
						...capWarningRows
					]
				}
			]
		}
	}

	return response
}

/** Data-determining inputs for the GRIN2 cache key. Passed to
 * cacheOrRecompute as the computeArgument. View/render params (width,
 * height, devicePixelRatio, pngDotRadius, lesionTypeColors,
 * qValueThreshold, logCutoff, maxCappedPoints, hardCap, binSize) are
 * deliberately excluded — they only affect the Rust manhattan_plot
 * output, not the underlying Python statistics. Changing only a render
 * param should still hit the Python cache; changing a data filter
 * should miss. */
export function grin2KeyInputs(req: GRIN2Request) {
	return {
		genome: req.genome,
		dslabel: req.dslabel,
		filter: req.filter ?? null,
		filter0: req.filter0 ?? null,
		snvindelOptions: req.snvindelOptions ?? null,
		cnvOptions: req.cnvOptions ?? null,
		fusionOptions: req.fusionOptions ?? null,
		svOptions: req.svOptions ?? null,
		itdOptions: req.itdOptions ?? null,
		excludeOptions: normalizeExcludeOptions(req.excludeOptions),
		maxGenesToShow: req.maxGenesToShow ?? null
	}
}

/** Resolve genome-declared blacklist BED files for GRIN2's gene mask. Blacklist sources are declared
 * in the genome config (Genome.blacklists) and their file paths absolutized at genome init.
 * `selectedNames` chooses which sources to apply: undefined = all declared, [] = none, otherwise the
 * named subset. Unknown names are ignored. Returns absolute BED file paths. */
export function resolveExcludeBeds(g: any, selectedNames?: string[]): string[] {
	const all = g.blacklists as { name: string; file: string }[] | undefined
	if (!all?.length) return []
	const wanted = new Set(selectedNames ?? all.map(b => b.name))
	return all.filter(b => wanted.has(b.name)).map(b => b.file)
}

/** Normalize excludeOptions so the cache key and the Python input always agree and never carry a
 * non-finite overlapFrac. A NaN (e.g. from an empty client input) would be serialized by
 * JSON.stringify to null, and the Python wrapper's float(None) would then throw. Clamp to a finite
 * value in [0, 1] (default 0.5). Returns null when no excludeOptions are provided. */
export function normalizeExcludeOptions(opts: GRIN2Request['excludeOptions']): {
	blacklists?: string[]
	overlapFrac: number
} | null {
	if (!opts) return null
	const frac = Number(opts.overlapFrac)
	return {
		blacklists: Array.isArray(opts.blacklists) ? opts.blacklists : undefined,
		overlapFrac: Number.isFinite(frac) ? Math.min(Math.max(frac, 0), 1) : 0.5
	}
}

/** Single read-or-recompute entry point for the GRIN2 cache. The Rust
 * plot step lives in `runGrin2` (always rerun because it depends on
 * view params not in the cache key) — this wrapper only owns the
 * Python statistical step. Returns the cache result plus the telemetry
 * fields the route handler uses to label `fromCache` and the
 * processing/GRIN2 timing rows. */
async function getGrin2CacheResult(
	request: GRIN2Request,
	g: any,
	ds: any,
	chromosomelist: { [key: string]: number },
	signal?: AbortSignal
): Promise<{
	result: Grin2CacheResult
	cacheId: string
	cacheFile: string
	freshCompute: boolean
	cohortTime: number
	processingTime: number
	grin2AnalysisTime: number
}> {
	// Track per-phase timing. On a cache hit these stay 0; on a fresh
	// run they're populated inside the computeFresh closure.
	// `freshCompute` flips to true iff computeFresh ran — used by the
	// route handler to label the retrieval/processing/GRIN2 timing rows as
	// "cached" on cache hits.
	let cohortTime = 0
	let processingTime = 0
	let grin2AnalysisTime = 0
	let freshCompute = false

	// ─── cache lookup or recompute ─── //
	const {
		result,
		cacheId,
		cacheFilePath: cacheFile
	} = await cacheOrRecompute<ReturnType<typeof grin2KeyInputs>, Grin2CacheResult>({
		computeArgument: grin2KeyInputs(request),
		cacheSubdir: 'grin2',
		computeFresh: async () => {
			freshCompute = true
			const out = await runGrin2Fresh(request, g, ds, chromosomelist, signal)
			cohortTime = out.cohortTime
			processingTime = out.processingTime
			grin2AnalysisTime = out.grin2AnalysisTime
			return out.cacheResult
		}
	})

	return { result, cacheId, cacheFile, freshCompute, cohortTime, processingTime, grin2AnalysisTime }
}

/** Compute GRIN2 fresh: pull samples, build lesions, invoke Python.
 * `cacheOrRecompute` persists the returned cacheResult. Returns telemetry
 * alongside the result so `getGrin2CacheResult` can surface it to the
 * route handler. */
async function runGrin2Fresh(
	request: GRIN2Request,
	g: any,
	ds: any,
	chromosomelist: { [key: string]: number },
	signal?: AbortSignal
): Promise<{
	cacheResult: Grin2CacheResult
	cohortTime: number
	processingTime: number
	grin2AnalysisTime: number
}> {
	const startTime = Date.now()

	// Acquire the cohort's samples, then convert their per-sample mutation data to lesions. Per-sample mlst
	// comes from the general data getter ds.queries.singleSampleMutation.get() inside processSampleData.
	// sqlite datasets resolve the cohort via get_samples(); API-backed datasets (e.g. GDC) have no db and
	// instead supply ds.cohort.termdb.filterSamples(), which returns a Set of sample ids (case uuids for
	// GDC) or undefined when no filter is applied (matching get_samples()'s "no filter => all samples").
	let samples: { name: any }[]
	if (ds.cohort?.db) {
		samples = await get_samples(
			request,
			ds,
			true // must set to true to return sample name to be able to access data. FIXME this can let names revealed to grin2 client, may need to apply access control
		)
	} else if (typeof ds.cohort?.termdb?.filterSamples === 'function') {
		// Pass returnAllSamples=true: grin2 must enumerate the cohort explicitly, so an unfiltered
		// cohort should yield all samples (mirroring the sqlite "no filter => all samples" path) rather
		// than undefined. The dataset owns how "all samples" is sourced (and throws if it cannot).
		samples = [
			...((await ds.cohort.termdb.filterSamples(
				{ filter: request.filter, filter0: request.filter0, __abortSignal: signal },
				ds,
				true
			)) ?? [])
		].map(name => ({ name }))
	} else {
		throw new Error('no method available to get the sample list for this dataset')
	}

	const cohortTime = Date.now() - startTime
	mayLog(`[GRIN2] Retrieved ${samples.length.toLocaleString()} samples in ${formatElapsedTime(cohortTime)}`)

	if (samples.length === 0) {
		throw new Error('No samples found matching the provided filter criteria')
	}

	// Process sample data, convert to lesion format, and apply overall lesion cap. Time this separately
	// from the cohort retrieval above so the two costs are reported as distinct stats — for API-backed
	// datasets (GDC) the retrieval is a real network step, whereas for sqlite it's a fast local query.
	const processStart = Date.now()
	const { lesions, processing } = await processSampleData(samples, ds, request, signal)

	// Guard against undefined processing summary so eslint doesn't complain
	if (!processing) throw new Error('Processing summary is missing')

	const processingTime = Date.now() - processStart
	mayLog(`[GRIN2] Data processing took ${formatElapsedTime(processingTime)}`)
	mayLog(
		`[GRIN2] Processing summary: ${(processing?.processedSamples ?? 0).toLocaleString()}/${(
			processing?.totalSamples ?? 0
		).toLocaleString()} samples processed successfully`
	)

	if (processing?.failedSamples !== undefined && processing.failedSamples > 0) {
		mayLog(`[GRIN2] Warning: ${processing.failedSamples} samples failed to process`)
	}

	if (lesions.length === 0) {
		throw new Error('No lesions found after processing all samples. Check filter criteria and input data.')
	}

	// Step 3: Prepare input for Python script. Per-gene rows come back
	// in the stdout JSON (geneHits) and get embedded in the cache result —
	// Rust reads them straight from this JSON file, no sibling file.
	const availableDataTypes = Object.keys(optionToDt).filter(key => key in request)

	// normalized once so pyInput matches the cache key (and never carries a non-finite overlapFrac)
	const excludeOpts = normalizeExcludeOptions(request.excludeOptions)
	const excludeBeds = resolveExcludeBeds(g, excludeOpts?.blacklists)
	const excludeEnabled = excludeBeds.length > 0

	const pyInput = {
		genedb: path.join(serverconfig.tpmasterdir, g.genedb.dbfile),
		chromosomelist,
		lesion: JSON.stringify(lesions),
		maxGenesToShow: request.maxGenesToShow,
		lesionTypeMap: buildLesionTypeMap(availableDataTypes),
		excludeEnabled,
		excludeBeds,
		excludeOverlapFrac: excludeOpts?.overlapFrac ?? 0.5
	}

	// Step 4: Run GRIN2 analysis via Python
	const grin2AnalysisStart = Date.now()
	const pyResult = await run_python('grin2PpWrapper.py', JSON.stringify(pyInput), { signal })

	if (pyResult.stderr?.trim()) {
		mayLog(`[GRIN2] Python stderr: ${pyResult.stderr}`)
		if (pyResult.stderr.includes('ERROR:')) {
			throw new Error(`Python script error: ${pyResult.stderr}`)
		}
	}

	const grin2AnalysisTime = Date.now() - grin2AnalysisStart
	mayLog(`[GRIN2] Python processing took ${formatElapsedTime(grin2AnalysisTime)}`)

	const resultData = JSON.parse(pyResult)

	const cacheResult: Grin2CacheResult = {
		resultData,
		processing
	}
	return { cacheResult, cohortTime, processingTime, grin2AnalysisTime }
}

// ─── helpers ─── //

/**
 * Process sample data by reading per-sample JSON files and converting to lesion format
 * Each sample has a JSON file containing mutation data (mlst array)
 * Returns a string array of lesions: [ID, chrom, loc.start, loc.end, lsn.type] and processing summary
 * We limit the total number of lesions to avoid overwhelming the production server. The limit is set by MAX_LESIONS
 */
async function processSampleData(
	samples: any[],
	ds: any,
	request: GRIN2Request,
	signal?: AbortSignal
): Promise<{ lesions: Lesion[]; processing: Grin2Processing }> {
	const lesions: Lesion[] = []
	const maxLesions = await getMaxLesions()
	mayLog(`[GRIN2] Max lesions for this run: ${maxLesions.toLocaleString()}`)

	// How this ds quantifies cnv values; drives gain/loss classification. The ds-level default is used for
	// file-based datasets; else 'log2ratio' (legacy default, diploid baseline 0). GDC's batched cnv records
	// carry their own valueType:'category' per segment, so they classify correctly regardless of this default.
	const cnvType: CnvType = ds.queries?.cnv?.type ?? 'log2ratio'

	// Track unique samples per lesion type for reporting
	const samplesPerType = new Map<number, Set<string>>()
	// Track unique samples per *lesion type* (gain/loss/mutation/...) so the summary can report, e.g.,
	// how many samples have a gain vs a loss — distinct from samplesPerType, which is per data type.
	const samplesPerLesionType = new Map<string, Set<string>>()
	const enabledTypes: number[] = []
	if (request.snvindelOptions) enabledTypes.push(dtsnvindel)
	if (request.cnvOptions) enabledTypes.push(dtcnv)
	if (request.fusionOptions) enabledTypes.push(dtfusionrna)
	if (request.svOptions) enabledTypes.push(dtsv)
	if (request.itdOptions) enabledTypes.push(dtitd)

	for (const type of enabledTypes) {
		samplesPerType.set(type, new Set<string>())
	}

	const processing: Grin2Processing = {
		totalSamples: samples.length,
		processedSamples: 0,
		failedSamples: 0,
		totalLesions: 0,
		processedLesions: 0,
		unprocessedSamples: 0
	}

	// Fetch and convert per-sample mutation data with bounded concurrency. For sqlite datasets each
	// get() is a fast local file read; for API-backed datasets (e.g. GDC) each is a network round-trip,
	// so running them one-at-a-time over a large cohort is prohibitively slow. mapConcurrent() runs a
	// worker pool at the dataset's configured query concurrency (GDC=10 — the same cap the matrix code
	// uses for GDC API calls), keeping exactly that many fetches in flight. Each sample's lesions are
	// merged inline (the merge has no await, so concurrent workers can't interleave the cap math); we
	// handle per-sample errors ourselves so they count toward failedSamples, and stop scheduling new
	// fetches once the overall lesion cap is reached.
	const concurrency = Math.max(1, ds.cohort?.termdb?.maxConcurrentQueries || 10)

	// dt types this query may return but that the caller didn't request; pass to the getter so backends
	// can avoid fetching them. For GDC this skips per-sample snvindel/cnv/fusion file reads (network round-trips)
	// when those options are off; for native ds it filters out unrequested dt before return.
	const skipDt = new Set<number>(Object.values(optionToDt).filter(dt => !enabledTypes.includes(dt)))

	// If the ds offers a batch mutation getter (GDC) and snvindel and/or cnv is requested, fetch those up
	// front in batched requests (GDC: ssm_occurrences + segment_cnv_occurrences POSTs per chunk of cases)
	// instead of one per sample. fusion/sv still come from the per-sample get() below. batchBySample maps
	// sample name -> {mlst} holding the batched snvindel and categorical cnv records.
	const batchGet = ds.queries.singleSampleMutation.batchGet
	const useBatch = typeof batchGet == 'function' && (enabledTypes.includes(dtsnvindel) || enabledTypes.includes(dtcnv))
	let batchBySample: Map<string, { mlst: any[] }> | undefined
	if (useBatch) {
		const batch = await batchGet({
			samples: samples.map(s => s.name),
			skipDt, // getter fetches only the enabled dts among snvindel/cnv
			ds, // batch getter reads ds from q.ds (gdc.hg38.ts convention)
			filter0: request.filter0,
			// cap the up-front fetch at the run's lesion budget so a huge cohort / entire GDC doesn't
			// pull millions of records before the per-sample loop's cap would ever discard them
			maxLesions,
			__abortSignal: signal
		})
		batchBySample = batch.bySample
		// If the cap truncated the batch fetch, some samples got no SNV/indel data even though the loop
		// below still "processes" them — so the loop's "ran on N of M" check won't catch it. Record it here
		// so the summary can warn the user, like the non-batched path does.
		if (batch.capReached) {
			processing.ssmCapReached = true
			processing.ssmSamplesDropped = batch.droppedSamples
		}
		// Samples whose case had no open-access SNV/indel, surfaced so users don't read a partial cohort as
		// complete (not an error, just a coverage note). Split into controlled-access vs genuinely-no-mutation,
		// plus samples that matched no GDC case at all, so they reconcile in the summary.
		processing.ssmSamplesNoOpenAccess = batch.samplesNoOpenSsm
		processing.ssmSamplesControlledAccess = batch.samplesControlledAccess
		processing.ssmSamplesNoMutations = batch.samplesNoMutations
		processing.unmatchedSamples = batch.unresolvedSamples
		// cnv coverage from the same batch (0 when cnv wasn't requested). cnvCapReached mirrors ssmCapReached
		// (the cap skipped some samples' cnv while the loop still "processed" them); cnvSamplesNoData is a
		// coverage note for queried samples that had no cnv segment.
		if (batch.cnvCapReached) {
			processing.cnvCapReached = true
			processing.cnvSamplesDropped = batch.cnvSamplesDropped
		}
		processing.cnvSamplesNoData = batch.cnvSamplesNoData
	}
	// When mutations are batched, skip snvindel + cnv in the per-sample loop so get() doesn't re-fetch them
	// (fusion/sv, if enabled, still flow through get()).
	const loopSkipDt = useBatch ? new Set<number>(skipDt).add(dtsnvindel).add(dtcnv) : skipDt
	// If batching ssm leaves no other enabled dt for this case, the per-sample get() has nothing to
	// fetch — skip the call entirely (avoids one empty round-trip per sample for snvindel-only runs).
	const needPerSampleGet = enabledTypes.some(dt => !loopSkipDt.has(dt))

	await mapConcurrent(
		samples,
		concurrency,
		async sample => {
			try {
				// Worker may start after the client already disconnected/cancelled; bail before doing any
				// per-sample work (including the GDC network call below) once the request is aborted.
				if (signal?.aborted) return

				// batched snvindel + categorical cnv for this sample (fetched up front); [] when not batched / none found
				const batchMlst = batchBySample?.get(sample.name)?.mlst ?? []

				let getMlst: any[] = []
				if (needPerSampleGet) {
					const r = await ds.queries.singleSampleMutation.get({
						sample: sample.name,
						skipDt: loopSkipDt,
						// propagate the request abort signal so the GDC getter's xfetch stops issuing network
						// requests once the client disconnects/cancels (the getter reads q.__abortSignal)
						__abortSignal: signal
					})
					getMlst = r.mlst || []
				}
				const mlst = batchMlst.length ? [...batchMlst, ...getMlst] : getMlst

				const { sampleLesions, contributedTypes, hyperMutatedDt } = processSampleMlst(
					sample.name,
					mlst,
					request,
					cnvType
				)

				// Tally per-dt hypermutator exclusions (a sample can be hypermutated for snvindel, cnv, both,
				// or neither). Synchronous like the counters below, so concurrent workers can't interleave.
				for (const dt of hyperMutatedDt) {
					if (dt === dtsnvindel) processing.ssmSamplesHypermutated = (processing.ssmSamplesHypermutated ?? 0) + 1
					else if (dt === dtcnv) processing.cnvSamplesHypermutated = (processing.cnvSamplesHypermutated ?? 0) + 1
				}

				// Filter out chrM lesions
				const filteredLesions = ds.queries.singleSampleMutation.discoPlot?.skipChrM
					? sampleLesions.filter(lesion => lesion[1].toLowerCase() !== 'chrm')
					: sampleLesions

				// Merge synchronously (no await below) so concurrent workers can't interleave the cap math
				const remainingCapacity = maxLesions - lesions.length
				if (remainingCapacity <= 0) return
				const usedLesions = filteredLesions.slice(0, remainingCapacity)
				lesions.push(...usedLesions)

				// Track samples for each type they contributed to
				for (const type of contributedTypes) {
					samplesPerType.get(type)?.add(sample.name)
				}

				// Track samples per lesion type from the lesions actually used (consistent with lesionTypeCounts)
				for (const lesion of usedLesions) {
					const lt = lesion[4]
					let set = samplesPerLesionType.get(lt)
					if (!set) {
						set = new Set<string>()
						samplesPerLesionType.set(lt, set)
					}
					set.add(sample.name)
				}

				processing.processedSamples! += 1
				processing.totalLesions! += filteredLesions.length

				const done = processing.processedSamples! + processing.failedSamples!
				// On the batched path (GDC) mutations are fetched up front, so this per-sample loop races to
				// completion and this counter is misleading — progress is logged by the batch getter's
				// per-chunk fetch instead. Native/SQLite datasets do the real work here, so keep the line.
				if (!useBatch && done % 200 === 0) mayLog(`[GRIN2] Processed ${done}/${samples.length} samples`)
			} catch (e: any) {
				processing.failedSamples! += 1
				mayLog(`[GRIN2] Error processing sample ${sample.name}: ${e.message || e}`)
			}
		},
		{ stopWhen: () => lesions.length >= maxLesions }
	)

	// Samples neither processed nor failed were skipped after the lesion cap was reached
	processing.unprocessedSamples = samples.length - processing.processedSamples! - processing.failedSamples!

	processing.processedLesions = lesions.length
	processing.lesionCap = maxLesions

	// Build lesion counts for summary
	const lesionCounts: any = {
		total: lesions.length,
		byType: {}
	}

	// Count lesions by type in a single pass
	const lesionTypeCounts: Record<string, number> = {}
	for (const lesion of lesions) {
		const lesionType = lesion[4]
		lesionTypeCounts[lesionType] = (lesionTypeCounts[lesionType] || 0) + 1
	}

	for (const type of enabledTypes) {
		const dtConfig = dt2lesion[type]

		if (!dtConfig) continue

		dtConfig.lesionTypes.forEach(lt => {
			lesionCounts.byType[lt.lesionType] = {
				count: lesionTypeCounts[lt.lesionType] || 0,
				// samples with at least one lesion of this specific lesion type (e.g. gain vs loss separately)
				samples: samplesPerLesionType.get(lt.lesionType)?.size || 0
			}
		})
	}

	processing.lesionCounts = lesionCounts

	// Unique samples that contributed at least one lesion (union across all lesion types). Lets the
	// summary show "samples with data" alongside the full cohort size, so users don't read the cohort
	// count (processedSamples) as "samples that had mutations".
	const samplesWithData = new Set<string>()
	for (const set of samplesPerLesionType.values()) {
		for (const s of set) samplesWithData.add(s)
	}
	processing.samplesWithData = samplesWithData.size

	return { lesions, processing }
}
