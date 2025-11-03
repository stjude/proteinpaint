import type { GRIN2Request, GRIN2Response, RouteApi } from '#types'
import { GRIN2Payload } from '#types/checkers'
import serverconfig from '#src/serverconfig.js'
import path from 'path'
import { run_python } from '@sjcrh/proteinpaint-python'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import { mayLog } from '#src/helpers.ts'
import { get_samples } from '#src/termdb.sql.js'
import { read_file, file_is_readable } from '#src/utils.js'
import { dtsnvindel, dtcnv, dtfusionrna, dtsv } from '#shared/common.js'
import crypto from 'crypto'

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
 * 3. Read and filter file contents based on snvindelOptions, cnvOptions, fusionOptions, and svOptions:
 *    - SNV/indel: Filter by total depth, alternate allele count, consequence types, and 5' and 3' flanking sizes
 *    - CNV: Filter by copy number thresholds, max segment length, and 5' and 3' flanking sizes
 *    - Fusion: Filter by 5' and 3' flanking sizes
 *    - SV: Filter by 5' and 3' flanking sizes
 *    - Hypermutator: To be implemented at later date
 * 4. Convert filtered data to lesion format and apply filter caps per type
 * 5. Pass lesion data, device pixel ratio, maxGenesToShow, and cacheFileName to Python for GRIN2 statistical analysis and plot generation (Long term we will make the plot generation be done by rust and just use the cache file of results from python)
 * 6. Return Manhattan plot as base64 string, top gene table, timing information, statistically significant results that are displayed as an interactive svg, and cache file name for future use
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

// Function to generate a unique cache file name for each GRIN2 request
function generateCacheFileName(): string {
	// Generate 16 bytes of random data = 32 hex characters
	const randomHex = crypto.randomBytes(16).toString('hex')
	const cacheFileName = `grin2_results_${randomHex}.txt`
	return path.join(serverconfig.cachedir, 'grin2', cacheFileName)
}

