import type { RunGRIN2Request, RunGRIN2Response, RouteApi } from '#types'
import { runGRIN2Payload } from '#types/checkers'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import { run_R } from '@sjcrh/proteinpaint-r'
import serverconfig from '#src/serverconfig.js'
import path from 'path'
/**
 * Route to run GRIN2 analysis:
 * 1. Call Rust to process MAF files and get JSON data
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
 * Main GRIN2 analysis handler
 * Processes MAF files through Rust and generates plots via R
 *
 * @param req - Express request (data comes via req.query after middleware merge)
 * @param res - Express response (returns PNG image as base64)
 *
 * Data Flow:
 * 1. Extract caseFiles from req.query (already parsed by middleware)
 * 2. Pass caseFiles and mafOptions to Rust for mutation processing
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

			// Step 1: Call Rust to process the MAF files and get JSON data
			console.log('[GRIN2] Calling Rust for file processing...')

			const rustInput = JSON.stringify({
				caseFiles: parsedRequest.caseFiles,
				mafOptions: parsedRequest.mafOptions
			})
			// console.log(`[GRIN2] Rust input: ${rustInput}`)

			// Call the Rust implementation and get JSON result
			console.log('[GRIN2] Executing Rust function...')
			const rustResult = await run_rust('gdcGRIN2', rustInput)
			console.log('[GRIN2] Rust execution completed')

			// Check if Rust execution was successful
			if (!rustResult) {
				throw new Error('Failed to process MAF files: No result from Rust')
			}

			// Parse the rustResult if it's a string
			let parsedRustResult
			let dataForR: any[] = []
			try {
				parsedRustResult = typeof rustResult === 'string' ? JSON.parse(rustResult) : rustResult
				console.log(`[GRIN2] Parsed Rust result structure received`)

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
				console.error('[GRIN2] Error parsing Rust result:', parseError)
				dataForR = []
			}

			// Step 2: Call R script to generate the plot

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
