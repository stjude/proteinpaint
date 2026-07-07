/** Memory-aware lesion cap for GRIN2. Reads available system memory and derives how many lesions a run
 * may hold, so a busy server scales the cap down instead of OOMing. Split out of main.ts as a self-contained
 * concern; getMaxLesions() is the only export (processSampleData calls it). */

import serverconfig from '../serverconfig.js'
import os from 'os'
import { mayLog } from '../helpers.ts'
import { promisify } from 'node:util'
import { exec as execCallback } from 'node:child_process'

const exec = promisify(execCallback)

// Constants
const MAX_LESIONS = serverconfig.features.grin2maxLesions || 250000 // Maximum total number of lesions to process to avoid overwhelming the production server
const GRIN2_MEMORY_BUDGET_MB = 950
const MEMORY_BASE_MB = 260
const MEMORY_PER_1K_LESIONS = 2.4
const MIN_LESIONS = 50000

async function getAvailableMemoryMB(): Promise<number> {
	try {
		if (process.platform === 'darwin') {
			// macOS: use vm_stat
			const { stdout } = await exec('vm_stat')
			const output = stdout.toString()

			// Parse page size from vm_stat header: "page size of 4096 bytes for Apple silicon, 16384 bytes for Intel macs"
			const headerLine = output.split('\n')[0] || ''
			const pageSizeMatch = headerLine.match(/page size of\s+(\d+)\s+bytes/i)
			const pageSize = pageSizeMatch ? parseInt(pageSizeMatch[1], 10) : 16384
			const freeMatch = output.match(/Pages free:\s+(\d+)/)
			const inactiveMatch = output.match(/Pages inactive:\s+(\d+)/)
			const freePages = freeMatch ? parseInt(freeMatch[1], 10) : 0
			const inactivePages = inactiveMatch ? parseInt(inactiveMatch[1], 10) : 0

			// Available ≈ free + inactive
			return ((freePages + inactivePages) * pageSize) / (1024 * 1024)
		} else {
			// Linux: use free command
			const { stdout } = await exec('free -m')
			const output = stdout.toString()
			const lines = output.split('\n')
			const memLine = lines.find(l => l.startsWith('Mem:'))
			if (memLine) {
				const parts = memLine.split(/\s+/)
				return parseInt(parts[6]) // "available" column
			}
		}
	} catch (e) {
		mayLog(`[GRIN2] Memory check failed, using fallback: ${e}`)
	}

	// Fallback: os.freemem (less accurate but always works)
	return os.freemem() / (1024 * 1024)
}

export async function getMaxLesions(): Promise<number> {
	const availableMemoryMB = await getAvailableMemoryMB()
	mayLog(`[GRIN2] Available system memory: ${availableMemoryMB.toFixed(0)} MB`)

	// If server is under heavy load, reduce lesion cap. Our calculation assumes each 1,000 lesions use ~2.4MB of memory plus a base overhead (i.e. a linear relationship).
	if (availableMemoryMB < GRIN2_MEMORY_BUDGET_MB * 2) {
		const reducedBudget = availableMemoryMB * 0.4
		mayLog(`[GRIN2] Reducing lesion cap due to memory constraints. New budget: ${reducedBudget.toFixed(2)} MB`)
		const calculated = Math.floor((reducedBudget - MEMORY_BASE_MB) / MEMORY_PER_1K_LESIONS) * 1000
		mayLog(`[GRIN2] Calculated lesion cap based on memory: ${calculated.toLocaleString()}`)
		return Math.max(MIN_LESIONS, Math.min(MAX_LESIONS, calculated))
	}

	return MAX_LESIONS
}
