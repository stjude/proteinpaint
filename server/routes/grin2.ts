import type { GRIN2Request, GRIN2Response, RouteApi } from '#types'
import { GRIN2Payload } from '#types/checkers'
import serverconfig from '#src/serverconfig.js'
import path from 'path'
import { run_python } from '@sjcrh/proteinpaint-python'
import { mayLog } from '#src/helpers.ts'
import { get_samples } from '#src/termdb.sql.js'
import { read_file, file_is_readable } from '#src/utils.js'
import { dtsnvindel, dtcnv, dtfusionrna } from '#shared/common.js'

/**
 * General GRIN2 analysis handler
 * Processes user-provided snvindel, CNV, and fusion filters and performs GRIN2 analysis
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
 *        - lsn.type: Type of lesion ("mutation", "gain", "loss", "fusion")
 * 3. Read and filter file contents based on snvindelOptions, cnvOptions, fusionOptions:
 *    - SNV/indel: Filter by depth, alternate allele count, and consequence types
 *    - CNV: Filter by copy number thresholds, and max segment length
 *    - Fusion: TBD
 *    - Hypermutator: Apply a maximum mutation count cutoff for highly mutated samples
 * 4. Convert filtered data to lesion format and apply filter caps per type
 * 5. Pass lesion data and device pixel ratio to Python for GRIN2 statistical analysis and plot generation
 * 6. Return Manhattan plot as base64 string, top gene table, timing information, and statistically significant results that are displayed as an interactive svg
 */

// Constants
const MAX_LESIONS_PER_TYPE = 10000 // Maximum number of lesions to process per type to avoid overwhelming the production server
export const ALL_LESION_TYPES = ['mutation', 'gain', 'loss', 'fusion'] as const
export type LesionType = (typeof ALL_LESION_TYPES)[number]

// ---- Per-request state (reinitialized per request)
let CURRENT_TYPES: Set<LesionType> = new Set()
const trackType: Map<LesionType, { count: number; warned: boolean }> = new Map()

