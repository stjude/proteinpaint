import type { RunGRIN2Request, RunGRIN2Response, RouteApi } from '#types'
import { runGRIN2Payload } from '#types/checkers'
import { stream_rust } from '@sjcrh/proteinpaint-rust'
import serverconfig from '#src/serverconfig.js'
import path from 'path'
import { run_python } from '@sjcrh/proteinpaint-python'

/**
 * Route to run GRIN2 analysis:
 * 1. Call Rust to process MAF & CNV files and get JSON data (streaming files back)
 * 2. Pipe the JSON to python script to run analysis and generate manhattan-like plot
 * 3. Return the plot image to client


 TODO change console log to mayLog once finished prototyping to avoid excessive log on prod
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

/**
 * Main GRIN2 analysis handler
 * Processes MAF files through Rust and generates plots via python
 *
 * Data Flow:
 * 1. Extract caseFiles from req.query (already parsed by middleware)
 * 2. Pass caseFiles and mafOptions to Rust for mutation processing (now streaming)
 * 3. Parse Rust output to get mutation data and summary of files
 * 3. Pass Rust mutation output to python for plot generation while we send the file summary to the div for downloaded files
 * 4. Return generated PNG as base64 string, the top gene table as JSON, and the Rust summary stats
 */

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

	// Step 1: Call Rust to process the MAF files and get JSON data (now with streaming)
	const rustInput = JSON.stringify({
		caseFiles: parsedRequest.caseFiles,
		mafOptions: parsedRequest.mafOptions,
		cnvOptions: parsedRequest.cnvOptions
	})

	// Collect output from stream_rust
	let rustOutput = ''
	let buffer = '' // For incomplete lines

	const downloadStartTime = Date.now()
	const streamResult = stream_rust('gdcGRIN2', rustInput, errors => {
		if (errors) {
			throw new Error(`Rust process failed: ${errors}`)
		}
	})

	if (!streamResult) {
		throw new Error('Failed to start Rust streaming process')
	}

	// Collect all chunks from the stream
	for await (const chunk of streamResult.rustStream) {
		const chunkStr = chunk.toString()
		rustOutput += chunkStr
		buffer += chunkStr

		// Process complete lines to check for summary
		const lines = buffer.split('\n')
		buffer = lines.pop() || ''

		for (const line of lines) {
			const trimmedLine = line.trim()
			if (trimmedLine) {
				try {
					const data = JSON.parse(trimmedLine)

					if (data.type === 'summary') {
						// Only log the final summary
						console.log(`[GRIN2] Download complete: ${data.successful_files}/${data.total_files} files successful`)

						if (data.failed_files > 0) {
							console.log(`[GRIN2] ${data.failed_files} files failed`)
						}
					}
				} catch (_parseError) {
					// Ignore parse errors during real-time processing
				}
			}
		}
	}

	console.log('[GRIN2] Rust execution completed')
	const downloadTime = Date.now() - downloadStartTime
	const downloadTimeToPrint = Math.round(downloadTime / 1000)
	console.log(`[GRIN2] Rust processing took ${downloadTimeToPrint}`)

	// Parse the JSONL output
	const rustResult = parseJsonlOutput(rustOutput)

	// Check if Rust execution was successful
	if (!rustResult) {
		throw new Error('Failed to process MAF files: No result from Rust')
	}

	// Process the rustResult (same logic as before, but rustResult is already parsed)
	const parsedRustResult = rustResult
	let dataForPython: any[] = []

	// Extract only successful data for python script
	if (parsedRustResult.successful_data && Array.isArray(parsedRustResult.successful_data)) {
		dataForPython = parsedRustResult.successful_data.flat()
		console.log(`[GRIN2] Extracted ${dataForPython.length} records for python script`)
		console.log(
			`[GRIN2] Success: ${parsedRustResult.summary.successful_files}, Failed: ${parsedRustResult.summary.failed_files}`
		)
		// console.log(`[GRIN2] Filtered Stats Object: ${parsedRustResult.summary}`)
		// console.log(`[GRIN2] Filtered Stats Object: ${JSON.stringify(parsedRustResult, null, 2)}`);
		// console.log(`[GRIN2] Filtered MAF Records: ${parsedRustResult.summary.filtered_maf_records}`)
		// console.log(`[GRIN2] Filtered CNV Records: ${parsedRustResult.summary.filtered_cnv_records}`)
		// console.log(`[GRIN2] Filtered Total Results: ${parsedRustResult.summary.filtered_records}`)
	} else {
		throw 'Unexpected Rust result format'
	}

	// Step 2: Call python script to generate the plot (unchanged)

	// Prepare input for python script - pass the Rust output and the additional properties as input to python
	const pyInput = {
		genedb: path.join(serverconfig.tpmasterdir, g.genedb.dbfile),
		chromosomelist: g.majorchr,
		lesion: dataForPython // The mutation string from Rust
	}

	// skip chrm; this property is set in gdc ds but still assess it to avoid hardcoding the logic, in case code maybe reused for non-gdc ds; do it here to avoid having to pass such setting to python
	if (ds.queries.singleSampleMutation?.discoPlot?.skipChrM) {
		pyInput.chromosomelist = {}
		for (const c in g.majorchr) {
			if (c.toLowerCase() == 'chrm') continue
			pyInput.chromosomelist[c] = g.majorchr[c]
		}
	}

	// Call the python script
	const grin2AnalysisStart = Date.now()
	const pyResult = await run_python('gdcGRIN2.py', JSON.stringify(pyInput))

	// console.log(`[GRIN2] python execution completed, result: ${pyResult}`)
	console.log(`[GRIN2] Python stderr: ${pyResult.stderr}`)
	const grin2AnalysisTime = Date.now() - grin2AnalysisStart
	const grin2AnalysisTimeToPrint = Math.round(grin2AnalysisTime / 1000)
	console.log(`[GRIN2] Python processing took ${grin2AnalysisTimeToPrint}`)

	// Parse python result to get image or check for errors
	const resultData = JSON.parse(pyResult)
	const pngImg = resultData.png[0]
	const topGeneTable = resultData.topGeneTable || null
	const analysisStats = parsedRustResult.summary || {}
	const totalProcessTime = downloadTimeToPrint + grin2AnalysisTimeToPrint
	return res.json({
		pngImg,
		topGeneTable,
		rustResult: parsedRustResult,
		analysisStats: analysisStats,
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
	const lines = rustOutput.trim().split('\n')
	const allSuccessfulData: any[] = []
	let finalSummary: any = null
	let processedFiles = 0
	// Maximum records to process
	const MAX_RECORDS = 100000
	let totalRecordsProcessed = 0
	let isCapReached = false

	for (const line of lines) {
		const trimmedLine = line.trim()
		if (trimmedLine) {
			try {
				const data = JSON.parse(trimmedLine)

				if (data.type === 'data') {
					// Check if we've already reached the cap
					if (isCapReached) {
						console.log(`[GRIN2] Skipping file ${data.case_id} - record cap of ${MAX_RECORDS} already reached`)
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

						console.log(
							`[GRIN2] Record cap reached! Processing only ${recordsProcessedThisFile} of ${incomingRecords} records from file ${data.case_id}`
						)
					}

					// Individual file completed successfully
					processedFiles++
					allSuccessfulData.push(recordsToProcess)
					totalRecordsProcessed += recordsProcessedThisFile
					console.log(totalRecordsProcessed, MAX_RECORDS)
					console.log(
						`[GRIN2] Processed file ${processedFiles}: ${data.case_id} (${data.data_type}) - ${recordsProcessedThisFile} records`
					)
					console.log(`[GRIN2] Total records processed: ${totalRecordsProcessed}/${MAX_RECORDS}`)

					// Log when cap is reached
					if (isCapReached) {
						console.log(
							`[GRIN2] RECORD CAP REACHED: ${MAX_RECORDS} records processed. Subsequent files will be skipped.`
						)
					}
				} else if (data.type === 'summary') {
					// Final summary - all files processed
					finalSummary = data
					console.log(`[GRIN2] Download complete: ${data.successful_files}/${data.total_files} files successful`)
					if (isCapReached) {
						console.log(`[GRIN2] Processing stopped due to record cap of ${MAX_RECORDS}`)
						console.log(`[GRIN2] Total records collected: ${totalRecordsProcessed}`)
					}
					if (data.failed_files > 0) {
						console.log(`[GRIN2] ${data.failed_files} files failed`)
					}
				}
			} catch (parseError) {
				console.error('[GRIN2] JSONL parse error:', parseError)
				console.error('[GRIN2] Problematic line:', trimmedLine)
			}
		}
	}

	if (!finalSummary) {
		throw new Error('No summary found in Rust output')
	}

	// Return same format as the original run_rust result
	return {
		successful_data: allSuccessfulData,
		failed_files: finalSummary.errors || [],
		summary: {
			total_files: finalSummary.total_files,
			successful_files: finalSummary.successful_files,
			failed_files: finalSummary.failed_files,
			errors: finalSummary.errors || [],
			filtered_records: finalSummary.filtered_records || 0,
			filtered_maf_records: finalSummary.filtered_maf_records || 0,
			filtered_cnv_records: finalSummary.filtered_cnv_records || 0,
			filtered_records_by_case: finalSummary.filtered_records_by_case || {},
			included_maf_records: finalSummary.included_maf_records || 0,
			included_cnv_records: finalSummary.included_cnv_records || 0
		}
	}
}
