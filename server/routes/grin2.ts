import type { GRIN2Request, GRIN2Response, RouteApi } from '#types'
import { GRIN2Payload } from '#types/checkers'
import serverconfig from '#src/serverconfig.js'
import path from 'path'
import { run_python } from '@sjcrh/proteinpaint-python'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import { mayLog } from '#src/helpers.ts'
import os from 'os'
import { get_samples } from '#src/termdb.sql.js'
import { read_file, file_is_readable } from '#src/utils.js'
import { dtsnvindel, dtcnv, dtfusionrna, dtsv, dt2lesion, optionToDt, formatElapsedTime } from '#shared'
import crypto from 'crypto'
import { promisify } from 'node:util'
import { exec as execCallback } from 'node:child_process'

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
 *    - SNV/indel: Filter by total depth, alternate allele count, consequence types, and 5' and 3' flanking sizes
 *    - CNV: Filter by copy number thresholds, max segment length, and 5' and 3' flanking sizes
 *    - Fusion: Filter by 5' and 3' flanking sizes
 *    - SV: Filter by 5' and 3' flanking sizes
 *    - Hypermutator: To be implemented at later date
 * 4. Convert filtered data to lesion format and apply overall lesion cap
 * 5. Pass lesion data, maxGenesToShow, and cacheFileName to Python for GRIN2 statistical analysis and then pass device pixel ratio, width, and height to Rust for plot generation
 * 6. Return Manhattan plot from Rust as base64 string, top gene table, timing information, statistically significant results that are displayed as an interactive svg, and cache file name for future use
 */

// Constants & types
const MAX_LESIONS = serverconfig.features.grin2maxLesions || 250000 // Maximum total number of lesions to process to avoid overwhelming the production server
const GRIN2_MEMORY_BUDGET_MB = 950
const GRIN2_CONCURRENCY_LIMIT = 10
const MEMORY_BASE_MB = 260
const MEMORY_PER_1K_LESIONS = 2.4
const MIN_LESIONS = 50000

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

			const result = await runGrin2WithLimit(g, ds, request)
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

// =============================================================================
// CONCURRENCY and MEMORY MANAGEMENT
// =============================================================================

const exec = promisify(execCallback)

async function getAvailableMemoryMB(): Promise<number> {
	try {
		if (process.platform === 'darwin') {
			// macOS: use vm_stat
			const { stdout } = await exec('vm_stat')
			const output = stdout.toString()

			// Parse page size from vm_stat header: "page size of 4096 bytes for Apple silicon, 16384 bytes for Intel macs"
			const headerLine = output.split('\n')[0] || ''
			const pageSizeMatch = headerLine.match(/page size of\s+(\d+)\s+bytes/i)
			const pageSize = pageSizeMatch ? parseInt(pageSizeMatch[1], 10) : 16384
			const freeMatch = output.match(/Pages free:\s+(\d+)/)
			const inactiveMatch = output.match(/Pages inactive:\s+(\d+)/)
			const freePages = freeMatch ? parseInt(freeMatch[1], 10) : 0
			const inactivePages = inactiveMatch ? parseInt(inactiveMatch[1], 10) : 0

			// Available ≈ free + inactive
			return ((freePages + inactivePages) * pageSize) / (1024 * 1024)
		} else {
			// Linux: use free command
			const { stdout } = await exec('free -m')
			const output = stdout.toString()
			const lines = output.split('\n')
			const memLine = lines.find(l => l.startsWith('Mem:'))
			if (memLine) {
				const parts = memLine.split(/\s+/)
				return parseInt(parts[6]) // "available" column
			}
		}
	} catch (e) {
		mayLog(`[GRIN2] Memory check failed, using fallback: ${e}`)
	}

	// Fallback: os.freemem (less accurate but always works)
	return os.freemem() / (1024 * 1024)
}

async function getMaxLesions(): Promise<number> {
	const availableMemoryMB = await getAvailableMemoryMB()
	mayLog(`[GRIN2] Available system memory: ${availableMemoryMB.toFixed(0)} MB`)

	// If server is under heavy load, reduce lesion cap. Our calculation assumes each 1,000 lesions use ~2.4MB of memory plus a base overhead (i.e. a linear relationship).
	if (availableMemoryMB < GRIN2_MEMORY_BUDGET_MB * 2) {
		const reducedBudget = availableMemoryMB * 0.4
		mayLog(`[GRIN2] Reducing lesion cap due to memory constraints. New budget: ${reducedBudget.toFixed(2)} MB`)
		const calculated = Math.floor((reducedBudget - MEMORY_BASE_MB) / MEMORY_PER_1K_LESIONS) * 1000
		mayLog(`[GRIN2] Calculated lesion cap based on memory: ${calculated.toLocaleString()}`)
		return Math.max(MIN_LESIONS, Math.min(MAX_LESIONS, calculated))
	}

	return MAX_LESIONS
}

