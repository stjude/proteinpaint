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
 *    - CNV: Filter by copy number thresholds and segment lengths
 *    - Fusion: Filter by fusion type and confidence score
 *    - Hypermutator: Apply a maximum mutation count cutoff for highly mutated samples
 * 4. Convert filtered data to lesion format expected by Python script
 * 5. Pass lesion data to Python for GRIN2 statistical analysis and plot generation
 * 6. Return Manhattan plot as base64 string, top gene table, and timing information
 */

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
			// Debug logging
			console.log('[GRIN2] req.method:', req.method)
			console.log('[GRIN2] req.body:', req.body)
			console.log('[GRIN2] req.query:', req.query)
			console.log('[GRIN2] req.headers:', req.headers)

			const request = req.query as GRIN2Request
			// const request = req.body as GRIN2Request

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

// function init({ genomes }) {
//     return async (req: any, res: any): Promise<void> => {
//         try {
//             // Parse JSON strings back to objects
//             const request: GRIN2Request = {
//                 genome: req.query.genome,
//                 dslabel: req.query.dslabel,
//                 filter: req.query.filter ? JSON.parse(req.query.filter) : undefined,
//                 snvindelOptions: req.query.snvindelOptions ? JSON.parse(req.query.snvindelOptions) : undefined,
//                 cnvOptions: req.query.cnvOptions ? JSON.parse(req.query.cnvOptions) : undefined
//             }

//             const g = genomes[request.genome]
//             if (!g) throw new Error('genome missing')

//             const ds = g.datasets?.[request.dslabel]
//             if (!ds) throw new Error('ds missing')

//             if (!ds.queries?.singleSampleMutation) throw new Error('singleSampleMutation query missing from dataset')

//             const result = await runGrin2(g, ds, request)
//             res.json(result)
//         } catch (e: any) {
//             console.error('[GRIN2] Error stack:', e.stack)

//             const errorResponse: GRIN2Response = {
//                 status: 'error',
//                 error: e.message || String(e)
//             }

//             res.status(500).send(errorResponse)
//         }
//     }
// }