export const api: RouteApi = {
	endpoint: 'grin2',
	methods: {
		get: {
			...GRIN2Payload,
			init
		},
		post: {
			...GRIN2Payload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		try {
			const request = req.query as GRIN2Request

			// Get genome and dataset from request parameters
			const g = genomes[request.genome]
			if (!g) throw new Error('genome missing')

			const ds = g.datasets?.[request.dslabel]
			if (!ds) throw new Error('ds missing')

			if (!ds.queries?.singleSampleMutation) throw new Error('singleSampleMutation query missing from dataset')

			const result = await runGrin2(g, ds, request)
			res.json(result)
		} catch (e: any) {
			console.error('[GRIN2] Error stack:', e.stack)

			const errorResponse: GRIN2Response = {
				status: 'error',
				error: e.message || String(e)
			}

			res.status(500).send(errorResponse)
		}
	}
}

async function runGrin2(g: any, ds: any, request: GRIN2Request): Promise<GRIN2Response> {
	const startTime = Date.now()

	// Step 1: Get samples using cohort infrastructure
	//mayLog('[GRIN2] Getting samples from cohort filter...')

	const samples = await get_samples(
		request,
		ds,
		true // must set to true to return sample name to be able to access file. FIXME this can let names revealed to grin2 client, may need to apply access control
	)

	const cohortTime = Date.now() - startTime
	mayLog(`[GRIN2] Retrieved ${samples.length.toLocaleString()} samples in ${Math.round(cohortTime / 1000)} seconds`)

	if (samples.length === 0) {
		throw new Error('No samples found matching the provided filter criteria')
	}

	// Step 2: Process sample data, convert to lesion format, and apply filter caps per type
	// mayLog('[GRIN2] Processing sample data...')
	const processingStartTime = Date.now()

	const { lesions, processingSummary } = await processSampleData(samples, ds, request)

	const processingTime = Date.now() - processingStartTime
	const processingTimeToPrint = Math.round(processingTime / 1000)
	mayLog(`[GRIN2] Data processing took ${processingTimeToPrint} seconds`)
	mayLog(
		`[GRIN2] Processing summary: ${processingSummary?.processedSamples ?? 0}/${
			processingSummary?.totalSamples ?? samples.length
		} samples processed successfully`
	)

	if (processingSummary?.failedSamples !== undefined && processingSummary.failedSamples > 0) {
		mayLog(`[GRIN2] Warning: ${processingSummary.failedSamples} samples failed to process`)
	}

	if (lesions.length === 0) {
		throw new Error('No lesions found after processing all samples. Check filter criteria and input data.')
	}

	// Step 3: Prepare input for Python script
	const pyInput = {
		genedb: path.join(serverconfig.tpmasterdir, g.genedb.dbfile),
		chromosomelist: {} as { [key: string]: number },
		lesion: JSON.stringify(lesions),
		devicePixelRatio: request.devicePixelRatio,
		pngDotRadius: request.pngDotRadius,
		width: request.width,
		height: request.height
	}

	// Build chromosome list from genome reference
	for (const c in g.majorchr) {
		// List is short so a small penalty for accessing the flag in the loop
		if (ds.queries.singleSampleMutation.discoPlot?.skipChrM) {
			// Skip chrM; this property is set in gdc ds but still assess it to avoid hardcoding the logic, in case code maybe reused for non-gdc ds
			if (c.toLowerCase() == 'chrm') continue
		}
		pyInput.chromosomelist[c] = g.majorchr[c]
	}

	// Step 4: Run GRIN2 analysis via Python
	const grin2AnalysisStart = Date.now()
	const pyResult = await run_python('grin2PpWrapper.py', JSON.stringify(pyInput))

	if (pyResult.stderr?.trim()) {
		mayLog(`[GRIN2] Python stderr: ${pyResult.stderr}`)
		if (pyResult.stderr.includes('ERROR:')) {
			throw new Error(`Python script error: ${pyResult.stderr}`)
		}
	}

	const grin2AnalysisTime = Date.now() - grin2AnalysisStart
	const grin2AnalysisTimeToPrint = Math.round(grin2AnalysisTime / 1000)
	mayLog(`[GRIN2] Python processing took ${grin2AnalysisTimeToPrint} seconds`)

	// Step 5: Parse results and respond
	const resultData = JSON.parse(pyResult)

	// Validate Python script output
	if (!resultData?.png?.[0]) {
		throw new Error('Invalid Python output: missing PNG data')
	}

	const totalTime = Math.round((Date.now() - startTime) / 1000)

	const response: GRIN2Response = {
		status: 'success',
		pngImg: resultData.png[0],
		plotData: resultData.plotData,
		topGeneTable: resultData.topGeneTable,
		totalGenes: resultData.totalGenes,
		showingTop: resultData.showingTop,
		timing: {
			processingTime: processingTimeToPrint,
			grin2Time: grin2AnalysisTimeToPrint,
			totalTime: totalTime
		},
		processingSummary: processingSummary
	}

	return response
}

// Build the active type list from the request options
function lesionTypesForRequest(req: GRIN2Request): LesionType[] {
	const out: LesionType[] = []
	if (req.snvindelOptions) out.push('mutation')
	if (req.cnvOptions) out.push('gain', 'loss')
	if (req.fusionOptions) out.push('fusion')
	return out
}

// Reset per-request trackers based on the request (call once per run)
export function resetLesionTrackers(req: GRIN2Request) {
	CURRENT_TYPES = new Set<LesionType>(lesionTypesForRequest(req))
	trackType.clear()
	for (const t of CURRENT_TYPES) {
		trackType.set(t, { count: 0, warned: false })
	}
}

// Early-stop: are all enabled types at their caps?
function allTypesCapped(): boolean {
	for (const t of CURRENT_TYPES) {
		const entry = trackType.get(t)
		if (!entry || entry.count < MAX_LESIONS_PER_TYPE) return false
	}
	return true
}

// Warn once per type
function warnOnce(t: LesionType) {
	if (!CURRENT_TYPES.has(t)) return
	const entry = trackType.get(t)
	if (!entry) return
	if (!entry.warned) {
		entry.warned = true
		mayLog(
			`[GRIN2] Warning: ${t} lesions exceeded the per-type limit of ${MAX_LESIONS_PER_TYPE.toLocaleString()}. ` +
				`Additional ${t} lesions will be skipped.`
		)
	}
}

/**
 * Process sample data by reading per-sample JSON files and converting to lesion format
 * Each sample has a JSON file containing mutation data (mlst array)
 * Returns a string array of lesions: [ID, chrom, loc.start, loc.end, lsn.type] and processing summary
 * We limit the number of lesions per type to avoid overwhelming the production server. The limit is set by MAX_LESIONS_PER_TYPE
 */
async function processSampleData(
	samples: any[],
	ds: any,
	request: GRIN2Request
): Promise<{ lesions: any[]; processingSummary: GRIN2Response['processingSummary'] }> {
	resetLesionTrackers(request)

	const lesions: any[] = []
	let lesionId = 1

	const processingSummary: GRIN2Response['processingSummary'] = {
		totalSamples: samples.length,
		processedSamples: 0,
		failedSamples: 0,
		failedFiles: [],
		totalLesions: 0,
		processedLesions: 0,
		unprocessedSamples: 0
	}

	outer: for (let i = 0; i < samples.length; i++) {
		// Stop before opening more files if all enabled types are already capped
		if (allTypesCapped()) {
			const remaining = samples.length - i
			if (remaining > 0) processingSummary.unprocessedSamples! += remaining
			mayLog('[GRIN2] All enabled per-type caps reached; stopping early.')
			break outer
		}

		const sample = samples[i]
		const filepath = path.join(serverconfig.tpmasterdir, ds.queries.singleSampleMutation.folder, sample.name)

		try {
			await file_is_readable(filepath)
			const mlst = JSON.parse(await read_file(filepath))

			const { sampleLesions } = await processSampleMlst(sample.name, mlst, lesionId, request)

			lesions.push(...sampleLesions)
			lesionId += sampleLesions.length

			processingSummary.processedSamples! += 1
			processingSummary.totalLesions! += sampleLesions.length

			// Stop after this sample if caps are now all met
			if (allTypesCapped()) {
				const remaining = samples.length - 1 - i
				if (remaining > 0) processingSummary.unprocessedSamples! += remaining
				mayLog('[GRIN2] All enabled per-type caps reached; stopping early.')
				break outer
			}
		} catch (error) {
			processingSummary.failedSamples! += 1
			processingSummary.failedFiles!.push({
				sampleName: sample.name,
				filePath: filepath,
				error: error instanceof Error ? error.message || 'Unknown error' : String(error)
			})
		}
	}

	processingSummary.processedLesions = lesions.length
	return { lesions, processingSummary }
}

/** Enforce cap. Simply check if entry.count < MAX_LESIONS_PER_TYPE. If it is it gets incremented and returns true to caller so that the tuple is pushed.
 * Else the cap is hit. The first time this happens we call warnOnce and print that the cap is hit. We return false to caller so that tuple isn't pushed. */
function pushIfUnderCap(lesion: any[]): boolean {
	const t = lesion[4] as LesionType
	if (!CURRENT_TYPES.has(t)) return false
	const entry = trackType.get(t)
	if (!entry) return false
	if (entry.count < MAX_LESIONS_PER_TYPE) {
		entry.count++
		return true
	}
	warnOnce(t)
	return false
}

/** Process the MLST data for each sample and cap the number of lesions per type */
async function processSampleMlst(
	sampleName: string,
	mlst: any[],
	startId: number,
	request: GRIN2Request
): Promise<{ sampleLesions: any[] }> {
	const sampleLesions: any[] = []

	for (const m of mlst) {
		switch (m.dt) {
			case dtsnvindel: {
				if (!request.snvindelOptions) break
				// mutation cap reached? skip conversion entirely
				if ((trackType.get('mutation')?.count ?? 0) >= MAX_LESIONS_PER_TYPE) {
					warnOnce('mutation')
					break
				}
				const les = filterAndConvertSnvIndel(sampleName, m, request.snvindelOptions)
				if (les && pushIfUnderCap(les)) sampleLesions.push(les)
				break
			}

			case dtcnv: {
				if (!request.cnvOptions) break
				// both CNV subtypes already capped? skip conversion
				if (
					(trackType.get('gain')?.count ?? 0) >= MAX_LESIONS_PER_TYPE &&
					(trackType.get('loss')?.count ?? 0) >= MAX_LESIONS_PER_TYPE
				)
					break
				const les = filterAndConvertCnv(sampleName, m, request.cnvOptions)
				if (les && pushIfUnderCap(les)) sampleLesions.push(les)
				break
			}

			case dtfusionrna: {
				if (!request.fusionOptions) break
				if ((trackType.get('fusion')?.count ?? 0) >= MAX_LESIONS_PER_TYPE) {
					warnOnce('fusion')
					break
				}
				const les = filterAndConvertFusion(sampleName, m, request.fusionOptions)
				if (les && pushIfUnderCap(les)) sampleLesions.push(les)
				break
			}

			default:
				break
		}
	}

	return { sampleLesions }
}

function filterAndConvertSnvIndel(
	sampleName: string,
	entry: any,
	options: GRIN2Request['snvindelOptions']
): string[] | null {
	// Check if options and consequences exist for typescript
	if (!options?.consequences) {
		return null
	}
	// Check consequence filtering
	if (options.consequences.length > 0 && entry.class && !options.consequences.includes(entry.class)) {
		return null
	}

	if (!Number.isInteger(entry.pos)) {
		return null
	}

	// TODO: implement alleleic total depth and alt allele count filters
	// TODO: implement hypermutator threshold filter (maybe calculate number of mutations per sample?)

	return [sampleName, entry.chr, entry.pos, entry.pos, 'mutation']
}

function filterAndConvertCnv(sampleName: string, entry: any, options: GRIN2Request['cnvOptions']): string[] | null {
	// Must check that options are defined for typescript
	if (
		!options ||
		options.gainThreshold === undefined ||
		options.lossThreshold === undefined ||
		options.maxSegLength === undefined
	) {
		return null
	}

	if (!Number.isInteger(entry.start)) {
		return null
	}

	if (!Number.isInteger(entry.stop)) {
		return null
	}

	// Filter max segment length
	if (options.maxSegLength > 0 && entry.stop - entry.start > options.maxSegLength) {
		return null
	}

	// Must be either gain or loss
	// This determines the lesion type
	const isGain = entry.value >= options.gainThreshold
	const isLoss = entry.value <= options.lossThreshold
	if (!isGain && !isLoss) return null
	const lesionType = isGain ? 'gain' : 'loss'

	// TODO: implement hypermutator threshold filter (maybe calculate number of mutations per sample?)

	return [sampleName, entry.chr, entry.start, entry.stop, lesionType]
}

function filterAndConvertFusion(
	sampleName: string,
	entry: any,
	_options: GRIN2Request['fusionOptions']
): string[] | null {
	// Convert to lesion format: [ID, chrom, loc.start, loc.end, lsn.type]
	// Using chrA for the chrom and posA/posB for the start and end locations
	return [sampleName, entry.chrA, entry.posA, entry.posB, 'fusion']
}
