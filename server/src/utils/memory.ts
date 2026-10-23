import fs from 'fs'
import os from 'os'
import path from 'path'
import serverconfig from '#src/serverconfig.js'
import { mayLog } from '../helpers.ts'
import { runToolOutput } from '../tools/index.ts'

/** Memory utilities for heavy processes (GRIN2, DE, DM, top variably expressed genes): read the available system memory
 * in megabytes, estimate a run's peak from a cost measured on real runs, and either refuse a run that does not fit or
 * cap the size that may be trimmed. */

/** Peak memory of one run of a heavy process, as a line in the sizes that drive it: baseMB, plus perUnitMB[size] for
 * each unit of that size the run holds. A size is anything the run grows with: lesions for GRIN2, samples x genes
 * cells for DE, the rows x samples a methylation file holds, samples for top variably expressed genes. Fit it to
 * measured runs, and pick values at or above every run. maxMB, optional, is the most that one run by this cost may plan
 * for, however large the budget: DE sets one, so a high-memory host does not admit a DE run larger than any it allows. */
export type MemoryCost = { baseMB: number; perUnitMB: Record<string, number>; maxMB?: number }

/** The size of one run in each of the units of a MemoryCost */
export type MemoryUnits = Record<string, number>

/** serverconfig.memoryBudget, optional: { maxMB, fraction, mode }
 * maxMB: the most MB that the heavy runs of this server may plan for together, however much memory is available,
 * DEFAULT_MAX_MB by default, or no cap in report mode, which then reports each run against the available memory alone.
 * Each run's estimate comes out of it, less what runs in progress have reserved (reserveMemoryMB). By default this
 * alone is the budget, up to all the available memory.
 * fraction: optional, a share of the available memory to plan within as well, to leave the rest as headroom for the
 * rest of the server and for error in the costs; 1 (all of it) by default. The budget is the smaller of fraction of
 * the available memory and maxMB, see memoryBudgetMB().
 * mode: 'enforce' (default) refuses a run that does not fit and trims one that may be trimmed. 'report' only logs the
 * available memory and whether each run would fit, and lets every run go ahead in full. */
const memoryBudget = serverconfig.memoryBudget || {}
validateMemoryBudget(memoryBudget)

/** Throws for a serverconfig.memoryBudget value of the wrong type or range, so that the server does not start with a
 * budget other than the one written, e.g. fraction: true or mode: ['report'] */
export function validateMemoryBudget(memoryBudget: any): void {
	if ('fraction' in memoryBudget) {
		const f = memoryBudget.fraction
		if (!(typeof f == 'number' && f > 0 && f <= 1))
			throw `serverconfig.memoryBudget.fraction must be a number above 0 and at most 1`
	}
	if ('maxMB' in memoryBudget && !(Number.isFinite(memoryBudget.maxMB) && memoryBudget.maxMB > 0))
		throw `serverconfig.memoryBudget.maxMB must be a number above 0`
	if ('mode' in memoryBudget && memoryBudget.mode !== 'enforce' && memoryBudget.mode !== 'report')
		throw `serverconfig.memoryBudget.mode must be 'enforce' or 'report'`
}

export const RUN_MEMORY_FRACTION: number = memoryBudget.fraction ?? 1

/** The total that heavy runs may plan for together when serverconfig sets no maxMB: 3 GB, for one DE run at its 500
 * samples (≤ DE_MAX_MB, 2,200 MB) beside smaller runs, so that a high-memory host still bounds them. Estimates are held
 * to it, so a larger run is refused under the default: differential methylation on a full cohort of the larger element
 * classes (MMRF allccre ~6,287 MB, panMB promoter ~4,454, DISCOVER allccre ~3,715, MMRF promoter ~3,202). A server that
 * needs those sets a higher maxMB.
 * TODO: benchmark DM and differential splicing, give each its own maxMB per run as DE has, and revisit this default. */
export const DEFAULT_MAX_MB = 3072

// report mode without a maxMB has no cap: it refuses nothing, and reports whether each run fits in the free memory
export const RUN_MEMORY_MAX_MB: number =
	memoryBudget.maxMB ?? (memoryBudget.mode === 'report' ? Infinity : DEFAULT_MAX_MB)

/** The MB that heavy runs may plan for together: `fraction` of availableMB, at most `maxMB`
 * @example
 * memoryBudgetMB(16000) // 3072: the default maxMB, below the 16,000 MB free
 * memoryBudgetMB(2000) // 2000: all the free memory, below the default maxMB
 * memoryBudgetMB(16000, 0.4, 8192) // 6400: 40% of 16,000 MB, below maxMB
 */
export function memoryBudgetMB(availableMB: number, fraction = RUN_MEMORY_FRACTION, maxMB = RUN_MEMORY_MAX_MB): number {
	return Math.min(availableMB * fraction, maxMB)
}

