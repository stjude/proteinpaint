import type { RunGRIN2Request, RunGRIN2Response, RouteApi } from '#types'
import { runGRIN2Payload } from '#types/checkers'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import { run_R } from '@sjcrh/proteinpaint-r'
import fs from 'fs/promises'
import path from 'path'
import serverconfig from '#src/serverconfig.js'
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
		post: {
			...runGRIN2Payload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		try {
			const g = genomes.hg38
			if (!g) throw 'hg38 missing'
			const ds = g.datasets.GDC
			if (!ds) throw 'hg38 GDC missing'

			// Cast the request body to RunGRIN2Request type
			const { fileIds } = req.body as RunGRIN2Request

			if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
				throw 'Missing or invalid fileIds'
			}

			// Create a temporary directory for our output image
			const timestamp = Date.now()
			const tempDir = path.join(serverconfig.dir.tmp, `grin2_${timestamp}`)
			const outputImagePath = path.join(tempDir, 'grin2_output.png')

			await fs.mkdir(tempDir, { recursive: true })

			try {
				console.log(`Running GRIN2 analysis for ${fileIds.length} files`)

				// Step 1: Call Rust to process the MAF files and get JSON data
				console.log('Calling Rust for file processing...')
				const startTime = Date.now()

				// Prepare input parameters for the Rust function
				const rustInput = JSON.stringify({
					fileIds: fileIds
				})

				// Call the Rust implementation and get JSON result
				const rustResult = await run_rust('gdcGRIN2', rustInput)

				// Check if Rust execution was successful
				if (!rustResult) {
					throw new Error('Failed to process MAF files: No result from Rust')
				}

				// Step 2: Call R script to generate the plot
				console.log('Calling R script to generate plot...')

				// Prepare input for R script - pass the Rust output as input to R
				const rInput = JSON.stringify({
					rustData: rustResult,
					outputPath: outputImagePath
				})

				// Call the R script
				const rResult = await run_R('gdcGRIN2.R', rInput, [])

				// Parse R result to get metadata or check for errors
				const resultData = JSON.parse(rResult)

				if (!resultData.success) {
					throw new Error(resultData.error || 'R script failed to generate plot')
				}

				// Step 3: Read the generated image
				const imageExists = await fs
					.access(outputImagePath)
					.then(() => true)
					.catch(() => false)
				if (!imageExists) {
					throw new Error('R script completed but output image not found')
				}

				const imageBuffer = await fs.readFile(outputImagePath)
				const executionTime = mayLog(formatElapsedTime(Date.now() - startTime))

				// Create a metadata object for logging
				const metadata = {
					filesAnalyzed: fileIds.length,
					samplesIncluded: rustResult.sampleCount || 0,
					analysisDate: new Date().toISOString(),
					executionTime
				}

				// Log metadata for debugging
				console.log('GRIN2 analysis completed:', metadata)

				// Send the image to the client
				res.setHeader('Content-Type', 'image/png')
				res.setHeader('Content-Disposition', 'inline; filename="grin2_analysis.png"')
				res.send(imageBuffer)
			} finally {
				// Clean up temporary files
				try {
					await fs.rm(tempDir, { recursive: true, force: true })
				} catch (e) {
					console.error('Error cleaning up temp files:', e)
				}
			}
		} catch (e: any) {
			console.error('Error running GRIN2 analysis:', e)

			// Use the RunGRIN2Response type for error case
			const errorResponse: RunGRIN2Response = {
				status: 'error',
				error: e.message || String(e)
			}

			res.status(500).send(errorResponse)
		}
	}
}
