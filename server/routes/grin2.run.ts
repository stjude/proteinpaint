import type { GRIN2Request, GRIN2Response, RouteApi } from '#types'
import { GRIN2Payload } from '#types/checkers'
import serverconfig from '#src/serverconfig.js'
import path from 'path'
import { run_python } from '@sjcrh/proteinpaint-python'
import { mayLog } from '#src/helpers.ts'
import fs from 'fs'

/**
 * General GRIN2 analysis handler
 * Processes user-provided MAF, CNV, and fusion files and performs GRIN2 analysis
 *
 * Data Flow:
 * 1. Extract sampleFiles from request with filtering options
 * 2. Process and validate files so they have the expected format for python script
 *    - MAF: TSV with columns like Chromosome, Start_Position, End_Position, etc.
 *    - CNV: SEG format with columns like Chromosome, Start, End, Log2Ratio
 *    - Fusion: TSV/CSV with columns like Gene1, Gene2, Breakpoint1, Breakpoint2
 *    - Each file is processed to extract lesions in the format:
 *      [ID, chrom, loc.start, loc.end, lsn.type]
 *        - ID: Unique lesion ID
 *        - chrom: Chromosome name (e.g., "chr1")
 *        - loc.start: Start position of the lesion
 *        - loc.end: End position of the lesion
 *        - lsn.type: Type of lesion ("mutation", "gain", "loss", "fusion")
 * 3. Read and filter file contents based on mafOptions, cnvOptions, fusionOptions
 * 4. Convert filtered data to lesion format expected by Python script
 * 5. Pass lesion data to Python for GRIN2 statistical analysis and plot generation
 * 6. Return Manhattan plot as base64 string and top gene table
 */

export const api: RouteApi = {
	endpoint: 'grin2/run',
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
			await runGrin2(genomes, req, res)
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

async function runGrin2(genomes: any, req: any, res: any) {
	const startTime = Date.now()

	// Get genome reference (defaulting to hg38)
	const g = genomes.hg38
	if (!g) throw new Error('hg38 genome reference missing')

	const parsedRequest = req.query as GRIN2Request

	// Validate required input
	if (!parsedRequest.sampleFiles || Object.keys(parsedRequest.sampleFiles).length === 0) {
		throw new Error('No sample files provided')
	}

	// Step 1: Process input files and convert to lesion format
	mayLog('[GRIN2] Processing input files...')
	const processingStartTime = Date.now()

	const lesionData = await processInputFiles(parsedRequest)

	const processingTime = Date.now() - processingStartTime
	const processingTimeToPrint = Math.round(processingTime / 1000)
	mayLog(`[GRIN2] File processing took ${processingTimeToPrint} seconds`)

	// Step 2: Prepare input for Python script
	const pyInput = {
		genedb: path.join(serverconfig.tpmasterdir, g.genedb.dbfile),
		chromosomelist: {} as { [key: string]: number },
		lesion: JSON.stringify(lesionData)
	}

	// Build chromosome list from genome reference
	for (const c in g.majorchr) {
		// Skip chrM if needed
		if (c.toLowerCase() === 'chrm') continue
		pyInput.chromosomelist[c] = g.majorchr[c]
	}

	mayLog(`[GRIN2] Prepared ${lesionData.length.toLocaleString()} lesions for analysis`)

	// Step 3: Run GRIN2 analysis via Python
	const grin2AnalysisStart = Date.now()
	const pyResult = await run_python('grin2PpWrapper.py', JSON.stringify(pyInput))

	if (pyResult.stderr?.trim()) {
		mayLog(`[GRIN2] Python stderr: ${pyResult.stderr}`)
	}

	const grin2AnalysisTime = Date.now() - grin2AnalysisStart
	const grin2AnalysisTimeToPrint = Math.round(grin2AnalysisTime / 1000)
	mayLog(`[GRIN2] Python processing took ${grin2AnalysisTimeToPrint} seconds`)

	// Step 4: Parse results and respond
	const resultData = JSON.parse(pyResult.stdout)
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
		}
	}

	res.json(response)
}

/**
 * Process input files and convert to lesion format expected by Python script
 * Returns array of lesions: [ID, chrom, loc.start, loc.end, lsn.type]
 */