/** serverconfig.memoryBudget.mode is 'report': log, never refuse or trim */
export const MEMORY_REPORT_ONLY = memoryBudget.mode == 'report'

/** MB reserved by heavy runs in progress in this server process; see reserveMemoryMB() */
let reservedMB = 0

export function memoryReservedMB(): number {
	return reservedMB
}

/** Reserves `mb` (a run's estimated peak) until the returned release is called, in a finally once the run's work
 * ends. runFitsInMemory() and largestSizeThatFits() take what is reserved off the budget, so runs that each fit alone
 * are not all admitted together and then allocate at once. Reserve in the same synchronous step as the check that
 * admitted the run, with no await between, or a run admitted in between is not counted; admitRun() does both.
 * A running child's memory also lowers the available memory read later, so it counts twice until the run ends: this
 * errs toward refusing. ponytail: one process only; servers sharing a host each keep their own total.
 * `label` names the run in the server log, e.g. 'DM'. */
export function reserveMemoryMB(mb: number, label = 'a run'): () => void {
	reservedMB += mb
	let released = false
	return () => {
		if (released) return
		released = true
		reservedMB -= mb
		mayLog(`[memory] ${label} released ${formatMB(mb)}, ${formatMB(reservedMB)} still reserved`)
	}
}

/** Logs whether a heavy run was admitted, in one format for every route; see memoryAdmissionMessage(). Always logged in
 * report mode, and only in debugmode otherwise. Called before the run's own memory is reserved, so the reserved figure
 * is the other runs'. */
export function logMemoryAdmission(
	label: string,
	admitted: boolean,
	neededMB: number,
	availableMB: number,
	fraction = RUN_MEMORY_FRACTION,
	reportOnly = MEMORY_REPORT_ONLY,
	/** the cost's maxMB, the most one run may plan for */
	runMaxMB?: number
): void {
	const message = memoryAdmissionMessage(label, admitted, neededMB, availableMB, fraction, reportOnly, runMaxMB)
	// report mode exists to show these lines on a deployed server, where debugmode is off
	if (reportOnly) console.log(message)
	else mayLog(message)
}

/** The line that logMemoryAdmission() logs. It names the fixed cap that applies to the run, and whether the run is
 * under it: the run's own maxMB when the cost has one below serverconfig's, else serverconfig's maxMB. e.g.
 * `[memory] DE limma admitted: needs 2,150 MB, under the 2,200 MB per-run maxMB, of a 3,072 MB budget (maxMB, below
 * 16,000 MB free), 0 MB reserved by runs in progress`
 * `[memory] DM refused: needs 6,134 MB, over the 3,072 MB maxMB, of a 3,072 MB budget (maxMB, below 16,000 MB free),
 * 0 MB reserved by runs in progress`
 * With a fraction set, the budget names its share, e.g. `(40% of 16,000 MB free)`.
 * In report mode it says whether the run fits instead, e.g. `[memory] DM does not fit (report only): needs ...`, and
 * without a maxMB there is no cap to name: `[memory] DM fits (report only): needs 6,134 MB, of a 16,000 MB budget
 * (16,000 MB free), 0 MB reserved by runs in progress` */
export function memoryAdmissionMessage(
	label: string,
	admitted: boolean,
	neededMB: number,
	availableMB: number,
	fraction = RUN_MEMORY_FRACTION,
	reportOnly = MEMORY_REPORT_ONLY,
	runMaxMB?: number,
	maxMB = RUN_MEMORY_MAX_MB,
	reserved = reservedMB
): string {
	const decision = reportOnly
		? `${admitted ? 'fits' : 'does not fit'} (report only)`
		: admitted
		? 'admitted'
		: 'refused'
	const perRun = runMaxMB != undefined && runMaxMB < maxMB
	const cap = perRun ? runMaxMB : maxMB
	const budget = memoryBudgetMB(availableMB, fraction, maxMB)
	// all of the free memory when serverconfig sets maxMB alone
	const share = `${fraction == 1 ? '' : `${fraction * 100}% of `}${formatMB(availableMB)} free`
	// no cap in report mode without a maxMB
	const capped = Number.isFinite(cap)
		? `${neededMB <= cap ? 'under' : 'over'} the ${formatMB(cap)} ${perRun ? 'per-run maxMB' : 'maxMB'}, `
		: ''
	return (
		`[memory] ${label} ${decision}: needs ${formatMB(neededMB)}, ${capped}of a ${formatMB(budget)} budget ` +
		`(${budget < availableMB * fraction ? `maxMB, below ${share}` : share}), ` +
		`${formatMB(reserved)} reserved by runs in progress`
	)
}