let activeGrin2Jobs = 0

async function runGrin2WithLimit(g: any, ds: any, request: GRIN2Request): Promise<GRIN2Response> {
	if (activeGrin2Jobs >= GRIN2_CONCURRENCY_LIMIT) {
		const error: any = new Error(
			`GRIN2 analysis queue is full (${GRIN2_CONCURRENCY_LIMIT} concurrent analyses). Please try again in a few minutes.`
		)

		// Explicitly set status code for rate limiting so we ensure this error doesn't get cached
		error.status = 429
		error.statusCode = 429
		throw error
	}

	activeGrin2Jobs++
	mayLog(`[GRIN2] Starting analysis. Active jobs: ${activeGrin2Jobs}/${GRIN2_CONCURRENCY_LIMIT}`)

	try {
		return await runGrin2(g, ds, request)
	} finally {
		activeGrin2Jobs--
		mayLog(`[GRIN2] Analysis complete. Active jobs: ${activeGrin2Jobs}/${GRIN2_CONCURRENCY_LIMIT}`)
	}
}

// Function to generate a unique cache file name for each GRIN2 request
function generateCacheFileName(): string {
	// Generate 16 bytes of random data = 32 hex characters
	const randomHex = crypto.randomBytes(16).toString('hex')
	const cacheFileName = `grin2_results_${randomHex}.txt`
	return path.join(serverconfig.cachedir, 'grin2', cacheFileName)
}

// Building the lesion map to send to python
function buildLesionTypeMap(availableOptions: string[]): Record<string, string> {
	const lesionTypeMap: Record<string, string> = {}

	for (const option of availableOptions) {
		const dt = optionToDt[option]
		if (!dt || !dt2lesion[dt]) continue

		dt2lesion[dt].lesionTypes.forEach(lt => {
			lesionTypeMap[lt.lesionType] = lt.name
		})
	}

	return lesionTypeMap
}

// Function to get CNV lesion type based on gain or loss in a more robust way
function getCnvLesionType(isGain: boolean): string {
	const cnvConfig = dt2lesion[dtcnv]
	const targetName = isGain ? 'Gain' : 'Loss'

	const lesionType = cnvConfig.lesionTypes.find(lt => lt.name === targetName)
	if (!lesionType) {
		throw new Error(`CNV lesion type '${targetName}' not found`)
	}

	return lesionType.lesionType
}

