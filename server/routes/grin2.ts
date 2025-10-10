import type { GRIN2Request, GRIN2Response, RouteApi } from '#types'
import { GRIN2Payload } from '#types/checkers'
import serverconfig from '#src/serverconfig.js'
import path from 'path'
import { run_python } from '@sjcrh/proteinpaint-python'
import { mayLog } from '#src/helpers.ts'
import { get_samples } from '#src/termdb.sql.js'
import { read_file, file_is_readable } from '#src/utils.js'
import { dtsnvindel, dtcnv, dtfusionrna, dtsv } from '#shared/common.js'

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
 *    - SNV/indel: Filter by depth, alternate allele count, consequence types, and 5' and 3' flanking sizes
 *    - CNV: Filter by copy number thresholds, max segment length, and 5' and 3' flanking sizes
 *    - Fusion: Filter by 5' and 3' flanking sizes
 *    - SV: Filter by 5' and 3' flanking sizes
 *    - Hypermutator: To be implemented at later date
 * 4. Convert filtered data to lesion format and apply filter caps per type
 * 5. Pass lesion data and device pixel ratio to Python for GRIN2 statistical analysis and plot generation
 * 6. Return Manhattan plot as base64 string, top gene table, timing information, and statistically significant results that are displayed as an interactive svg
 */

// Constants & types
const MAX_LESIONS_PER_TYPE = 50000 // Maximum number of lesions to process per type to avoid overwhelming the production server
type TrackState = { count: number }
type LesionTracker = Map<number, TrackState>

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
	const tracker = getLesionTracker(request)
	const processingStartTime = Date.now()

	const { lesions, processingSummary } = await processSampleData(samples, ds, request, tracker)

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

/**  Initializes a new, request-specific lesion tracker.
 * Builds a set of enabled lesion types from the request and a Map that tracks
 * per-type lesion counts and warning flags. */
function getLesionTracker(req: GRIN2Request): LesionTracker {
	const currentTypes: number[] = []
	if (req.snvindelOptions) currentTypes.push(dtsnvindel)
	if (req.cnvOptions) currentTypes.push(dtcnv)
	if (req.fusionOptions) currentTypes.push(dtfusionrna)
	if (req.svOptions) currentTypes.push(dtsv)

	const track = new Map<number, TrackState>()
	for (const t of currentTypes) track.set(t, { count: 0 })
	return track
}

/** Early-stop if all enabled types are at their caps */
function allTypesCapped(tracker: LesionTracker): boolean {
	for (const value of tracker.values()) {
		if (value.count < MAX_LESIONS_PER_TYPE) return false
	}
	return true
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
	request: GRIN2Request,
	tracker: LesionTracker
): Promise<{ lesions: any[]; processingSummary: GRIN2Response['processingSummary'] }> {
	const lesions: any[] = []

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
		if (allTypesCapped(tracker)) {
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

			const { sampleLesions } = await processSampleMlst(sample.name, mlst, request, tracker)
			lesions.push(...sampleLesions)

			processingSummary.processedSamples! += 1
			processingSummary.totalLesions! += sampleLesions.length

			if (allTypesCapped(tracker)) {
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
			mayLog(`[GRIN2] Error processing sample ${sample.name}`)
		}
	}

	processingSummary.processedLesions = lesions.length

	// After processing all samples, we will warn for any type that has reached its cap
	for (const [type, info] of tracker.entries()) {
		if (info.count >= MAX_LESIONS_PER_TYPE) {
			let label: string
			switch (type) {
				case dtsnvindel:
					label = 'mutation'
					break
				case dtcnv:
					label = 'CNV (gain/loss)'
					break
				case dtfusionrna:
					label = 'fusion'
					break
				case dtsv:
					label = 'structural variant'
					break
				default:
					label = `type ${type}`
					break
			}
			mayLog(
				`[GRIN2] Warning: ${label} lesions reached the per-type cap of ${MAX_LESIONS_PER_TYPE.toLocaleString()}. No further ${label} lesions were processed.`
			)
		}
	}

	return { lesions, processingSummary }
}

