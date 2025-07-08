import type { RunGRIN2Request, RunGRIN2Response, RouteApi } from '#types'
import { runGRIN2Payload } from '#types/checkers'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import serverconfig from '#src/serverconfig.js'
import path from 'path'
import { run_python } from '@sjcrh/proteinpaint-python'
import { mayLog } from '#src/helpers.ts'

// Constants
const MAX_RECORD = 100000 // Maximum number of records to process

/**
 * Main GRIN2 analysis handler
 * Processes and retrieves MAF and CNV files and relevant mutation information through Rust and performs GRIN2 analysis and generates plots via python
 *
 * Data Flow:
 * 1. Extract caseFiles from req.query (already parsed by middleware)
 * 2. Pass caseFiles, mafOptions, cnvOptions, chromosomes, and max_record to Rust for mutation processing
 * 3. Parse Rust output to get mutation data and summary of files results
 *    - Rust outputs a single JSON object: { grin2lesion: string, summary: {} }
 *    - grin2lesion is a JSON string containing all mutation data
 *    - Rust handles file downloads, retries, filtering, and max_record capping
 *    - Summary contains statistics on processed files and detailed filtered records
 * 4. Pass grin2lesion string directly to Python
 * 5. Python processes the JSON string and generates plots
 * 6. Return generated PNG as base64 string, the top gene table as JSON, and the Rust summary stats
 */

export const api: RouteApi = {
	endpoint: 'gdc/runGRIN2',
	methods: {
		get: {
			...runGRIN2Payload,
			init
		},
		post: {
			...runGRIN2Payload,
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

			// Use the RunGRIN2Response type for error case
			const errorResponse: RunGRIN2Response = {
				status: 'error',
				error: e.message || String(e)
			}

			res.status(500).send(errorResponse)
		}
	}
}

