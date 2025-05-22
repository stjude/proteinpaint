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

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		try {
			console.log('[GRIN2] Validating genome configuration')
			const g = genomes.hg38
			if (!g) throw 'hg38 missing'
			const ds = g.datasets.GDC
			if (!ds) throw 'hg38 GDC missing'

			const caseFiles = req.query as RunGRIN2Request
			console.log(`[GRIN2] Request received: ${JSON.stringify(caseFiles)}`)

			if (!caseFiles) {
				throw 'Missing or invalid cases data'
			}

			// Step 1: Call Rust to process the MAF files and get JSON data
			console.log('[GRIN2] Calling Rust for file processing...')

			//console.log(`[GRIN2] Rust input: ${rustInput}`)
			const rustInput = JSON.stringify(caseFiles)

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
			try {
				parsedRustResult = typeof rustResult === 'string' ? JSON.parse(rustResult) : rustResult
				console.log(`[GRIN2] Parsed Rust result: ${JSON.stringify(parsedRustResult).substring(0, 200)}...`)
			} catch (parseError) {
				console.error('[GRIN2] Error parsing Rust result:', parseError)
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
				lesion: rustResult // The mutation string from Rust
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
				return res.json({ pngImg })
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