async function runGrin2(g: any, ds: any, request: GRIN2Request): Promise<GRIN2Response> {
	const startTime = Date.now()

	// Step 1: Get samples using cohort infrastructure
	const samples = await get_samples(
		request,
		ds,
		true // must set to true to return sample name to be able to access file. FIXME this can let names revealed to grin2 client, may need to apply access control
	)

	const cohortTime = Date.now() - startTime
	mayLog(`[GRIN2] Retrieved ${samples.length.toLocaleString()} samples in ${formatElapsedTime(cohortTime)}`)

	if (samples.length === 0) {
		throw new Error('No samples found matching the provided filter criteria')
	}

	// Step 2: Process sample data, convert to lesion format, and apply overall lesion cap
	const processingStartTime = Date.now()

	const { lesions, processingSummary } = await processSampleData(samples, ds, request)

	const processingTime = Date.now() - processingStartTime
	mayLog(`[GRIN2] Data processing took ${formatElapsedTime(processingTime)}`)
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
	const availableDataTypes = Object.keys(optionToDt).filter(key => key in request)

	const pyInput = {
		genedb: path.join(serverconfig.tpmasterdir, g.genedb.dbfile),
		chromosomelist: {} as { [key: string]: number },
		lesion: JSON.stringify(lesions),
		cacheFileName: generateCacheFileName(),
		availableDataTypes: availableDataTypes,
		maxGenesToShow: request.maxGenesToShow,
		lesionTypeMap: buildLesionTypeMap(availableDataTypes),
		trackMemory: request.trackMemory
	}

	// Build chromosome list from genome reference
	for (const c in g.majorchr) {
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
	mayLog(`[GRIN2] Python processing took ${formatElapsedTime(grin2AnalysisTime)}`)

	const resultData = JSON.parse(pyResult)

	// Step 5: Prepare Rust input
	const rustInput = {
		file: resultData.cacheFileName,
		type: 'grin2',
		chrSizes: pyInput.chromosomelist,
		plot_width: request.width,
		plot_height: request.height,
		device_pixel_ratio: request.devicePixelRatio,
		png_dot_radius: request.pngDotRadius,
		lesion_type_colors: request.lesionTypeColors,
		q_value_threshold: request.qValueThreshold,
		max_capped_points: request.maxCappedPoints,
		hard_cap: request.hardCap,
		bin_size: request.binSize
	}

	// Step 6: Generate manhattan plot via rust
	const manhattanPlotStart = Date.now()
	const rsResult = await run_rust('manhattan_plot', JSON.stringify(rustInput))
	const manhattanPlotTime = Date.now() - manhattanPlotStart
	mayLog(`[GRIN2] Manhattan plot generation took ${formatElapsedTime(manhattanPlotTime)}`)

	const manhattanPlotData = JSON.parse(rsResult)

	// Step 6: Parse results and respond

	// Validate Rust script output
	if (!manhattanPlotData?.png) {
		throw new Error('Invalid Rust output: missing PNG data')
	}

	const totalTime = processingTime + grin2AnalysisTime + manhattanPlotTime

	const response: GRIN2Response = {
		status: 'success',
		pngImg: manhattanPlotData.png,
		plotData: manhattanPlotData.plot_data,
		topGeneTable: resultData.topGeneTable,
		totalGenes: resultData.totalGenes,
		showingTop: resultData.showingTop,
		timing: {
			processingTime: formatElapsedTime(processingTime),
			grin2Time: formatElapsedTime(grin2AnalysisTime),
			plottingTime: formatElapsedTime(manhattanPlotTime),
			totalTime: formatElapsedTime(totalTime)
		},
		processingSummary: processingSummary,
		cacheFileName: resultData.cacheFileName,
		memoryProfile: resultData.memoryProfile
	}

	return response
}

/**
 * Process sample data by reading per-sample JSON files and converting to lesion format
 * Each sample has a JSON file containing mutation data (mlst array)
 * Returns a string array of lesions: [ID, chrom, loc.start, loc.end, lsn.type] and processing summary
 * We limit the total number of lesions to avoid overwhelming the production server. The limit is set by MAX_LESIONS
 */
async function processSampleData(
	samples: any[],
	ds: any,
	request: GRIN2Request
): Promise<{ lesions: any[]; processingSummary: GRIN2Response['processingSummary'] }> {
	const lesions: any[] = []
	const maxLesions = await getMaxLesions()
	mayLog(`[GRIN2] Max lesions for this run: ${maxLesions.toLocaleString()}`)

	// Track unique samples per lesion type for reporting
	const samplesPerType = new Map<number, Set<string>>()
	const enabledTypes: number[] = []
	if (request.snvindelOptions) enabledTypes.push(dtsnvindel)
	if (request.cnvOptions) enabledTypes.push(dtcnv)
	if (request.fusionOptions) enabledTypes.push(dtfusionrna)
	if (request.svOptions) enabledTypes.push(dtsv)

	for (const type of enabledTypes) {
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

	for (let i = 0; i < samples.length; i++) {
		if (lesions.length >= maxLesions) {
			const remaining = samples.length - i
			if (remaining > 0) processingSummary.unprocessedSamples! += remaining
			mayLog(`[GRIN2] Overall lesion cap (${maxLesions}) reached; stopping early.`)
			break
		}

		const sample = samples[i]
		const filepath = path.join(serverconfig.tpmasterdir, ds.queries.singleSampleMutation.folder, sample.name)

		try {
			await file_is_readable(filepath)
			const mlst = JSON.parse(await read_file(filepath))

			const { sampleLesions, contributedTypes } = processSampleMlst(sample.name, mlst, request)

			// Filter out chrM lesions
			const skipChrM = ds.queries.singleSampleMutation.discoPlot?.skipChrM
			const filteredLesions = skipChrM
				? sampleLesions.filter(lesion => lesion[1].toLowerCase() !== 'chrm')
				: sampleLesions

			// Only add lesions up to the cap
			const remainingCapacity = maxLesions - lesions.length
			const lesionsToAdd = filteredLesions.slice(0, remainingCapacity)
			lesions.push(...lesionsToAdd)

			// Track samples for each type they contributed to
			for (const type of contributedTypes) {
				samplesPerType.get(type)?.add(sample.name)
			}

			processingSummary.processedSamples! += 1
			processingSummary.totalLesions! += filteredLesions.length
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
	processingSummary.lesionCap = maxLesions

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
		const sampleCount = samplesPerType.get(type)?.size || 0
		const dtConfig = dt2lesion[type]

		if (!dtConfig) continue

		dtConfig.lesionTypes.forEach(lt => {
			lesionCounts.byType[lt.lesionType] = {
				count: lesionTypeCounts[lt.lesionType] || 0,
				samples: sampleCount
			}
		})
	}

	processingSummary.lesionCounts = lesionCounts

	return { lesions, processingSummary }
}

/** Process the MLST data for each sample - no per-type caps, just filter and convert */
function processSampleMlst(
	sampleName: string,
	mlst: any[],
	request: GRIN2Request
): { sampleLesions: any[]; contributedTypes: Set<number> } {
	const sampleLesions: any[] = []
	const contributedTypes = new Set<number>()

	for (const m of mlst) {
		switch (m.dt) {
			case dtsnvindel: {
				if (!request.snvindelOptions) break

				const les = filterAndConvertSnvIndel(sampleName, m, request.snvindelOptions)
				if (les) {
					sampleLesions.push(les)
					contributedTypes.add(dtsnvindel)
				}
				break
			}

			case dtcnv: {
				if (!request.cnvOptions) break

				const les = filterAndConvertCnv(sampleName, m, request.cnvOptions)
				if (les) {
					sampleLesions.push(les)
					contributedTypes.add(dtcnv)
				}
				break
			}

			case dtfusionrna: {
				if (!request.fusionOptions) break

				const les = filterAndConvertFusion(sampleName, m, request.fusionOptions)
				if (les) {
					// Add all lesions (breakpoints) to the list
					if (Array.isArray(les[0])) {
						// Multiple lesions (two breakpoints)
						for (const lesion of les as string[][]) {
							sampleLesions.push(lesion)
						}
					} else {
						// Single lesion
						sampleLesions.push(les)
					}
					contributedTypes.add(dtfusionrna)
				}
				break
			}

			case dtsv: {
				if (!request.svOptions) break

				const les = filterAndConvertSV(sampleName, m, request.svOptions)
				if (les) {
					// Add all lesions (breakpoints) to the list
					if (Array.isArray(les[0])) {
						// Multiple lesions (two breakpoints)
						for (const lesion of les as string[][]) {
							sampleLesions.push(lesion)
						}
					} else {
						// Single lesion
						sampleLesions.push(les)
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

	return [sampleName, entry.chr, start, end, dt2lesion[dtsnvindel].lesionTypes[0].lesionType]
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
	const lesionType = getCnvLesionType(isGain)

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

	const lesionA: string[] = [sampleName, entry.chrA, startA, endA, dt2lesion[dtfusionrna].lesionTypes[0].lesionType]

	// Check if there's a second breakpoint on chrB
	if (entry.chrB && entry.posB !== undefined) {
		// Inter-chromosomal fusion or same chromosome with two breakpoints
		const startB = entry.posB
		const endB = entry.posB

		const lesionB: string[] = [sampleName, entry.chrB, startB, endB, dt2lesion[dtfusionrna].lesionTypes[0].lesionType]

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

	const lesionA: string[] = [sampleName, entry.chrA, startA, endA, dt2lesion[dtsv].lesionTypes[0].lesionType]

	// Check if there's a second breakpoint on chrB
	if (entry.chrB && entry.posB !== undefined) {
		// Inter-chromosomal SV or same chromosome with two breakpoints
		const startB = entry.posB
		const endB = entry.posB

		const lesionB: string[] = [sampleName, entry.chrB, startB, endB, dt2lesion[dtsv].lesionTypes[0].lesionType]

		// Return both breakpoints as separate lesions
		return [lesionA, lesionB]
	}

	// Only chrA breakpoint available
	return lesionA
}
