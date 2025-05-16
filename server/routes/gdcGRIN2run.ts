import type { RunGRIN2Request, RunGRIN2Response, RouteApi } from '#types'
import { runGRIN2Payload } from '#types/checkers'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import { run_R } from '@sjcrh/proteinpaint-r'
import fs from 'fs/promises'
import path from 'path'
import { formatElapsedTime } from '@sjcrh/proteinpaint-shared/time.js'
import { mayLog } from '#src/helpers.ts'

/**
 * Route to run GRIN2 analysis:
 * 1. Call Rust to process MAF files and get JSON data
 * 2. Pipe the JSON to R script to generate a plot
 * 3. Return the plot image to client
 */

console.log('GRIN2 Run route registered!')
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
			console.log('[GRIN2] Validating genome configuration')
			const g = genomes.hg38
			if (!g) throw 'hg38 missing'
			const ds = g.datasets.GDC
			if (!ds) throw 'hg38 GDC missing'

			const caseFiles = req.body as RunGRIN2Request
			console.log(`[GRIN2] Request received: ${JSON.stringify(caseFiles)}`)

			if (!caseFiles) {
				throw 'Missing or invalid cases data'
			}

			try {
				// Create a simple random folder name for testing
				// const tempDir = path.join('.', `grin2-test-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`)
				// console.log(`[GRIN2] Temporary directory for testing: ${tempDir}`)
				// await fs.mkdir(tempDir, { recursive: true })
				// console.log(`[GRIN2] Temporary directory created: ${tempDir}`)

				console.log(`[GRIN2] Running analysis for ${caseFiles.length} cases`)

				// Step 1: Call Rust to process the MAF files and get JSON data
				console.log('[GRIN2] Calling Rust for file processing...')
				const startTime = Date.now()

				//console.log(`[GRIN2] Rust input: ${rustInput}`)
				const rustInput = JSON.stringify(caseFiles)

				// Call the Rust implementation and get JSON result
				console.log('[GRIN2] Executing Rust function...')
				const rustResult = await run_rust('gdcGRIN2', rustInput)
				console.log('[GRIN2] Rust execution completed')

				// Log the result to see its structure
				console.log(`[GRIN2] Rust result type: ${typeof rustResult}`)
				console.log(`[GRIN2] Rust result: ${JSON.stringify(rustResult).substring(0, 200)}...`)

				// Check if Rust execution was successful
				if (!rustResult) {
					throw new Error('Failed to process MAF files: No result from Rust')
				}

				// Parse the rustResult if it's a string
				let parsedRustResult
				try {
					parsedRustResult = typeof rustResult === 'string' ? JSON.parse(rustResult) : rustResult
					console.log(`[GRIN2] Parsed Rust result keys: ${Object.keys(parsedRustResult)}`)
				} catch (parseError) {
					console.error('[GRIN2] Error parsing Rust result:', parseError)
					console.log('[GRIN2] Raw Rust result:', rustResult)
				}

				// Create a temporary file path for our output image
				const outputImagePath = path.join('grin2_output.png')
				console.log(`[GRIN2] Output image path: ${outputImagePath}`)

				// Step 2: Call R script to generate the plot
				console.log('[GRIN2] Calling R script to generate plot...')

				// Prepare input for R script - pass the Rust output as input to R
				const rInput = JSON.stringify({
					rustData: parsedRustResult,
					outputPath: outputImagePath
				})
				console.log(`[GRIN2] R input: ${rInput}`)
				console.log(`[GRIN2] R input prepared`)

				// Call the R script
				console.log('[GRIN2] Executing R script...')
				const rResult = await run_R('gdcGRIN2.R', rInput, [])
				console.log(`[GRIN2] R execution completed, result: ${rResult}`)

				// Parse R result to get metadata or check for errors
				let resultData
				try {
					resultData = JSON.parse(rResult)
					console.log(`[GRIN2] Parsed R result: ${JSON.stringify(resultData)}`)
				} catch (parseError) {
					console.error('[GRIN2] Error parsing R result:', parseError)
					console.log('[GRIN2] Raw R result:', rResult)
				}

				if (!resultData.success) {
					throw new Error(resultData.error || 'R script failed to generate plot')
				}

				// Step 3: Read the generated image
				console.log(`[GRIN2] Checking if image exists at path: ${outputImagePath}`)
				const imageExists = await fs
					.access(outputImagePath)
					.then(() => true)
					.catch(() => false)

				console.log(`[GRIN2] Image exists: ${imageExists}`)

				if (!imageExists) {
					throw new Error('R script completed but output image not found')
				}

				console.log('[GRIN2] Reading image file...')
				const imageBuffer = await fs.readFile(outputImagePath)
				console.log(`[GRIN2] Image loaded, size: ${imageBuffer.length} bytes`)

				const executionTime = mayLog(formatElapsedTime(Date.now() - startTime))

				// Create a metadata object for logging
				const metadata = {
					filesAnalyzed: caseFiles.length,
					samplesIncluded: parsedRustResult.sampleCount || 0,
					analysisDate: new Date().toISOString(),
					executionTime
				}

				// Log metadata for debugging
				console.log('[GRIN2] Analysis completed:', JSON.stringify(metadata))

				// Send the image to the client
				console.log('[GRIN2] Sending image to client...')
				res.setHeader('Content-Type', 'image/png')
				res.setHeader('Content-Disposition', 'inline; filename="grin2_analysis.png"')
				res.send(imageBuffer)
				console.log('[GRIN2] Response sent successfully')

				// For testing purposes, let's not delete the temp directory immediately
				// console.log(`[GRIN2] Temporary files kept for inspection at: ${tempDir}`)
			} finally {
				// We're not cleaning up the temp directory for local testing
				// This allows you to examine the files after running
				// console.log(`[GRIN2] Skipping cleanup of temporary directory for debugging: ${tempDir}`)
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