function formatMB(mb: number): string {
	return `${Math.round(mb).toLocaleString()} MB`
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
 * progress, and in the cost's own maxMB if it has one. Callers that must not trim a run refuse one that does not fit, e.g.
 * `if (!runFitsInMemory(...)) throw lowMemoryError(...)`, then reserve its memory; admitRun() does both. The default budget
 * is all of availableMB, capped at RUN_MEMORY_MAX_MB (3,072 MB unless serverconfig.memoryBudget sets it), or the share
 * that serverconfig's fraction sets. The examples assume nothing is reserved and the defaults.
 * @example
 * runFitsInMemory(DE_MEMORY.edgeR, { cells: 4438 * 17928 }, 12000) // false: ≈ 8938 MB > 3072 budget
 * runFitsInMemory(DE_MEMORY.wilcoxon, { cells: 4438 * 17928, spanCells: 4438 * 17928 }, 12000) // false: ≈ 2551 MB fits
 * // the 3072 budget, but not DE's own 2200 maxMB
 * runFitsInMemory(DE_MEMORY.limma, { cells: 500 * 17928 }, 100000) // true: ≈ 2150 MB <= DE's 2200 maxMB
 * runFitsInMemory(DM_MEMORY, { fileCells: 267531 * 415, cells: 267531 * 400 }, 16000) // false: ≈ 6134 > 3072 maxMB
 * runFitsInMemory(DM_MEMORY, { fileCells: 114875 * 415, cells: 114875 * 200 }, 16000) // true: ≈ 2263 <= 3072
 * runFitsInMemory(TOPVE_MEMORY, { samples: 4873 }, 100) // false: ≈ 145 > all 100 MB free
 */
export function runFitsInMemory(
	cost: MemoryCost,
	units: MemoryUnits,
	availableMB: number,
	fraction = RUN_MEMORY_FRACTION,
	reservedMB = memoryReservedMB()
): boolean {
	return (
		estimatePeakMB(cost, units) <= Math.min(cost.maxMB ?? Infinity, memoryBudgetMB(availableMB, fraction) - reservedMB)
	)
}

/** The largest `size` (e.g. lesions) whose run fits in `fraction` of `availableMB`, less `reservedMB`, and in the cost's
 * own maxMB if it has one; 0 when even the
 * base does not fit. For a run that may be trimmed rather than refused: the caller caps the size at this, as GRIN2 caps
 * its lesions, and reserves the capped run's memory. The cost must have no other size (estimatePeakMB throws if it
 * does). The examples assume nothing is reserved.
 * @example
 * largestSizeThatFits(1500, GRIN2_MEMORY, 'lesions') // 430769: (1500 budget - 380 base) / 0.0026
 * largestSizeThatFits(300, GRIN2_MEMORY, 'lesions') // 0: 300 budget < 380 base, so GRIN2 refuses the run
 * largestSizeThatFits(2048, GRIN2_MEMORY, 'lesions', 1) // 641538: the whole 2 GB as budget, under the default maxMB
 */
export function largestSizeThatFits(
	availableMB: number,
	cost: MemoryCost,
	size: string,
	fraction = RUN_MEMORY_FRACTION,
	reservedMB = memoryReservedMB()
): number {
	const base = estimatePeakMB(cost, { [size]: 0 })
	const room = Math.min(cost.maxMB ?? Infinity, memoryBudgetMB(availableMB, fraction) - reservedMB)
	return Math.max(0, Math.floor((room - base) / cost.perUnitMB[size]))
}

/** Admits a heavy run that must not be trimmed, such as DE or DM: logs the decision, then throws lowMemoryError(refusal)
 * when the run does not fit beside the runs in progress, or reserves its estimated peak and returns the release to call
 * in a finally once its engine ends. Check and reservation are one synchronous step. `refusal` may be a function, for a
 * message that is costly to build or only needed on refusal. In report mode it logs and reserves, but never throws.
 * @example
 * const releaseMemory = admitRun('DM', DM_MEMORY, units, await getAvailableMemoryMB(), 'Select a smaller cohort.')
 * try { await run_R(...) } finally { releaseMemory() }
 */
export function admitRun(
	label: string,
	cost: MemoryCost,
	units: MemoryUnits,
	availableMB: number,
	refusal: string | (() => string),
	reportOnly = MEMORY_REPORT_ONLY
): () => void {
	const neededMB = estimatePeakMB(cost, units)
	const admitted = runFitsInMemory(cost, units, availableMB)
	logMemoryAdmission(label, admitted, neededMB, availableMB, RUN_MEMORY_FRACTION, reportOnly, cost.maxMB)
	if (!admitted && !reportOnly) throw lowMemoryError(typeof refusal == 'function' ? refusal() : refusal)
	return reserveMemoryMB(neededMB, label)
}

/** The error for a run refused because memory is low: status 503 and code LOW_MEMORY, with a message that tells the
 * user what to change */
export function lowMemoryError(message: string): Error {
	const e: any = new Error(message)
	e.status = 503
	e.code = 'LOW_MEMORY'
	return e
}