async function runGrin2(genomes: any, req: any, res: any) {
	const g = genomes.hg38
	if (!g) throw 'hg38 missing'
	const ds = g.datasets.GDC
	if (!ds) throw 'hg38 GDC missing'

	const parsedRequest = req.query as RunGRIN2Request

	// prepare inputs for both rust and python. this allows to handle the logic of deciding allowed chromosomes in one place

	const rustInput = {
		caseFiles: parsedRequest.caseFiles,
		mafOptions: parsedRequest.mafOptions,
		cnvOptions: parsedRequest.cnvOptions,
		chromosomes: [] as string[],
		max_record: MAX_RECORD
	}

	const pyInput = {
		genedb: path.join(serverconfig.tpmasterdir, g.genedb.dbfile),
		chromosomelist: {},
		lesion: '' as string
	}
	for (const c in g.majorchr) {
		// list is short so a small penalty for accessing the flag in the loop
		if (ds.queries.singleSampleMutation?.discoPlot?.skipChrM) {
			// skip chrM; this property is set in gdc ds but still assess it to avoid hardcoding the logic, in case code maybe reused for non-gdc ds
			if (c.toLowerCase() == 'chrm') continue
		}
		rustInput.chromosomes.push(c)
		pyInput.chromosomelist[c] = g.majorchr[c]
	}

	// mayLog('[GRIN2] Running GRIN2 with input:', JSON.stringify(rustInput, null, 2))

	// Step 1: Call Rust to process the files and get JSON data
	const downloadStartTime = Date.now()
	const rustOutput = await run_rust('gdcGRIN2', JSON.stringify(rustInput))

	mayLog('[GRIN2] Rust execution completed')
	const downloadTime = Date.now() - downloadStartTime
	const downloadTimeToPrint = Math.round(downloadTime / 1000)
	mayLog(`[GRIN2] Rust processing took ${downloadTimeToPrint} seconds`)

	// Parse the JSON output
	const parsedRustResult = parseRustOutput(rustOutput)

	// Check if Rust execution was successful
	if (!parsedRustResult) {
		throw new Error('Failed to process files: No result from Rust')
	}

	// Extract only successful data for python script
	if (parsedRustResult.successful_data !== undefined && parsedRustResult.successful_data !== null) {
		pyInput.lesion = parsedRustResult.successful_data
		mayLog(`[GRIN2] Extracted ${parsedRustResult.successful_data.length.toLocaleString()} characters for python script`)
		mayLog(
			`[GRIN2] Success: ${parsedRustResult.summary.successful_files.toLocaleString()}, Failed: ${parsedRustResult.summary.failed_files.toLocaleString()}`
		)
		// mayLog(`[GRIN2] Filtered Stats Object: ${parsedRustResult.summary}`)
		// mayLog(`[GRIN2] Filtered Stats Object: ${JSON.stringify(parsedRustResult, null, 2)}`);
		// mayLog(`[GRIN2] Filtered MAF Records: ${parsedRustResult.summary.filtered_maf_records}`)
		// mayLog(`[GRIN2] Filtered CNV Records: ${parsedRustResult.summary.filtered_cnv_records}`)
		// mayLog(`[GRIN2] Filtered Total Results: ${parsedRustResult.summary.filtered_records}`)
	} else {
		throw 'No successful data returned from Rust processing'
	}

	// Step 2: Call python script to run GRIN2 and generate the plot

	// Call the python script
	const grin2AnalysisStart = Date.now()
	const pyResult = await run_python('grin2PpWrapper.py', JSON.stringify(pyInput))

	// mayLog(`[GRIN2] python execution completed, result: ${pyResult}`)
	if (pyResult.stderr?.trim()) {
		mayLog(`[GRIN2] Python stderr: ${pyResult.stderr}`)
	}
	const grin2AnalysisTime = Date.now() - grin2AnalysisStart
	const grin2AnalysisTimeToPrint = Math.round(grin2AnalysisTime / 1000)
	mayLog(`[GRIN2] Python processing took ${grin2AnalysisTimeToPrint} seconds`)

	// Parse python result to get image or check for errors
	const resultData = JSON.parse(pyResult)
	const pngImg = resultData.png[0]
	const topGeneTable = resultData.topGeneTable || null
	const totalProcessTime = downloadTimeToPrint + grin2AnalysisTimeToPrint
	return res.json({
		pngImg,
		topGeneTable,
		rustResult: parsedRustResult,
		timing: {
			rustProcessingTime: downloadTimeToPrint,
			grin2ProcessingTime: grin2AnalysisTimeToPrint,
			totalTime: totalProcessTime
		},
		status: 'success'
	})
}

/**
 * Parse the simplified JSON output from Rust
 * Rust now returns a single JSON object with grin2lesion string and summary
 */
function parseRustOutput(rustOutput: string): any {
	try {
		// Parse the single JSON object from Rust
		const rustResult = JSON.parse(rustOutput)

		// Validate the structure
		if (!rustResult.grin2lesion || !rustResult.summary) {
			throw new Error('Invalid Rust output: missing lesion data or summary')
		}

		mayLog(`[GRIN2] Parsed Rust output successfully`)

		return {
			successful_data: rustResult.grin2lesion,
			failed_files: rustResult.summary.errors || [],
			summary: {
				type: 'summary',
				total_files: rustResult.summary.total_files,
				successful_files: rustResult.summary.successful_files,
				failed_files: rustResult.summary.failed_files,
				errors: rustResult.summary.errors || [],
				filtered_records: rustResult.summary.filtered_records || 0,
				filtered_maf_records: rustResult.summary.filtered_maf_records || 0,
				filtered_cnv_records: rustResult.summary.filtered_cnv_records || 0,
				included_maf_records: rustResult.summary.included_maf_records || 0,
				included_cnv_records: rustResult.summary.included_cnv_records || 0,
				filtered_records_by_case: rustResult.summary.filtered_records_by_case || {},
				hyper_mutator_records: rustResult.summary.hyper_mutator_records || {},
				excluded_by_max_record: rustResult.summary.excluded_by_max_record || {},
				skippedChromosomes: rustResult.summary.skipped_chromosomes || {}
			}
		}
	} catch (error) {
		throw new Error(`Failed to parse Rust output: ${error instanceof Error ? error.message : 'Unknown error'}`)
	}
}
