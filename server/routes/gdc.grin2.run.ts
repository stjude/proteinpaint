import type { RunGRIN2Request, RunGRIN2Response, RouteApi } from '#types'
import { runGRIN2Payload } from '#types/checkers'
import { stream_rust } from '@sjcrh/proteinpaint-rust'
import { run_R } from '@sjcrh/proteinpaint-r'
import serverconfig from '#src/serverconfig.js'
import path from 'path'
import { formatElapsedTime } from '@sjcrh/proteinpaint-shared/time.js'

/**
 * Route to run GRIN2 analysis:
 * 1. Call Rust to process MAF & CNV files and get JSON data (now with streaming)
 * 2. Pipe the JSON to R script to generate a plot
 * 3. Return the plot image to client
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
 * Parse JSONL output from stream_rust
 * Converts streaming JSONL format to the same structure as run_rust
 */
function parseJsonlOutput(rustOutput: string): any {
	const lines = rustOutput.trim().split('\n')
	const allSuccessfulData: any[] = []
	let finalSummary: any = null
	// let processedFiles = 0

	for (const line of lines) {
		const trimmedLine = line.trim()
		if (trimmedLine) {
			try {
				const data = JSON.parse(trimmedLine)

				if (data.type === 'data') {
					// Individual file completed successfully
					// processedFiles++
					allSuccessfulData.push(data.data)
					// console.log(
					// 	`[GRIN2] Processed file ${processedFiles}: ${data.case_id} (${data.data_type}) - ${data.data.length} records`
					// )
				} else if (data.type === 'summary') {
					// Final summary - all files processed
					finalSummary = data
					console.log(`[GRIN2] Download complete: ${data.successful_files}/${data.total_files} files successful`)
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

/**
 * Main GRIN2 analysis handler
 * Processes MAF files through Rust and generates plots via R
 *
 * @param req - Express request (data comes via req.query after middleware merge)
 * @param res - Express response (returns PNG image as base64)
 *
 * Data Flow:
 * 1. Extract caseFiles from req.query (already parsed by middleware)
 * 2. Pass caseFiles and mafOptions to Rust for mutation processing (now streaming)
 * 3. Parse Rust output to get mutation data and summary of files
 * 3. Pass Rust mutation output to R for plot generation while we send the file summary to the div for downloaded files
 * 4. Return generated PNG as base64 string, the top gene table as JSON, and the Rust summary stats
 */

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		try {
			console.log('[GRIN2] Validating genome configuration')
			const g = genomes.hg38
			if (!g) throw 'hg38 missing'
			const ds = g.datasets.GDC
			if (!ds) throw 'hg38 GDC missing'

			console.log(`[GRIN2] Request received:`, JSON.stringify(req.query))
			const parsedRequest = req.query as RunGRIN2Request
			console.log(`[GRIN2] Parsed request: ${JSON.stringify(parsedRequest)}`)

			// Step 1: Call Rust to process the MAF files and get JSON data (now with streaming)
			const rustInput = JSON.stringify({
				caseFiles: parsedRequest.caseFiles,
				mafOptions: parsedRequest.mafOptions
			})

			// Use stream_rust instead of run_rust
			console.log('[GRIN2] Executing Rust function with streaming...')

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
			const downloadTime = formatElapsedTime(Date.now() - downloadStartTime)
			console.log(`[GRIN2] Rust processing took ${downloadTime}`)

			// Parse the JSONL output
			const rustResult = parseJsonlOutput(rustOutput)

			// Check if Rust execution was successful
			if (!rustResult) {
				throw new Error('Failed to process MAF files: No result from Rust')
			}

			// Process the rustResult (same logic as before, but rustResult is already parsed)
			const parsedRustResult = rustResult
			let dataForR: any[] = []

			try {
				// Extract only successful data for R script
				if (parsedRustResult.successful_data && Array.isArray(parsedRustResult.successful_data)) {
					dataForR = parsedRustResult.successful_data.flat()
					console.log(`[GRIN2] Extracted ${dataForR.length} records for R script`)
					console.log(
						`[GRIN2] Success: ${parsedRustResult.summary.successful_files}, Failed: ${parsedRustResult.summary.failed_files}`
					)
					// console.log(`[GRIN2] Filtered Stats Object: ${parsedRustResult.summary}`)
					// console.log(`[GRIN2] Filtered Stats Object: ${JSON.stringify(parsedRustResult, null, 2)}`);
					// console.log(`[GRIN2] Filtered MAF Records: ${parsedRustResult.summary.filtered_maf_records}`)
					// console.log(`[GRIN2] Filtered CNV Records: ${parsedRustResult.summary.filtered_cnv_records}`)
					// console.log(`[GRIN2] Filtered Total Results: ${parsedRustResult.summary.filtered_records}`)
				} else {
					console.warn('[GRIN2] Unexpected Rust result format')
					dataForR = []
				}
			} catch (parseError) {
				console.error('[GRIN2] Error processing Rust result:', parseError)
				dataForR = []
			}

			// Step 2: Call R script to generate the plot (unchanged)

			// Prepare the path to the gene database file
			const genedbfile = path.join(serverconfig.tpmasterdir, g.genedb.dbfile)

			// Generate a unique image file name
			const imagefile = path.join(serverconfig.cachedir, `grin2_${Date.now()}_${Math.floor(Math.random() * 1e9)}.png`)

			// Prepare input for R script - pass the Rust output and the additional properties as input to R
			const rInput = JSON.stringify({
				genedb: genedbfile,
				chromosomelist: g.majorchr,
				imagefile: imagefile,
				lesion: dataForR // The mutation string from Rust
			})

			// console.log(`R input: ${rInput}`)

			// Call the R script
			console.log('[GRIN2] Executing R script...')
			const rAnalysisTime = Date.now()
			const rResult = await run_R('gdcGRIN2.R', rInput, [])
			// console.log(`[GRIN2] R execution completed, result: ${rResult}`)
			console.log('[GRIN2] R execution completed')
			console.log(`[GRIN2] R analysis took ${formatElapsedTime(Date.now() - rAnalysisTime)}`)

			// Parse R result to get image or check for errors
			let resultData
			try {
				resultData = JSON.parse(rResult)
				console.log('[GRIN2] Finished R analysis')
				const pngImg = resultData.png[0]
				const topGeneTable = resultData.topGeneTable || null
				const analysisStats = parsedRustResult.summary || {}
				console.log('[GRIN2] Total GRIN2 processing time:', formatElapsedTime(Date.now() - downloadStartTime))
				return res.json({
					pngImg,
					topGeneTable,
					rustResult: parsedRustResult,
					analysisStats: analysisStats,
					status: 'success'
				})
			} catch (parseError) {
				console.error('[GRIN2] Error parsing R result:', parseError)
				// console.log('[GRIN2] Raw R result:', rResult)
			}
		} catch (e: any) {
			console.error('[GRIN2] Error running analysis:', e)
			console.error('[GRIN2] Error stack:', e.stack)

			// Use the RunGRIN2Response type for error case
			const errorResponse: RunGRIN2Response = {
				status: 'error',
				error: e.message || String(e)
			}

			console.log(`[GRIN2] Sending error response: ${JSON.stringify(errorResponse)}`)
			res.status(500).send(errorResponse)
		}
	}
}
