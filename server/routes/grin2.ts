import type { GRIN2Request, GRIN2Response, RouteApi } from '#types'
import { GRIN2Payload } from '#types/checkers'
import serverconfig from '#src/serverconfig.js'
import path from 'path'
import { run_python } from '@sjcrh/proteinpaint-python'
import { mayLog } from '#src/helpers.ts'
import { get_samples } from '#src/termdb.sql.js'
/**
 * General GRIN2 analysis handler
 * Processes user-provided MAF, CNV, and fusion files and performs GRIN2 analysis
 *
 * Data Flow:
 * 1. Extract samples via the cohort filter
 * 2. Process and validate file paths
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

	// Get dataset for cohort filtering
	const ds = g.datasets.GDC // Whatever dataset is being used (what should I put here?)
	if (!ds) throw new Error('Dataset missing for cohort filtering')

	const request = req.query as GRIN2Request

	// Step 1: Get samples using cohort infrastructure
	mayLog('[GRIN2] Getting samples from cohort filter...')
	const cohortStartTime = Date.now()

	const samples = await get_samples(request.filter || {}, ds)
	const sampleIds = samples.map(sample => sample.id)

	const cohortTime = Date.now() - cohortStartTime
	mayLog(`[GRIN2] Retrieved ${sampleIds.length.toLocaleString()} samples in ${Math.round(cohortTime / 1000)} seconds`)

	if (sampleIds.length === 0) {
		throw new Error('No samples found matching the provided filter criteria')
	}

	// Step 2: Process sample data and convert to lesion format
	mayLog('[GRIN2] Processing sample data...')
	const processingStartTime = Date.now()

	const lesionData = await processSampleData(sampleIds, ds, request)

	const processingTime = Date.now() - processingStartTime
	const processingTimeToPrint = Math.round(processingTime / 1000)
	mayLog(`[GRIN2] Data processing took ${processingTimeToPrint} seconds`)

	// Step 3: Prepare input for Python script
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

	// Step 4: Run GRIN2 analysis via Python
	const grin2AnalysisStart = Date.now()
	const pyResult = await run_python('grin2PpWrapper.py', JSON.stringify(pyInput))

	if (pyResult.stderr?.trim()) {
		mayLog(`[GRIN2] Python stderr: ${pyResult.stderr}`)
		// If there's stderr content, it might indicate an error
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
	if (!resultData.png || !Array.isArray(resultData.png) || !resultData.png[0]) {
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
		}
	}

	res.json(response)
}

/**
 * Process sample data from the cohort and convert to lesion format expected by Python script
 * This will query the dataset for MAF, CNV, and fusion data for the filtered samples
 * Returns array of lesions: [ID, chrom, loc.start, loc.end, lsn.type]
 */
async function processSampleData(sampleIds: string[], ds: any, request: GRIN2Request): Promise<any[]> {
	const lesions: any[] = []
	let lesionId = 1

	mayLog(`[GRIN2] Processing data for ${sampleIds.length.toLocaleString()} samples`)

	// TODO: Query dataset for each data type
	// This will need to be implemented based on how the dataset stores MAF/CNV/fusion data

	// Process MAF data
	if (ds.queries?.singleSampleMutation) {
		const mafLesions = await processCohortMafData(sampleIds, ds, lesionId, request.mafOptions)
		lesions.push(...mafLesions)
		lesionId += mafLesions.length
		mayLog(`[GRIN2] Added ${mafLesions.length.toLocaleString()} mutation lesions`)
	}

	// Process CNV data
	if (ds.queries?.singleSampleGenomeQuantification) {
		const cnvLesions = await processCohortCnvData(sampleIds, ds, lesionId, request.cnvOptions)
		lesions.push(...cnvLesions)
		lesionId += cnvLesions.length
		mayLog(`[GRIN2] Added ${cnvLesions.length.toLocaleString()} CNV lesions`)
	}

	// Process fusion data
	if (ds.queries?.singleSampleFusion) {
		const fusionLesions = await processCohortFusionData(sampleIds, ds, lesionId, request.fusionOptions)
		lesions.push(...fusionLesions)
		lesionId += fusionLesions.length
		mayLog(`[GRIN2] Added ${fusionLesions.length.toLocaleString()} fusion lesions`)
	}
	// TODO: Check what the fusion query type is called in the dataset. Just a placeholder here.

	mayLog(`[GRIN2] Total lesions processed: ${lesions.length.toLocaleString()}`)
	return lesions
}

/**
 * Process MAF data from dataset for the cohort samples
 */
async function processCohortMafData(
	sampleIds: string[],
	ds: any,
	startId: number,
	options?: GRIN2Request['mafOptions']
): Promise<any[]> {
	// Set defaults
	const opts = {
		minTotalDepth: options?.minTotalDepth ?? 10,
		minAltAlleleCount: options?.minAltAlleleCount ?? 2,
		consequences: options?.consequences ?? [],
		hyperMutator: options?.hyperMutator ?? 1000
	}

	const lesions: any[] = []

	// TODO: Implement querying the dataset for mutation data
	// This will depend on the dataset structure and query methods available
	// Example structure:
	// const mutationQuery = {
	//   sampleIds: sampleIds,
	//   filters: {
	//     totalDepth: { $gte: opts.minTotalDepth },
	//     altAlleleCount: { $gte: opts.minAltAlleleCount }
	//   }
	// }
	// const mutations = await ds.queries.singleSampleMutation.getData(mutationQuery)

	mayLog(`[GRIN2] TODO: Query dataset for MAF data with options:`, opts)

	// Placeholder - return empty for now
	return lesions
}

/**
 * Process CNV data from dataset for the cohort samples
 */
async function processCohortCnvData(
	sampleIds: string[],
	ds: any,
	startId: number,
	options?: GRIN2Request['cnvOptions']
): Promise<any[]> {
	// Set defaults
	const opts = {
		lossThreshold: options?.lossThreshold ?? -0.4,
		gainThreshold: options?.gainThreshold ?? 0.3,
		SegmentLength: options?.segLength ?? 0,
		hyperMutator: options?.hyperMutator ?? 500
	}

	const lesions: any[] = []

	// TODO: Implement querying the dataset for CNV data
	// This will depend on the dataset structure and query methods available
	// Example structure:
	// const cnvQuery = {
	//   sampleIds: sampleIds,
	//   filters: {
	//     log2Ratio: { $lte: opts.lossThreshold, $gte: opts.gainThreshold }
	//   }
	// }
	// const cnvs = await ds.queries.singleSampleGenomeQuantification.getData(cnvQuery)

	mayLog(`[GRIN2] TODO: Query dataset for CNV data with options:`, opts)

	// Placeholder - return empty for now
	return lesions
}

/**
 * Process fusion data from dataset for the cohort samples
 */
async function processCohortFusionData(
	sampleIds: string[],
	ds: any,
	startId: number,
	options?: GRIN2Request['fusionOptions']
): Promise<any[]> {
	// Set defaults
	const opts = {
		fusionTypes: options?.fusionTypes ?? ['gene-gene', 'gene-intergenic', 'readthrough'],
		minConfidence: options?.minConfidence ?? 0.7
	}

	const lesions: any[] = []

	// TODO: Implement querying the dataset for fusion data
	mayLog(`[GRIN2] TODO: Query dataset for fusion data with options:`, opts)

	// Placeholder - return empty for now
	return lesions
}