/** Process the MLST data for each sample and cap the number of lesions per data type */
async function processSampleMlst(
	sampleName: string,
	mlst: any[],
	request: GRIN2Request,
	tracker: LesionTracker
): Promise<{ sampleLesions: any[] }> {
	const sampleLesions: any[] = []

	for (const m of mlst) {
		switch (m.dt) {
			case dtsnvindel: {
				if (!request.snvindelOptions) break

				const entry = tracker.get(dtsnvindel)
				if (entry && entry.count >= MAX_LESIONS_PER_TYPE) {
					break
				}

				const les = filterAndConvertSnvIndel(sampleName, m, request.snvindelOptions)
				if (les && entry) {
					entry.count++
					sampleLesions.push(les)
				}
				break
			}

			case dtcnv: {
				if (!request.cnvOptions) break

				// Shared cap for both gain & loss
				const cnv = tracker.get(dtcnv)
				if (cnv && cnv.count >= MAX_LESIONS_PER_TYPE) {
					break
				}

				const les = filterAndConvertCnv(sampleName, m, request.cnvOptions)
				if (les && cnv) {
					cnv.count++ // single counter for both gain and loss
					sampleLesions.push(les)
				}
				break
			}

			case dtfusionrna: {
				if (!request.fusionOptions) break

				const fusion = tracker.get(dtfusionrna)
				if (fusion && fusion.count >= MAX_LESIONS_PER_TYPE) {
					break
				}

				const les = filterAndConvertFusion(sampleName, m, request.fusionOptions)
				if (les && fusion) {
					// Check if adding these lesions would exceed the cap
					const lesionsToAdd = Array.isArray(les[0]) ? (les as string[][]).length : 1

					if (fusion.count + lesionsToAdd > MAX_LESIONS_PER_TYPE) {
						// Would exceed cap, skip this fusion
						break
					}

					// Add all lesions (breakpoints) to the list
					if (Array.isArray(les[0])) {
						// Multiple lesions (two breakpoints)
						for (const lesion of les as string[][]) {
							sampleLesions.push(lesion)
							fusion.count++ // ← Increment for each lesion added
						}
					} else {
						// Single lesion
						sampleLesions.push(les)
						fusion.count++
					}
				}
				break
			}

			case dtsv: {
				if (!request.svOptions) break

				const sv = tracker.get(dtsv)
				if (sv && sv.count >= MAX_LESIONS_PER_TYPE) {
					break
				}

				const les = filterAndConvertSV(sampleName, m, request.svOptions)
				if (les && sv) {
					// Check if adding these lesions would exceed the cap
					const lesionsToAdd = Array.isArray(les[0]) ? (les as string[][]).length : 1

					if (sv.count + lesionsToAdd > MAX_LESIONS_PER_TYPE) {
						// Would exceed cap, skip this SV
						break
					}

					// Add all lesions (breakpoints) to the list
					if (Array.isArray(les[0])) {
						// Multiple lesions (two breakpoints)
						for (const lesion of les as string[][]) {
							sampleLesions.push(lesion)
							sv.count++ // ← Increment for each lesion added
						}
					} else {
						// Single lesion
						sampleLesions.push(les)
						sv.count++
					}
				}
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

	// Check consequence filtering. If no consequences selected, include all consequences
	// If consequences are selected, only include those
	if (options.consequences.length > 0 && entry.class && !options.consequences.includes(entry.class)) {
		return null
	}

	if (!Number.isInteger(entry.pos)) {
		return null
	}

	// Filter by minimum alternate allele count
	if (options.minAltAlleleCount !== undefined && options.minAltAlleleCount > 0) {
		if (!entry.altCount || entry.altCount < options.minAltAlleleCount) {
			return null
		}
	}

	// Filter by minimum total depth (refCount + altCount)
	if (options.minTotalDepth !== undefined && options.minTotalDepth > 0) {
		const totalDepth = (entry.refCount || 0) + (entry.altCount || 0)
		if (totalDepth < options.minTotalDepth) {
			return null
		}
	}

	// Apply 5' and 3' flanking to the point mutation
	const flanking5p = options.fivePrimeFlankSize || 0
	const flanking3p = options.threePrimeFlankSize || 0
	const start = entry.pos - flanking5p
	const end = entry.pos + flanking3p

	// TODO: implement hypermutator threshold filter (maybe calculate number of mutations per sample?)

	return [sampleName, entry.chr, start, end, 'mutation']
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

	// Apply 5' and 3' flanking to the segment
	// const flanking5p = options.fivePrimeFlankSize || 0
	// const flanking3p = options.threePrimeFlankSize || 0
	// const start = entry.start - flanking5p
	// const end = entry.stop + flanking3p

	return [sampleName, entry.chr, entry.start, entry.stop, lesionType]
}

function filterAndConvertFusion(
	sampleName: string,
	entry: any,
	_options: GRIN2Request['fusionOptions']
): string[] | string[][] | null {
	// Validate required fields and check for undefined for typescript
	if (!entry.chrA || entry.posA === undefined) {
		return null
	}

	// Get flanking parameters
	// const flanking5p = options.fivePrimeFlankSize || 0
	// const flanking3p = options.threePrimeFlankSize || 0

	// // First breakpoint on chrA
	// const startA = Math.max(0, entry.posA - flanking5p)
	// const endA = entry.posA + flanking3p

	const lesionA: string[] = [sampleName, entry.chrA, entry.posA, entry.posA, 'fusion']

	// Check if there's a second breakpoint on chrB
	if (entry.chrB && entry.posB !== undefined) {
		// Inter-chromosomal fusion or same chromosome with two breakpoints
		// const startB = Math.max(0, entry.posB - flanking5p)
		// const endB = entry.posB + flanking3p

		const lesionB: string[] = [sampleName, entry.chrB, entry.posB, entry.posB, 'fusion']

		// Return both breakpoints as separate lesions
		// This will correctly identify genes affected at both fusion partners
		return [lesionA, lesionB]
	}

	// Only chrA breakpoint available
	return lesionA
}

function filterAndConvertSV(
	sampleName: string,
	entry: any,
	_options: GRIN2Request['svOptions']
): string[] | string[][] | null {
	// Validate required fields for for typescript
	if (!entry.chrA || entry.posA === undefined) {
		return null
	}

	// Get flanking parameters
	// const flanking5p = options.fivePrimeFlankSize || 0
	// const flanking3p = options.threePrimeFlankSize || 0

	// First breakpoint on chrA
	// const startA = Math.max(0, entry.posA - flanking5p)
	// const endA = entry.posA + flanking3p

	const lesionA: string[] = [sampleName, entry.chrA, entry.posA, entry.posA, 'sv']

	// Check if there's a second breakpoint on chrB
	if (entry.chrB && entry.posB !== undefined) {
		// Inter-chromosomal SV or same chromosome with two breakpoints
		// const startB = Math.max(0, entry.posB - flanking5p)
		// const endB = entry.posB + flanking3p

		const lesionB: string[] = [sampleName, entry.chrB, entry.posB, entry.posB, 'sv']

		// Return both breakpoints as separate lesions
		return [lesionA, lesionB]
	}

	// Only chrA breakpoint available
	return lesionA
}
