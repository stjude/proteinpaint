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
 * 4. Convert filtered data to lesion format expected by Python script
 * 5. Pass lesion data and device pixel ratio to Python for GRIN2 statistical analysis and plot generation
 * 6. Return Manhattan plot as base64 string, top gene table, timing information, and statistically significant results that are displayed as an interactive svg
 */

// Constants
const MAX_LESIONS_PER_TYPE = 10000 // Maximum number of lesions to process per type to avoid overwhelming the production server

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
			console.log('[GRIN2] request:', request)

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

	mayLog('[GRIN2] Prepared input for Python script:', { ...pyInput })

	// Build chromosome list from genome reference
	for (const c in g.majorchr) {
		// List is short so a small penalty for accessing the flag in the loop
		if (ds.queries.singleSampleMutation.discoPlot?.skipChrM) {
			// Skip chrM; this property is set in gdc ds but still assess it to avoid hardcoding the logic, in case code maybe reused for non-gdc ds
			if (c.toLowerCase() == 'chrm') continue
		}
		pyInput.chromosomelist[c] = g.majorchr[c]
	}

	// mayLog(`[GRIN2] Prepared ${processedLesions.toLocaleString()} lesions for analysis`)

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
	const lesions: any[] = []
	let lesionId = 1

	const keptByType: Record<'mutation' | 'gain' | 'loss', number> = { mutation: 0, gain: 0, loss: 0 }
	const warnedTypes = new Set<'mutation' | 'gain' | 'loss'>()

	const processingSummary: GRIN2Response['processingSummary'] = {
		totalSamples: samples.length,
		processedSamples: 0,
		failedSamples: 0,
		failedFiles: [],
		totalLesions: 0,
		processedLesions: 0
	}

	const allTypesCapped = () =>
		keptByType.mutation >= MAX_LESIONS_PER_TYPE &&
		keptByType.gain >= MAX_LESIONS_PER_TYPE &&
		keptByType.loss >= MAX_LESIONS_PER_TYPE

	mayLog(`[GRIN2] Processing JSON files for ${samples.length.toLocaleString()} samples`)

	outer: for (const sample of samples) {
		// If fully capped, don’t even open more files
		if (allTypesCapped()) {
			mayLog('[GRIN2] All per-type caps reached; stopping early.')
			break outer
		}

		const filepath = path.join(serverconfig.tpmasterdir, ds.queries.singleSampleMutation.folder, sample.name)

		try {
			await file_is_readable(filepath)
			const mlst = JSON.parse(await read_file(filepath))

			const { sampleLesions } = await processSampleMlst(sample.name, mlst, lesionId, request, keptByType, warnedTypes)

			lesions.push(...sampleLesions)
			lesionId += sampleLesions.length

			processingSummary.processedSamples = (processingSummary.processedSamples ?? 0) + 1
			processingSummary.totalLesions = (processingSummary.totalLesions ?? 0) + sampleLesions.length

			if (allTypesCapped()) {
				mayLog('[GRIN2] All per-type caps reached; stopping early.')
				break outer
			}
		} catch (error) {
			processingSummary.failedSamples = (processingSummary.failedSamples ?? 0) + 1
			processingSummary.failedFiles?.push({
				sampleName: sample.name,
				filePath: filepath,
				error: typeof error === 'object' && error && 'message' in error ? (error as any).message : String(error)
			})
			mayLog(`[GRIN2] Error processing sample ${sample.name}: ${processingSummary.failedFiles!.at(-1)!.error}`)
		}
	}

	processingSummary.processedLesions = lesions.length
	return { lesions, processingSummary }
}

/** Process the MLST data for each sample and cap the number of lesions per type */
async function processSampleMlst(
	sampleName: string,
	mlst: any[],
	startId: number,
	request: GRIN2Request,
	keptByType: Record<'mutation' | 'gain' | 'loss', number>,
	warnedTypes: Set<'mutation' | 'gain' | 'loss'>
): Promise<{ sampleLesions: any[] }> {
	const sampleLesions: any[] = []

	const tryPush = (tupleLesion: any[]) => {
		const t = tupleLesion[4] as 'mutation' | 'gain' | 'loss'
		const used = keptByType[t] ?? 0
		if (used < MAX_LESIONS_PER_TYPE) {
			sampleLesions.push(tupleLesion)
			keptByType[t] = used + 1
		} else if (!warnedTypes.has(t)) {
			warnedTypes.add(t)
			mayLog(
				`[GRIN2] Warning: ${t} lesions exceeded the per-type limit of ${MAX_LESIONS_PER_TYPE.toLocaleString()}. ` +
					`Additional ${t} lesions will be skipped.`
			)
		}
	}

	for (const m of mlst) {
		switch (m.dt) {
			case dtsnvindel: {
				if (!request.snvindelOptions) break
				// mutation cap reached? skip conversion entirely
				if ((keptByType.mutation ?? 0) >= MAX_LESIONS_PER_TYPE) {
					if (!warnedTypes.has('mutation')) {
						warnedTypes.add('mutation')
						mayLog(
							`[GRIN2] Warning: mutation lesions exceeded the per-type limit of ${MAX_LESIONS_PER_TYPE.toLocaleString()}. ` +
								`Additional mutation lesions will be skipped.`
						)
					}
					break
				}
				const les = filterAndConvertSnvIndel(sampleName, m, request.snvindelOptions)
				if (les) tryPush(les)
				break
			}

			case dtcnv: {
				if (!request.cnvOptions) break
				// both CNV types already capped? skip any work
				if ((keptByType.gain ?? 0) >= MAX_LESIONS_PER_TYPE && (keptByType.loss ?? 0) >= MAX_LESIONS_PER_TYPE) {
					break
				}
				const les = filterAndConvertCnv(sampleName, m, request.cnvOptions) // -> [..., 'gain'|'loss']
				if (les) tryPush(les)
				break
			}

			case dtfusionrna: {
				if (!request.fusionOptions) break
				// mutation cap reached? skip conversion entirely
				if ((keptByType.mutation ?? 0) >= MAX_LESIONS_PER_TYPE) {
					if (!warnedTypes.has('mutation')) {
						warnedTypes.add('mutation')
						mayLog(
							`[GRIN2] Warning: mutation lesions exceeded the per-type limit of ${MAX_LESIONS_PER_TYPE.toLocaleString()}. ` +
								`Additional mutation lesions will be skipped.`
						)
					}
					break
				}
				const les = filterAndConvertFusion(sampleName, m, request.fusionOptions) // -> [..., 'mutation']
				if (les) tryPush(les)
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
