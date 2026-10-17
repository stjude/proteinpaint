/** Memory-aware lesion cap for GRIN2. Reads available memory and derives how many lesions a run
 * may hold, so a busy server scales the cap down instead of OOMing. Split out of main.ts as a self-contained
 * concern; processSampleData calls getMaxLesions(). */

import serverconfig from '../serverconfig.js'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { mayLog } from '../helpers.ts'
import { runToolOutput } from '../tools/index.ts'

// Constants
const MAX_LESIONS = serverconfig.features.grin2maxLesions || 250000 // Maximum total number of lesions to process to avoid overwhelming the production server
const GRIN2_MEMORY_BUDGET_MB = 950
const MEMORY_BASE_MB = 260
const MEMORY_PER_1K_LESIONS = 2.4
const MIN_LESIONS = 50000

async function getAvailableMemoryMB(): Promise<number> {
	if (process.platform === 'darwin') {
		// macOS keeps few pages free and fills the rest with reclaimable cache, which process.availableMemory()
		// and os.freemem() count as used, so free + inactive pages are read from vm_stat
		try {
			const { code, stdout: output } = await runToolOutput('vm_stat', {})
			if (code !== 0) throw `vm_stat exited with code ${code}`

			// Parse page size from vm_stat header: "page size of 16384 bytes" on Apple silicon, 4096 on Intel macs
			const headerLine = output.split('\n')[0] || ''
			const pageSizeMatch = headerLine.match(/page size of\s+(\d+)\s+bytes/i)
			const pageSize = pageSizeMatch ? parseInt(pageSizeMatch[1], 10) : 16384
			const freeMatch = output.match(/Pages free:\s+(\d+)/)
			const inactiveMatch = output.match(/Pages inactive:\s+(\d+)/)
			const freePages = freeMatch ? parseInt(freeMatch[1], 10) : 0
			const inactivePages = inactiveMatch ? parseInt(inactiveMatch[1], 10) : 0

			// Available ≈ free + inactive
			return ((freePages + inactivePages) * pageSize) / (1024 * 1024)
		} catch (e) {
			mayLog(`[GRIN2] Memory check failed, using fallback: ${e}`)
			return os.freemem() / (1024 * 1024)
		}
	}

	// On a host, process.availableMemory() is MemAvailable, the same as the "available" column of free -m. In a
	// memory-limited container, where free and os.freemem() report the host's memory, it is the container's limit
	// minus its usage. That usage includes reclaimable file cache, which the kernel drops before an OOM kill, so it
	// is added back. Other workloads can leave the host with less than that, so the estimate is also bounded by the
	// host's MemAvailable, which os.freemem() reads on Linux and which counts reclaimable cache as available too.
	const limit = process.constrainedMemory()
	let available = process.availableMemory()
	// with no limit, constrainedMemory() is 0 on some platforms and 2^64 on Linux
	if (limit && limit <= os.totalmem()) {
		available = Math.min(limit, os.freemem(), available + getCgroupInactiveFileBytes())
	}
	return available / (1024 * 1024)
}

/** Reclaimable file cache of this process's cgroup v2, from inactive_file in its memory.stat; 0 if it cannot be read,
 * such as under cgroup v1, which only makes the estimate low.
 * ponytail: cgroup v2 only; read memory/memory.stat total_inactive_file if cgroup v1 hosts need it */
export function getCgroupInactiveFileBytes(readFile = (file: string) => fs.readFileSync(file, 'utf8')): number {
	try {
		// cgroup v2 has a single "0::<path>" line, where the path is / inside a container's cgroup namespace
		const cgroup = /^0::(\/\S*)$/m.exec(readFile('/proc/self/cgroup'))?.[1]
		if (!cgroup) return 0
		const stat = readFile(path.join('/sys/fs/cgroup', cgroup, 'memory.stat'))
		return Number(/^inactive_file (\d+)$/m.exec(stat)?.[1]) || 0
	} catch {
		return 0
	}
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