async function processInputFiles(request: GRIN2Request): Promise<any[]> {
	const lesions: any[] = []
	let lesionId = 1

	// Process each sample's files
	for (const [sampleId, files] of Object.entries(request.sampleFiles)) {
		mayLog(`[GRIN2] Processing sample: ${sampleId}`)

		// Process MAF files (mutations)
		if (files.maf) {
			const mafLesions = await processMafFile(files.maf, sampleId, lesionId, request.mafOptions)
			lesions.push(...mafLesions)
			lesionId += mafLesions.length
		}

		// Process CNV files (copy number variations)
		if (files.cnv) {
			const cnvLesions = await processCnvFile(files.cnv, sampleId, lesionId, request.cnvOptions)
			lesions.push(...cnvLesions)
			lesionId += cnvLesions.length
		}

		// Process fusion files
		if (files.fusion) {
			const fusionLesions = await processFusionFile(files.fusion, sampleId, lesionId, request.fusionOptions)
			lesions.push(...fusionLesions)
			lesionId += fusionLesions.length
		}
	}

	mayLog(`[GRIN2] Total lesions processed: ${lesions.length.toLocaleString()}`)
	return lesions
}

/**
 * Process MAF (Mutation Annotation Format) file
 * Returns lesions in format: [ID, chrom, loc.start, loc.end, "mutation"]
 */
async function processMafFile(
	filePath: string,
	sampleId: string,
	_startId: number,
	_options?: GRIN2Request['mafOptions']
): Promise<any[]> {
	// Validate file exists
	if (!fs.existsSync(filePath)) {
		throw new Error(`MAF file not found: ${filePath}`)
	}

	const lesions: any[] = []
	// TODO: Implement MAF file parsing logic
	// 1. Read file (TSV format typically)
	// 2. Parse columns (Chromosome, Start_Position, End_Position, etc.)
	// 3. Apply filtering based on options:
	//    - minTotalDepth, minAltAlleleCount
	//    - consequences filter
	//    - hyperMutator threshold
	// 4. Convert to lesion format: [ID, chrom, start, end, "mutation"]

	mayLog(`[GRIN2] TODO: Process MAF file ${filePath} for sample ${sampleId}`)

	// Placeholder - return empty for now
	return lesions
}

/**
 * Process CNV (Copy Number Variation) file
 * Returns lesions in format: [ID, chrom, loc.start, loc.end, "gain"|"loss"]
 */
async function processCnvFile(
	filePath: string,
	sampleId: string,
	_startId: number,
	_options?: GRIN2Request['cnvOptions']
): Promise<any[]> {
	// Validate file exists
	if (!fs.existsSync(filePath)) {
		throw new Error(`CNV file not found: ${filePath}`)
	}

	const lesions: any[] = []
	// TODO: Implement CNV file parsing logic
	// 1. Read file (SEG format)
	// 2. Parse columns (chromosome, start, end, log2ratio/segment_mean)
	// 3. Apply filtering based on options:
	//    - lossThreshold, gainThreshold
	//    - segLength limits
	//    - hyperMutator threshold
	// 4. Convert to lesion format: [ID, chrom, start, end, "gain"|"loss"]

	mayLog(`[GRIN2] TODO: Process CNV file ${filePath} for sample ${sampleId}`)

	// Placeholder - return empty for now
	return lesions
}

/**
 * Process fusion file
 * Returns lesions in format: [ID, chrom, loc.start, loc.end, "fusion"]
 */
async function processFusionFile(
	filePath: string,
	sampleId: string,
	_startId: number,
	_options?: GRIN2Request['fusionOptions']
): Promise<any[]> {
	// Validate file exists
	if (!fs.existsSync(filePath)) {
		throw new Error(`Fusion file not found: ${filePath}`)
	}

	const lesions: any[] = []
	// TODO: Implement fusion file parsing logic
	// 1. Read file (TSV/CSV)
	// 2. Parse columns (gene1, gene2, breakpoints, confidence, etc.)
	// 3. Apply filtering based on options:
	//    - fusionTypes, minConfidence
	// 4. Convert to lesion format: [ID, chrom, start, end, "fusion"]

	mayLog(`[GRIN2] TODO: Process fusion file ${filePath} for sample ${sampleId}`)

	// Placeholder - return empty for now
	return lesions
}
