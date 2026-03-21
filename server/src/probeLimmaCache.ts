import crypto from 'crypto'
import path from 'path'
import fs from 'fs'
import { spawn } from 'child_process'
import { Readable } from 'stream'
import serverconfig from './serverconfig.js'

const CACHE_SUBDIR = 'probeLimma'

/**
 * Compute a deterministic cache path for a given dataset + group comparison.
 * The hash includes sorted sample names and confounder info so the same
 * comparison always maps to the same file.
 */
export function getProbeLimmaCachePath(dsLabel: string, group1: string[], group2: string[], confounders?: any): string {
	const sorted1 = [...group1].sort().join(',')
	const sorted2 = [...group2].sort().join(',')
	const hash = crypto
		.createHash('md5')
		.update(`${sorted1}|${sorted2}|${JSON.stringify(confounders || {})}`)
		.digest('hex')
		.slice(0, 12)
	return path.join(serverconfig.cachedir, CACHE_SUBDIR, `${dsLabel}_${hash}.json`)
}

type CacheStatus =
	| { status: 'ready'; path: string }
	| { status: 'computing' }
	| { status: 'error'; message: string }
	| { status: 'none' }

/**
 * Check the current state of a probe-level limma cache.
 */
export function getProbeLimmaCacheStatus(cachePath: string): CacheStatus {
	if (fs.existsSync(cachePath)) {
		return { status: 'ready', path: cachePath }
	}
	const runningPath = cachePath + '.running'
	if (fs.existsSync(runningPath)) {
		return { status: 'computing' }
	}
	const errorPath = cachePath + '.error'
	if (fs.existsSync(errorPath)) {
		const message = fs.readFileSync(errorPath, 'utf-8').trim()
		return { status: 'error', message }
	}
	return { status: 'none' }
}

type ProbeLimmaInput = {
	probe_h5_file: string
	case: string
	control: string
	min_samples_per_group?: number
	conf1?: any[]
	conf1_mode?: string
	conf2?: any[]
	conf2_mode?: string
	cache_file: string
	running_file: string
}

/**
 * Spawn probeLimma.R as a detached background process.
 * Creates a .running marker file, then fires and forgets.
 * The R script removes the marker on completion/failure.
 */
export function spawnProbeLimmaJob(cachePath: string, input: ProbeLimmaInput): void {
	const runningPath = cachePath + '.running'

	// Don't spawn duplicates
	if (fs.existsSync(runningPath) || fs.existsSync(cachePath)) return

	// Ensure cache directory exists
	const cacheDir = path.dirname(cachePath)
	fs.mkdirSync(cacheDir, { recursive: true })

	// Create .running marker
	fs.writeFileSync(runningPath, String(Date.now()))

	// Clear any previous error
	const errorPath = cachePath + '.error'
	if (fs.existsSync(errorPath)) fs.unlinkSync(errorPath)

	// Resolve R script path
	// @sjcrh/proteinpaint-r puts scripts in R/src/ relative to the package
	const rScriptDir = path.join(import.meta.dirname, '..', '..', 'R', 'src')
	const rScriptPath = path.join(rScriptDir, 'probeLimma.R')

	const jsonInput = JSON.stringify(input)

	// Spawn detached Rscript process
	const child = spawn('Rscript', [rScriptPath], {
		detached: true,
		stdio: ['pipe', 'ignore', 'ignore']
	})

	// Pipe input JSON to stdin
	try {
		const inputStr = jsonInput.endsWith('\n') ? jsonInput : jsonInput + '\n'
		Readable.from(inputStr).pipe(child.stdin!)
	} catch (e) {
		// If piping fails, clean up
		child.kill()
		if (fs.existsSync(runningPath)) fs.unlinkSync(runningPath)
		fs.writeFileSync(errorPath, `Failed to start probeLimma: ${e}`)
		return
	}

	// Handle unexpected process errors
	child.on('error', err => {
		if (fs.existsSync(runningPath)) fs.unlinkSync(runningPath)
		fs.writeFileSync(errorPath, `probeLimma process error: ${err.message}`)
	})

	// On exit, if running file still exists, the R script didn't clean up — write error
	child.on('exit', (code: number | null) => {
		if (code !== 0 && fs.existsSync(runningPath)) {
			fs.unlinkSync(runningPath)
			if (!fs.existsSync(errorPath)) {
				fs.writeFileSync(errorPath, `probeLimma exited with code ${code}`)
			}
		}
	})

	// Detach so it runs independently of the Node.js process
	child.unref()
}
