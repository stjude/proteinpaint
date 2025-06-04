import type { RunGRIN2Request, RunGRIN2Response, RouteApi } from '#types'
import { runGRIN2Payload } from '#types/checkers'
import { stream_rust } from '@sjcrh/proteinpaint-rust'
import { run_R } from '@sjcrh/proteinpaint-r'
import serverconfig from '#src/serverconfig.js'
import path from 'path'

/**
 * Route to run GRIN2 analysis:
 * 1. Call Rust to process MAF files and get JSON data (now with streaming)
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
	let processedFiles = 0

	for (const line of lines) {
		const trimmedLine = line.trim()
		if (trimmedLine) {
			try {
				const data = JSON.parse(trimmedLine)

				if (data.type === 'data') {
					// Individual file completed successfully
					processedFiles++
					allSuccessfulData.push(data.data)
					console.log(
						`[GRIN2] Processed file ${processedFiles}: ${data.case_id} (${data.data_type}) - ${data.data.length} records`
					)
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
			failed_files: finalSummary.failed_files
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
 * 4. Return generated PNG as base64 string and the top gene table as JSON
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
			console.log('[GRIN2] Calling Rust for file processing...')

			const rustInput = JSON.stringify({
				caseFiles: parsedRequest.caseFiles,
				mafOptions: parsedRequest.mafOptions
			})

			// NEW: Use stream_rust instead of run_rust with progress bar
			console.log('[GRIN2] Executing Rust function with streaming...')

			// Collect output from stream_rust with progress bar
			let rustOutput = ''
			let buffer = '' // For incomplete lines
			let processedFiles = 0
			let totalFiles = 0
			const startTime = Date.now()

			// Calculate total expected files
			const { caseFiles } = parsedRequest
			totalFiles = Object.values(caseFiles).reduce((sum: number, fileTypes: any) => {
				return sum + (fileTypes.maf ? 1 : 0) + (fileTypes.cnv ? 1 : 0)
			}, 0)

			console.log(`[GRIN2] Starting download of ${totalFiles} files...`)

			const streamResult = stream_rust('gdcGRIN2', rustInput, errors => {
				if (errors) {
					throw new Error(`Rust process failed: ${errors}`)
				}
			})

			if (!streamResult) {
				throw new Error('Failed to start Rust streaming process')
			}

			// Helper function to update progress bar
			const updateProgressBar = (processed: number, total: number, startTime: number) => {
				const percentage = Math.round((processed / total) * 100)
				const elapsed = Date.now() - startTime
				const avgTimePerFile = elapsed / processed
				const remainingFiles = total - processed
				const estimatedTimeRemaining = remainingFiles * avgTimePerFile

				// Create progress bar (20 characters wide)
				const barWidth = 20
				const filledWidth = Math.round((processed / total) * barWidth)
				const bar = '█'.repeat(filledWidth) + '░'.repeat(barWidth - filledWidth)

				// Format time remaining
				const formatTime = (ms: number) => {
					if (ms < 1000) return '< 1s'
					const seconds = Math.round(ms / 1000)
					if (seconds < 60) return `${seconds}s`
					const minutes = Math.floor(seconds / 60)
					const remainingSeconds = seconds % 60
					return `${minutes}m ${remainingSeconds}s`
				}

				const eta = processed > 0 && remainingFiles > 0 ? formatTime(estimatedTimeRemaining) : 'calculating...'

				// Clear previous line and write new progress
				process.stdout.write('\r\x1b[K') // Clear current line
				process.stdout.write(`[GRIN2] ${bar} ${percentage}% (${processed}/${total}) ETA: ${eta}`)
			}

			// Collect all chunks from the stream and show progress
			for await (const chunk of streamResult.rustStream) {
				const chunkStr = chunk.toString()
				rustOutput += chunkStr
				buffer += chunkStr

				// Process complete lines for real-time progress updates
				const lines = buffer.split('\n')
				buffer = lines.pop() || ''

				for (const line of lines) {
					const trimmedLine = line.trim()
					if (trimmedLine) {
						try {
							const data = JSON.parse(trimmedLine)

							if (data.type === 'data') {
								// Update progress bar for each completed file
								processedFiles++
								updateProgressBar(processedFiles, totalFiles, startTime)
							} else if (data.type === 'summary') {
								// Final summary - clear progress bar and show completion
								process.stdout.write('\r\x1b[K') // Clear progress bar line
								const totalTime = Date.now() - startTime
								console.log(
									`[GRIN2] ✅ Download complete: ${data.successful_files}/${data.total_files} files (${Math.round(
										totalTime / 1000
									)}s)`
								)

								if (data.failed_files > 0) {
									console.log(`[GRIN2] ⚠️  ${data.failed_files} files failed`)
								}
							}
						} catch (_parseError) {
							// Ignore parse errors during real-time processing
						}
					}
				}
			}

			// Ensure we're on a new line after progress bar
			console.log('')
			console.log('[GRIN2] Rust execution completed')

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

			console.log(`R input: ${rInput}`)

			// Call the R script
			console.log('[GRIN2] Executing R script...')
			const rResult = await run_R('gdcGRIN2.R', rInput, [])
			console.log(`[GRIN2] R execution completed, result: ${rResult}`)

			// Parse R result to get image or check for errors
			let resultData
			try {
				resultData = JSON.parse(rResult)
				console.log('[GRIN2] Finished R analysis')
				const pngImg = resultData.png[0]
				const topGeneTable = resultData.topGeneTable || null
				return res.json({ pngImg, topGeneTable, rustResult: parsedRustResult, status: 'success' })
			} catch (parseError) {
				console.error('[GRIN2] Error parsing R result:', parseError)
				console.log('[GRIN2] Raw R result:', rResult)
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