// Function to extract the different data types from the request to pass for python
function getAvailableDataTypes(request: any): string[] {
	const availableOptions: string[] = []

	for (const key in request) {
		if (key.endsWith('Options')) {
			availableOptions.push(key)
		}
	}

	return availableOptions
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
		cacheFileName: generateCacheFileName(),
		availableDataTypes: getAvailableDataTypes(request),
		maxGenesToShow: request.maxGenesToShow
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

	const resultData = JSON.parse(pyResult)

	// Step 5: Prepare Rust input
	const rustInput = {
		file: resultData.cacheFileName,
		type: 'grin2',
		chrSizes: pyInput.chromosomelist,
		plot_width: request.width,
		plot_height: request.height,
		device_pixel_ratio: request.devicePixelRatio,
		png_dot_radius: request.pngDotRadius
	}

	// Step 6: Generate manhattan plot via rust
	const manhattanPlotStart = Date.now()
	const rsResult = await run_rust('manhattan_plot', JSON.stringify(rustInput))
	const manhattanPlotTime = Date.now() - manhattanPlotStart
	const manhattanPlotTimeToPrint = Math.round(manhattanPlotTime / 1000)
	mayLog(`[GRIN2] Manhattan plot generation took ${manhattanPlotTimeToPrint} seconds`)

	const manhattanPlotData = JSON.parse(rsResult)

	// Step 6: Parse results and respond

	// Validate Rust script output
	if (!manhattanPlotData?.png) {
		throw new Error('Invalid Rust output: missing PNG data')
	}

	const totalTime = Math.round((Date.now() - startTime) / 1000)

	const response: GRIN2Response = {
		status: 'success',
		pngImg: manhattanPlotData.png,
		plotData: manhattanPlotData.plot_data,
		topGeneTable: resultData.topGeneTable,
		totalGenes: resultData.totalGenes,
		showingTop: resultData.showingTop,
		timing: {
			processingTime: processingTimeToPrint,
			grin2Time: grin2AnalysisTimeToPrint,
			totalTime: totalTime
		},
		processingSummary: processingSummary,
		cacheFileName: resultData.cacheFileName
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
 * Returns a string array of lesions: [ID, chrom, loc.start, loc.end, lsn.type] and processing summary that now includes detailed stats breakdown
 * We limit the number of lesions per type to avoid overwhelming the production server. The limit is set by MAX_LESIONS_PER_TYPE
 */
async function processSampleData(
	samples: any[],
	ds: any,
	request: GRIN2Request,
	tracker: LesionTracker
): Promise<{ lesions: any[]; processingSummary: GRIN2Response['processingSummary'] }> {
	const lesions: any[] = []

	// Track unique samples per lesion type
	const samplesPerType = new Map<number, Set<string>>()
	for (const [type] of tracker.entries()) {
		samplesPerType.set(type, new Set<string>())
	}

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

			const { sampleLesions, contributedTypes } = await processSampleMlst(sample.name, mlst, request, tracker)
			lesions.push(...sampleLesions)

			// Track samples for each type they contributed to
			for (const type of contributedTypes) {
				samplesPerType.get(type)?.add(sample.name)
			}

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
	const lesionCounts: any = {
		total: lesions.length,
		byType: {}
	}

	// Count lesions by type in a single pass
	const lesionTypeCounts: Record<string, number> = {}
	for (const lesion of lesions) {
		const lesionType = lesion[4] // Get the lesion type from the 5th element
		lesionTypeCounts[lesionType] = (lesionTypeCounts[lesionType] || 0) + 1
	}
	for (const [type, info] of tracker.entries()) {
		const isCapped = info.count >= MAX_LESIONS_PER_TYPE

		switch (type) {
			case dtsnvindel:
				lesionCounts.byType['mutation'] = {
					count: lesionTypeCounts['mutation'] || 0,
					capped: isCapped,
					samples: samplesPerType.get(type)?.size || 0
				}
				break
			case dtcnv: {
				// For CNV, count gains and losses separately but share capped status and sample count
				const sampleCount = samplesPerType.get(type)?.size || 0
				lesionCounts.byType['gain'] = {
					count: lesionTypeCounts['gain'] || 0,
					capped: isCapped,
					samples: sampleCount
				}
				lesionCounts.byType['loss'] = {
					count: lesionTypeCounts['loss'] || 0,
					capped: isCapped,
					samples: sampleCount
				}
				break
			}
			case dtfusionrna:
				lesionCounts.byType['fusion'] = {
					count: lesionTypeCounts['fusion'] || 0,
					capped: isCapped,
					samples: samplesPerType.get(type)?.size || 0
				}
				break
			case dtsv:
				lesionCounts.byType['sv'] = {
					count: lesionTypeCounts['sv'] || 0,
					capped: isCapped,
					samples: samplesPerType.get(type)?.size || 0
				}
				break
		}
	}

	// Add lesionCounts to processingSummary
	processingSummary.lesionCounts = lesionCounts

	return { lesions, processingSummary }
}

/** Process the MLST data for each sample and cap the number of lesions per data type */
async function processSampleMlst(
	sampleName: string,
	mlst: any[],
	request: GRIN2Request,
	tracker: LesionTracker
): Promise<{ sampleLesions: any[]; contributedTypes: Set<number> }> {
	const sampleLesions: any[] = []
	const contributedTypes = new Set<number>()

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
					contributedTypes.add(dtsnvindel)
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
					contributedTypes.add(dtcnv)
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
					contributedTypes.add(dtfusionrna)
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
					contributedTypes.add(dtsv)
				}
				break
			}

			default:
				break
		}
	}

	return { sampleLesions, contributedTypes }
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
	// const flanking5p = options.fivePrimeFlankSize || 0
	// const flanking3p = options.threePrimeFlankSize || 0
	const start = entry.pos
	const end = entry.pos

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
	const start = entry.start
	const end = entry.stop

	return [sampleName, entry.chr, start, end, lesionType]
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

	// First breakpoint on chrA
	const startA = entry.posA
	const endA = entry.posA

	const lesionA: string[] = [sampleName, entry.chrA, startA, endA, 'fusion']

	// Check if there's a second breakpoint on chrB
	if (entry.chrB && entry.posB !== undefined) {
		// Inter-chromosomal fusion or same chromosome with two breakpoints
		const startB = entry.posB
		const endB = entry.posB

		const lesionB: string[] = [sampleName, entry.chrB, startB, endB, 'fusion']

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
	const startA = entry.posA
	const endA = entry.posA

	const lesionA: string[] = [sampleName, entry.chrA, startA, endA, 'sv']

	// Check if there's a second breakpoint on chrB
	if (entry.chrB && entry.posB !== undefined) {
		// Inter-chromosomal SV or same chromosome with two breakpoints
		const startB = entry.posB
		const endB = entry.posB

		const lesionB: string[] = [sampleName, entry.chrB, startB, endB, 'sv']

		// Return both breakpoints as separate lesions
		return [lesionA, lesionB]
	}

	// Only chrA breakpoint available
	return lesionA
}
