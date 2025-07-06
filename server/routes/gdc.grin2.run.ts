import type { RunGRIN2Request, RunGRIN2Response, RouteApi } from '#types'
import { runGRIN2Payload } from '#types/checkers'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import serverconfig from '#src/serverconfig.js'
import path from 'path'
import { run_python } from '@sjcrh/proteinpaint-python'
import { mayLog } from '#src/helpers.ts'

/**
 * Main GRIN2 analysis handler
 * Processes and retrieves MAF and CNV files and relevant mutation information through Rust and performs GRIN2 analysis and generates plots via python
 *
 * Data Flow:
 * 1. Extract caseFiles from req.query (already parsed by middleware)
 * 2. Pass caseFiles, mafOptions, cnvOptions, and chromosomes to Rust for mutation processing
 * 3. Parse Rust output to get mutation data and summary of files results
 *    - Rust outputs JSONL format with data and summary lines
 * 		- Each line gets output as soon as it is processed to help reduce memory usage
 *    - Each line is a JSON object with either 'data' or 'summary' type
 *    - 'data' lines contain mutation data for each case, 'summary' contains overall statistics
 *    - Rust handles file downloads and retries, returning successful data and errors
 *    - Rust outputs a summary with total files, successful files, failed files, and statistics on filtered records by case
 * 3. Pass Rust mutation output to python for plot generation while we send the file summary to the analysis summary div
 * 4. Return generated PNG as base64 string, the top gene table as JSON, and the Rust summary stats
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
		chromosomes: [] as string[]
	}

	const pyInput = {
		genedb: path.join(serverconfig.tpmasterdir, g.genedb.dbfile),
		chromosomelist: {},
		lesion: [] as string[]
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

	// Step 1: Call Rust to process the MAF files and get JSON data

	const downloadStartTime = Date.now()
	const rustOutput = await run_rust('gdcGRIN2', JSON.stringify(rustInput))

	try {
		const rustOutputJS = JSON.parse(rustOutput)
		for (const data of rustOutputJS) {
			if (data.type === 'summary') {
				// Only log the final summary
				mayLog(`[GRIN2] Download complete: ${data.successful_files}/${data.total_files} files successful`)

				if (data.failed_files > 0) {
					mayLog(`[GRIN2] ${data.failed_files} files failed`)
				}
			}
		}
	} catch (parseError) {
		console.error('[GRIN2] JSONL parse error:', parseError)
		console.error('[GRIN2] Problematic line:', rustOutput)
	}

	mayLog('[GRIN2] Rust execution completed')
	const downloadTime = Date.now() - downloadStartTime
	const downloadTimeToPrint = Math.round(downloadTime / 1000)
	mayLog(`[GRIN2] Rust processing took ${downloadTimeToPrint}`)

	// Parse the JSONL output
	const rustResult = parseJsonlOutput(rustOutput)

	// Check if Rust execution was successful
	if (!rustResult) {
		throw new Error('Failed to process MAF files: No result from Rust')
	}

	// Process the rustResult
	const parsedRustResult = rustResult

	// Extract only successful data for python script
	if (parsedRustResult.successful_data && Array.isArray(parsedRustResult.successful_data)) {
		pyInput.lesion = parsedRustResult.successful_data.flat()
		mayLog(`[GRIN2] Extracted ${pyInput.lesion.length} records for python script`)
		mayLog(
			`[GRIN2] Success: ${parsedRustResult.summary.successful_files}, Failed: ${parsedRustResult.summary.failed_files}`
		)
		// mayLog(`[GRIN2] Filtered Stats Object: ${parsedRustResult.summary}`)
		// mayLog(`[GRIN2] Filtered Stats Object: ${JSON.stringify(parsedRustResult, null, 2)}`);
		// mayLog(`[GRIN2] Filtered MAF Records: ${parsedRustResult.summary.filtered_maf_records}`)
		// mayLog(`[GRIN2] Filtered CNV Records: ${parsedRustResult.summary.filtered_cnv_records}`)
		// mayLog(`[GRIN2] Filtered Total Results: ${parsedRustResult.summary.filtered_records}`)
	} else {
		throw 'Unexpected Rust result format'
	}

	// Step 2: Call python script to run GRIN2 and generate the plot

	// Call the python script
	const grin2AnalysisStart = Date.now()
	const pyResult = await run_python('gdcGRIN2.py', JSON.stringify(pyInput))

	// mayLog(`[GRIN2] python execution completed, result: ${pyResult}`)
	mayLog(`[GRIN2] Python stderr: ${pyResult.stderr}`)
	const grin2AnalysisTime = Date.now() - grin2AnalysisStart
	const grin2AnalysisTimeToPrint = Math.round(grin2AnalysisTime / 1000)
	mayLog(`[GRIN2] Python processing took ${grin2AnalysisTimeToPrint}`)

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
 * Parse JSONL output from stream_rust
 * Converts streaming JSONL format to the same structure as run_rust
 */
