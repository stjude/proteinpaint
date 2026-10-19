/** Memory utilities for heavy processes such as GRIN2: read the available system memory in megabytes, size a run to
 * fit in a share of it with a linear cost, and refuse a run that cannot fit. */

import fs from 'fs'
import os from 'os'
import path from 'path'
import { mayLog } from '../helpers.ts'
import { runToolOutput } from '../tools/index.ts'

export async function getAvailableMemoryMB(): Promise<number> {
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
			mayLog(`Memory check failed, using fallback: ${e}`)
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

/** Peak memory of one run of a heavy process, as a line: baseMB plus perUnitMB for each unit the run holds (a lesion,
 * a matrix row, a sample×gene cell). Fit it to measured runs, and pick values at or above every run. */
export type MemoryCost = { baseMB: number; perUnitMB: number }

/** Share of the available memory that one run may plan for. The rest is headroom for runs that start at the same time
 * and read the same available memory, for the rest of the server, and for error in the cost. */
export const RUN_MEMORY_FRACTION = 0.4

/** The most units of `cost` that fit in `fraction` of `availableMB`; 0 when even the base does not fit. Callers decide
 * what to do with the count: cap the run at it, or refuse a run that needs more. */
export function maxUnitsThatFit(availableMB: number, cost: MemoryCost, fraction = RUN_MEMORY_FRACTION): number {
	return Math.max(0, Math.floor((availableMB * fraction - cost.baseMB) / cost.perUnitMB))
}

/** The error for a run refused because memory is low: status 503 and code LOW_MEMORY, with a message that tells the
 * user what to change */
export function lowMemoryError(message: string): Error {
	const e: any = new Error(message)
	e.status = 503
	e.code = 'LOW_MEMORY'
	return e
}
