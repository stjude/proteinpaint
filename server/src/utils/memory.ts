import fs from 'fs'
import os from 'os'
import path from 'path'
import { mayLog } from '../helpers.ts'
import { runToolOutput } from '../tools/index.ts'

/** Memory utilities for heavy processes (GRIN2, DE, DM, top variably expressed genes): read the available system memory
 * in megabytes, estimate a run's peak from a cost measured on real runs, and either refuse a run that does not fit or
 * cap the size that may be trimmed. */

/** Peak memory of one run of a heavy process, as a line in the sizes that drive it: baseMB, plus perUnitMB[size] for
 * each unit of that size the run holds. A size is anything the run grows with: lesions for GRIN2, samples x genes
 * cells for DE, the rows x samples a methylation file holds, samples for top variably expressed genes. Fit it to
 * measured runs, and pick values at or above every run. */
export type MemoryCost = { baseMB: number; perUnitMB: Record<string, number> }

/** The size of one run in each of the units of a MemoryCost */
export type MemoryUnits = Record<string, number>

/** Share of the available memory that the heavy runs of this server may plan for together: each run's estimate comes
 * out of it, less what runs in progress have reserved (reserveMemoryMB). The rest is headroom for the rest of the
 * server and for error in the costs. */
export const RUN_MEMORY_FRACTION = 0.4

/** MB reserved by heavy runs in progress in this server process; see reserveMemoryMB() */
let reservedMB = 0

export function memoryReservedMB(): number {
	return reservedMB
}

/** Reserves `mb` (a run's estimated peak) until the returned release is called, in a finally once the run's work
 * ends. runFitsInMemory() and largestSizeThatFits() take what is reserved off the budget, so runs that each fit alone
 * are not all admitted together and then allocate at once. Reserve in the same synchronous step as the check that
 * admitted the run, with no await between, or a run admitted in between is not counted:
 *
 *   if (!runFitsInMemory(cost, units, await getAvailableMemoryMB())) throw lowMemoryError(...)
 *   const releaseMemory = reserveMemoryMB(estimatePeakMB(cost, units))
 *   try { await runTheEngine() } finally { releaseMemory() }
 *
 * A running child's memory also lowers the available memory read later, so it counts twice until the run ends: this
 * errs toward refusing. ponytail: one process only; servers sharing a host each keep their own total. */
export function reserveMemoryMB(mb: number): () => void {
	reservedMB += mb
	let released = false
	return () => {
		if (released) return
		released = true
		reservedMB -= mb
	}
}

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

/** The estimated peak MB of a run of these sizes by `cost`. Every size of the cost must be given, so a caller cannot
 * leave one out and get a low estimate. The @example outputs here and below are asserted in
 * test/memoryCosts.unit.spec.ts, so update both together.
 * @example
 * estimatePeakMB(GRIN2_MEMORY, { lesions: 250_000 }) // 1030: 380 + 0.0026 × 250,000
 * estimatePeakMB(DE_MEMORY.edgeR, { cells: 4438 * 17928 }) // ≈ 8938: all ASH, 17,928 genes
 * estimatePeakMB(DE_MEMORY.wilcoxon, { cells: 4438 * 17928, spanCells: 4438 * 17928 }) // ≈ 2551
 * // wilcoxon reads every column between the first and last selected sample: 20 samples over 10,000 columns
 * estimatePeakMB(DE_MEMORY.wilcoxon, { cells: 20 * 60660, spanCells: 10000 * 60660 }) // ≈ 2594
 * estimatePeakMB(TOPVE_MEMORY, { samples: 4873 }) // ≈ 145
 * // DM, MMRF allccre: 267,531 rows x 415 samples in the file, 400 of them selected
 * estimatePeakMB(DM_MEMORY, { fileCells: 267531 * 415, cells: 267531 * 400 }) // ≈ 6134 (measured peak 5,057)
 * estimatePeakMB(DM_MEMORY, { cells: 267531 * 400 }) // throws "memory cost needs the run's fileCells"
 */
export function estimatePeakMB(cost: MemoryCost, units: MemoryUnits): number {
	let mb = cost.baseMB
	for (const [size, perUnit] of Object.entries(cost.perUnitMB)) {
		if (!Number.isFinite(units[size])) throw new Error(`memory cost needs the run's ${size}`)
		mb += perUnit * units[size]
	}
	return mb
}

/** Whether a run of these sizes fits in `fraction` of `availableMB`, less `reservedMB`, the memory reserved by runs in
 * progress. Callers that must not trim a run refuse one that does not fit, e.g.
 * `if (!runFitsInMemory(...)) throw lowMemoryError(...)`, then reserve its memory (reserveMemoryMB). The default budget
 * is 40% of availableMB. The examples assume nothing is reserved.
 * @example
 * runFitsInMemory(DE_MEMORY.edgeR, { cells: 4438 * 17928 }, 12000) // false: ≈ 8938 MB > 4800 budget
 * runFitsInMemory(DE_MEMORY.wilcoxon, { cells: 4438 * 17928, spanCells: 4438 * 17928 }, 12000) // true: ≈ 2551 MB
 * runFitsInMemory(DM_MEMORY, { fileCells: 267531 * 415, cells: 267531 * 400 }, 16000) // true: ≈ 6134 <= 6400
 * runFitsInMemory(DM_MEMORY, { fileCells: 267531 * 415, cells: 267531 * 400 }, 12000) // false: ≈ 6134 > 4800
 * runFitsInMemory(TOPVE_MEMORY, { samples: 4873 }, 200) // false: ≈ 145 > 80
 */
export function runFitsInMemory(
	cost: MemoryCost,
	units: MemoryUnits,
	availableMB: number,
	fraction = RUN_MEMORY_FRACTION,
	reservedMB = memoryReservedMB()
): boolean {
	return estimatePeakMB(cost, units) <= availableMB * fraction - reservedMB
}

/** The largest `size` (e.g. lesions) whose run fits in `fraction` of `availableMB`, less `reservedMB`; 0 when even the
 * base does not fit. For a run that may be trimmed rather than refused: the caller caps the size at this, as GRIN2 caps
 * its lesions, and reserves the capped run's memory. The cost must have no other size (estimatePeakMB throws if it
 * does). The examples assume nothing is reserved.
 * @example
 * largestSizeThatFits(1500, GRIN2_MEMORY, 'lesions') // 84615: (600 budget - 380 base) / 0.0026
 * largestSizeThatFits(900, GRIN2_MEMORY, 'lesions') // 0: 360 budget < 380 base, so GRIN2 refuses the run
 * largestSizeThatFits(2048, GRIN2_MEMORY, 'lesions', 1) // 641538: GRIN2's hard ceiling, the whole 2 GB as budget
 */
export function largestSizeThatFits(
	availableMB: number,
	cost: MemoryCost,
	size: string,
	fraction = RUN_MEMORY_FRACTION,
	reservedMB = memoryReservedMB()
): number {
	const base = estimatePeakMB(cost, { [size]: 0 })
	return Math.max(0, Math.floor((availableMB * fraction - reservedMB - base) / cost.perUnitMB[size]))
}

/** The error for a run refused because memory is low: status 503 and code LOW_MEMORY, with a message that tells the
 * user what to change */
export function lowMemoryError(message: string): Error {
	const e: any = new Error(message)
	e.status = 503
	e.code = 'LOW_MEMORY'
	return e
}