function parseJsonlOutput(rustOutput: string): any {
	const allSuccessfulData: any[] = []
	let finalSummary: any = null
	let processedFiles = 0
	const MAX_RECORDS = 100000
	let totalRecordsProcessed = 0
	let isCapReached = false

	for (const data of JSON.parse(rustOutput)) {
		if (data.type === 'data') {
			if (isCapReached) {
				mayLog(`[GRIN2] Skipping file ${data.case_id} - record cap of ${MAX_RECORDS} already reached`)
				continue // Skip processing this file
			}

			// Calculate how many records we can still accept
			const remainingCapacity = MAX_RECORDS - totalRecordsProcessed
			const incomingRecords = data.data.length

			// Determine how many records to actually process
			let recordsToProcess: any[]
			let recordsProcessedThisFile: number

			if (incomingRecords <= remainingCapacity) {
				// We can process all records from this file
				recordsToProcess = data.data
				recordsProcessedThisFile = incomingRecords
			} else {
				// We can only process part of this file to reach the cap
				recordsToProcess = data.data.slice(0, remainingCapacity)
				recordsProcessedThisFile = remainingCapacity
				isCapReached = true

				mayLog(
					`[GRIN2] Record cap reached! Processing only ${recordsProcessedThisFile} of ${incomingRecords} records from file ${data.case_id}`
				)
			}

			// Individual file completed successfully
			processedFiles++
			allSuccessfulData.push(recordsToProcess)
			totalRecordsProcessed += recordsProcessedThisFile
			mayLog(
				`[GRIN2] Processed file ${processedFiles}: ${data.case_id} (${data.data_type}) - ${recordsProcessedThisFile} records`
			)
			mayLog(`[GRIN2] Total records processed: ${totalRecordsProcessed}/${MAX_RECORDS}`)

			// Log when cap is reached
			if (isCapReached) {
				mayLog(`[GRIN2] RECORD CAP REACHED: ${MAX_RECORDS} records processed. Subsequent files will be skipped.`)
			}
		} else if (data.type === 'summary') {
			// Final summary - all files processed
			finalSummary = data
			mayLog(`[GRIN2] Download complete: ${data.successful_files}/${data.total_files} files successful`)
			if (isCapReached) {
				mayLog(`[GRIN2] Processing stopped due to record cap of ${MAX_RECORDS}`)
				mayLog(`[GRIN2] Total records collected: ${totalRecordsProcessed}`)
			}
			if (data.failed_files > 0) {
				mayLog(`[GRIN2] ${data.failed_files} files failed`)
			}
		}
	}

	if (!finalSummary) {
		throw new Error('No summary found in Rust output')
	}

	// Return the final result of rust collection and processing
	return {
		successful_data: allSuccessfulData,
		failed_files: finalSummary.errors || [],
		summary: {
			type: 'summary',
			total_files: finalSummary.total_files,
			successful_files: finalSummary.successful_files,
			failed_files: finalSummary.failed_files,
			errors: finalSummary.errors || [],
			filtered_records: finalSummary.filtered_records || 0,
			filtered_maf_records: finalSummary.filtered_maf_records || 0,
			filtered_cnv_records: finalSummary.filtered_cnv_records || 0,
			included_maf_records: finalSummary.included_maf_records || 0,
			included_cnv_records: finalSummary.included_cnv_records || 0,
			filtered_records_by_case: finalSummary.filtered_records_by_case || {},
			hyper_mutator_records: finalSummary.hyper_mutator_records || {},
			skippedChromosomes: finalSummary.skipped_chromosomes || {}
		}
	}
}