async function runGrin2(g: any, ds: any, request: GRIN2Request): Promise<GRIN2Response> {
	const startTime = Date.now()

	// Step 1: Get samples using cohort infrastructure
	mayLog('[GRIN2] Getting samples from cohort filter...')

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

	// Step 2: Process sample data and convert to lesion format
	mayLog('[GRIN2] Processing sample data...')
	const processingStartTime = Date.now()

	const { lesionData, processingSummary } = await processSampleData(samples, ds, request)

	const processingTime = Date.now() - processingStartTime
	const processingTimeToPrint = Math.round(processingTime / 1000)
	mayLog(`[GRIN2] Data processing took ${processingTimeToPrint} seconds`)
	mayLog(
		`[GRIN2] Processing summary: ${processingSummary?.successfulSamples ?? 0}/${
			processingSummary?.totalSamples ?? samples.length
		} samples processed successfully`
	)

	if (processingSummary && processingSummary.failedSamples > 0) {
		mayLog(`[GRIN2] Warning: ${processingSummary.failedSamples} samples failed to process`)
	}

	if (lesionData.length === 0) {
		throw new Error('No lesions found after processing all samples. Check filter criteria and input data.')
	}

	// Step 3: Prepare input for Python script
	const pyInput = {
		genedb: path.join(serverconfig.tpmasterdir, g.genedb.dbfile),
		chromosomelist: {} as { [key: string]: number },
		lesion: JSON.stringify(lesionData)
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

	mayLog(`[GRIN2] Prepared ${lesionData.length.toLocaleString()} lesions for analysis`)

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
	const resultData = JSON.parse(pyResult.stdout)

	// Validate Python script output
	if (!resultData?.png?.[0]) {
		throw new Error('Invalid Python output: missing PNG data')
	}

	const totalTime = Math.round((Date.now() - startTime) / 1000)

	const response: GRIN2Response = {
		status: 'success',
		pngImg: resultData.png[0],
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

/**
 * Process sample data by reading per-sample JSON files and converting to lesion format
 * Each sample has a JSON file containing mutation data (mlst array)
 * Returns a string array of lesions: [ID, chrom, loc.start, loc.end, lsn.type] and processing summary
 */
async function processSampleData(
	samples: any[],
	ds: any,
	request: GRIN2Request
): Promise<{ lesionData: string[]; processingSummary: GRIN2Response['processingSummary'] }> {
	const lesions: string[] = []
	let lesionId = 1

	// Initialize processing summary
	const processingSummary: GRIN2Response['processingSummary'] = {
		totalSamples: samples.length,
		successfulSamples: 0,
		failedSamples: 0,
		failedFiles: []
	}

	// Track data type counts
	const dataTypeCounts = {
		[dtsnvindel]: { samples: 0, entries: 0, processedLesions: 0 },
		[dtcnv]: { samples: 0, entries: 0, processedLesions: 0 },
		[dtfusionrna]: { samples: 0, entries: 0, processedLesions: 0 },
		unknown: new Map<string, { samples: Set<string>; entries: number }>()
	}

	mayLog(`[GRIN2] Processing JSON files for ${samples.length.toLocaleString()} samples`)

	// Process each sample's JSON file
	for (const sample of samples) {
		try {
			const filepath = path.join(serverconfig.tpmasterdir, ds.queries.singleSampleMutation.folder, sample.name)
			await file_is_readable(filepath)
			const mlst = JSON.parse(await read_file(filepath))

			const { sampleLesions, sampleDataTypeCounts } = await processSampleMlst(sample.name, mlst, lesionId, request)
			lesions.push(...sampleLesions)
			lesionId += sampleLesions.length

			// Aggregate counts
			for (const [dt, counts] of Object.entries(sampleDataTypeCounts.known)) {
				if (counts.entries > 0) {
					dataTypeCounts[dt].samples++
					dataTypeCounts[dt].entries += counts.entries
					dataTypeCounts[dt].processedLesions += counts.processedLesions
				}
			}

			// Handle unknown data types
			for (const [dt, counts] of sampleDataTypeCounts.unknown) {
				if (!dataTypeCounts.unknown.has(dt)) {
					dataTypeCounts.unknown.set(dt, { samples: new Set(), entries: 0 })
				}
				dataTypeCounts.unknown.get(dt)!.samples.add(sample.name)
				dataTypeCounts.unknown.get(dt)!.entries += counts
			}

			processingSummary.successfulSamples++
		} catch (error) {
			processingSummary.failedSamples++
			processingSummary.failedFiles?.push(sample.name)

			mayLog(
				`[GRIN2] Error processing sample ${sample.name}: ${
					typeof error === 'object' && error !== null && 'message' in error
						? (error as { message?: string }).message
						: String(error)
				}`
			)
		}
	}

	// Report final counts
	mayLog(`[GRIN2] === DATA TYPE ANALYSIS SUMMARY ===`)
	mayLog(
		`[GRIN2] SNV/Indel (dt=${dtsnvindel}): ${dataTypeCounts[dtsnvindel].samples} samples, ${dataTypeCounts[dtsnvindel].entries} entries, ${dataTypeCounts[dtsnvindel].processedLesions} lesions`
	)
	mayLog(
		`[GRIN2] CNV (dt=${dtcnv}): ${dataTypeCounts[dtcnv].samples} samples, ${dataTypeCounts[dtcnv].entries} entries, ${dataTypeCounts[dtcnv].processedLesions} lesions`
	)
	mayLog(
		`[GRIN2] Fusion (dt=${dtfusionrna}): ${dataTypeCounts[dtfusionrna].samples} samples, ${dataTypeCounts[dtfusionrna].entries} entries, ${dataTypeCounts[dtfusionrna].processedLesions} lesions`
	)

	if (dataTypeCounts.unknown.size > 0) {
		mayLog(`[GRIN2] Unknown data types:`)
		for (const [dt, counts] of dataTypeCounts.unknown) {
			mayLog(`[GRIN2]   dt="${dt}": ${counts.samples.size} samples, ${counts.entries} entries`)
		}
	}
	mayLog(`[GRIN2] Total lesions processed: ${lesions.length.toLocaleString()}`)

	return {
		lesionData: lesions,
		processingSummary: processingSummary
	}
}

async function processSampleMlst(
	sampleName: string,
	mlst: any[],
	startId: number,
	request: GRIN2Request
): Promise<{
	sampleLesions: string[]
	sampleDataTypeCounts: {
		known: { [key: string]: { entries: number; processedLesions: number } }
		unknown: Map<string, number>
	}
}> {
	const lesions: any[] = []

	// Track counts for this sample
	const sampleDataTypeCounts = {
		known: {
			[dtsnvindel]: { entries: 0, processedLesions: 0 },
			[dtcnv]: { entries: 0, processedLesions: 0 },
			[dtfusionrna]: { entries: 0, processedLesions: 0 }
		},
		unknown: new Map<string, number>()
	}

	// Process each entry in mlst based on its data type
	for (const m of mlst) {
		switch (m.dt) {
			case dtsnvindel: {
				sampleDataTypeCounts.known[dtsnvindel].entries++
				if (!request.snvindelOptions) break
				const snvIndelLesion = filterAndConvertSnvIndel(sampleName, m, request.snvindelOptions)
				if (snvIndelLesion) {
					lesions.push(snvIndelLesion)
					sampleDataTypeCounts.known[dtsnvindel].processedLesions++
				}
				break
			}
			case dtcnv: {
				sampleDataTypeCounts.known[dtcnv].entries++
				if (!request.cnvOptions) break
				const cnvLesion = filterAndConvertCnv(sampleName, m, request.cnvOptions)
				if (cnvLesion) {
					lesions.push(cnvLesion)
					sampleDataTypeCounts.known[dtcnv].processedLesions++
				}
				break
			}
			case dtfusionrna: {
				sampleDataTypeCounts.known[dtfusionrna].entries++
				if (!request.fusionOptions) break
				const fusionLesion = filterAndConvertFusion(sampleName, m, request.fusionOptions)
				if (fusionLesion) {
					lesions.push(fusionLesion)
					sampleDataTypeCounts.known[dtfusionrna].processedLesions++
				}
				break
			}
			default: {
				// Track unknown data types
				const currentCount = sampleDataTypeCounts.unknown.get(m.dt) || 0
				sampleDataTypeCounts.unknown.set(m.dt, currentCount + 1)
				break
			}
		}
	}

	return {
		sampleLesions: lesions,
		sampleDataTypeCounts
	}
}

function filterAndConvertSnvIndel(
	sampleName: string,
	entry: any,
	options: GRIN2Request['snvindelOptions']
): string[] | null {
	const opts = {
		minTotalDepth: options?.minTotalDepth ?? 10,
		minAltAlleleCount: options?.minAltAlleleCount ?? 2,
		consequences: options?.consequences ?? [],
		hyperMutator: options?.hyperMutator ?? 1000
	}

	// Check consequence filtering
	if (opts.consequences.length > 0 && entry.class && !opts.consequences.includes(entry.class)) {
		return null
	}

	// Check required fields - handle multiple possible field names
	const chromosome = entry.chromosome || entry.chr
	const position = entry.start || entry.position || entry.pos

	if (!chromosome) {
		return null
	}

	if (position === undefined || position === null || position === 'undefined') {
		return null
	}

	// Ensure position is numeric
	const numPosition = parseInt(String(position))
	if (isNaN(numPosition)) {
		return null
	}

	const endPosition = entry.end || position
	const numEndPosition = parseInt(String(endPosition))
	if (isNaN(numEndPosition)) {
		return null
	}

	return [sampleName, normalizeChromosome(chromosome), String(numPosition), String(numEndPosition), 'mutation']
}

function filterAndConvertCnv(sampleName: string, entry: any, options: GRIN2Request['cnvOptions']): string[] | null {
	const opts = {
		lossThreshold: options?.lossThreshold ?? -0.4,
		gainThreshold: options?.gainThreshold ?? 0.3,
		maxSegLength: options?.maxSegLength ?? 0,
		minSegLength: options?.minSegLength ?? 0,
		hyperMutator: options?.hyperMutator ?? 500
	}

	// Handle multiple possible field names for log2 ratio
	const log2Ratio = entry.log2Ratio ?? entry.value ?? entry.ratio

	if (log2Ratio === undefined || log2Ratio === null) {
		return null
	}

	// Ensure log2Ratio is numeric
	const numLog2Ratio = parseFloat(String(log2Ratio))
	if (isNaN(numLog2Ratio)) {
		return null
	}

	// Must be either gain or loss
	const isGain = numLog2Ratio >= opts.gainThreshold
	const isLoss = numLog2Ratio <= opts.lossThreshold
	if (!isGain && !isLoss) {
		return null
	}

	// Check required fields
	const chromosome = entry.chromosome || entry.chr
	const start = entry.start || entry.begin
	const end = entry.end || entry.stop

	if (!chromosome) {
		return null
	}

	if (start === undefined || start === null || start === 'undefined') {
		return null
	}

	if (end === undefined || end === null || end === 'undefined') {
		return null
	}

	// Ensure positions are numeric
	const numStart = parseInt(String(start))
	const numEnd = parseInt(String(end))

	if (isNaN(numStart) || isNaN(numEnd)) {
		return null
	}

	const lesionType = numLog2Ratio >= opts.gainThreshold ? 'gain' : 'loss'
	return [sampleName, normalizeChromosome(chromosome), String(numStart), String(numEnd), lesionType]
}

/**
 * Filter and convert a single fusion entry to lesion format
 * Returns lesion array or null if filtered out
 */
function filterAndConvertFusion(
	sampleName: string,
	entry: any,
	options: GRIN2Request['fusionOptions']
): string[] | null {
	// Set defaults
	const opts = {
		fusionTypes: options?.fusionTypes ?? ['gene-gene', 'gene-intergenic', 'readthrough'],
		minConfidence: options?.minConfidence ?? 0.7
	}

	// Apply fusion type filter
	if (entry.fusionType && !opts.fusionTypes.includes(entry.fusionType)) return null

	// Apply confidence filter
	if (entry.confidence && entry.confidence < opts.minConfidence) return null

	// Convert to lesion format: [ID, chrom, loc.start, loc.end, lsn.type]
	return [
		sampleName,
		normalizeChromosome(entry.chromosome || entry.chr),
		String(entry.start || entry.position),
		String(entry.end || entry.position),
		'fusion'
	]
}

/**
 * Normalize chromosome name to include 'chr' prefix
 */
function normalizeChromosome(chrom: string | undefined): string {
	if (!chrom) return 'chr?' // Handle undefined case
	return chrom.startsWith('chr') ? chrom : `chr${chrom}`
}
