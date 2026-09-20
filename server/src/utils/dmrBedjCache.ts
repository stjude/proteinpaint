import path from 'path'
import fs from 'fs'
import { promisify } from 'util'
import { execFile } from 'child_process'
import { randomUUID, createHash } from 'crypto'
import serverconfig from '#src/serverconfig.js'
import type { TermdbDmrBatchSuccessResponse } from '#types'

const run = promisify(execFile)

/** Prefix that marks a bedj cache file as a DMR scan, so the read side knows to check it. */
const DMR_PREFIX = 'dmr-'

/* Binds a cached file to the dataset it was computed from.

The file name travels to the client and is persisted in plot config, so it reaches anyone a
session is shared with. The deleted termdb/dmrScanTrack route refused a cached scan whose recorded
genome/dslabel did not match the dataset the caller asked for -- without that, a name obtained
from a protected dataset could be replayed under any dataset the caller can reach. This carries
the same binding in the name, so the check costs a hash instead of reading and parsing the scan. */
function dsToken(genome: string, dslabel: string): string {
	// hashed rather than spelled out: a dslabel is free-form config and need not be filename-safe
	return createHash('sha256').update(`${genome}\0${dslabel}`).digest('hex').slice(0, 8)
}

/* Refuse a DMR cache file requested under a dataset it was not computed for. Called by the bedj
tk reader for any isCache file; a file without the DMR prefix is not ours and is left alone.

NOTE this restores the ownership half of what the deleted route enforced, not the authentication
half: /tkbedj carries no dslabel in the auth middleware's sense, so it is not itself gated. See
the PR discussion -- gating cached track reads belongs with the isCache path, not here. */
export function assertDmrBedjAccess(file: string, q: { genome?: string; dslabel?: string }) {
	if (!file.startsWith(DMR_PREFIX)) return
	if (!q.genome || !q.dslabel) throw 'genome and dslabel are required for this cached track'
	if (file.split('-')[1] !== dsToken(q.genome, q.dslabel))
		throw 'this cached track does not belong to the requested dataset'
}

/* A scan's DMRs as a bedj track file, under the "bedj" cache subdir that block tracks read with
isCache:true.

Written by the analysis rather than served out of the dmr/ cache by a route of its own: that route
put DMR-specific logic in the genome browser, which had to name the cached scan, fetch the items of
whichever chromosome was on screen and swap them into the track on every pan. A file is just a
track; the browser fetches the region in view like it does for any other bedj file.

One file per (scan, CpG floor), since the floor is a display knob applied after the scan. Written
only when absent, and swept on the bedj subdir's own TTL. */
export async function writeDmrBedjFile(
	payload: TermdbDmrBatchSuccessResponse,
	genome: string,
	dslabel: string,
	cacheId: string,
	minCpgs: number
): Promise<string> {
	const name = `${DMR_PREFIX}${dsToken(genome, dslabel)}-${cacheId}-${minCpgs}.gz`
	const dir = path.join(serverconfig.cachedir, 'bedj')
	const gz = path.join(dir, name)
	// both must be there: the .gz is the commit point, so a lone .tbi is an unfinished publish
	if (fs.existsSync(gz) && fs.existsSync(gz + '.tbi')) {
		/* The subdir is swept by mtime, so touch on reuse: the TTL should mean last-used, not
		first-written, or a scan someone still has open can be swept out from under the track.
		BOTH files, and the INDEX FIRST: tabix rejects an index older than its data file, and a
		concurrent read landing between the two touches must not see that state. Touching the
		index first makes the in-between state "index newer than data", which is fine; the other
		order fails every read in the window with "index file is older than the data file". */
		const now = new Date()
		await fs.promises.utimes(gz + '.tbi', now, now).catch(() => {})
		await fs.promises.utimes(gz, now, now).catch(() => {})
		return name
	}
	await fs.promises.mkdir(dir, { recursive: true })

	// tabix needs each chromosome's lines contiguous and ascending by start; any chr order will do
	const dmrs = (payload.regions || []).flatMap(r => r.dmrs || []).filter(d => d.no_cpgs >= minCpgs)
	dmrs.sort((a, b) => (a.chr == b.chr ? a.start - b.start : a.chr < b.chr ? -1 : 1))
	// 4th column is the bedj item as JSON; category drives both the fill and the block legend
	const lines = dmrs.map(d => {
		const label = `Δβ ${d.meandiff >= 0 ? '+' : ''}${d.meandiff.toFixed(3)}, ${d.no_cpgs} CpGs${
			d.genes?.length ? ', ' + d.genes.join(' ') : ''
		}`
		return `${d.chr}\t${d.start}\t${d.stop}\t${JSON.stringify({ name: label, category: d.direction })}`
	})

	/* Built under a unique name and renamed into place, so two requests for the same scan cannot
	read each other's half-written file. */
	const tmpBed = path.join(dir, `.tmp-${randomUUID()}-${name.slice(0, -3)}`)
	try {
		await fs.promises.writeFile(tmpBed, lines.length ? lines.join('\n') + '\n' : '')
		await run(serverconfig.bgzip, ['-f', tmpBed]) // writes tmpBed + '.gz'
		await run(serverconfig.tabix, ['-f', '-p', 'bed', tmpBed + '.gz'])
		/* Publish the index first and let the .gz rename be the commit point, since that is what
		the reuse check and any reader key off. Publishing the data first leaves a window where a
		concurrent read finds a .gz whose index is absent.

		Nothing is unlinked first, deliberately: rename replaces the destination atomically, so a
		leftover from an aborted publish is overwritten by these two moves anyway, and a writer
		that clears the destination first would delete a file a competing writer had already
		committed -- and whose name that writer may have returned to a client. The competing
		writer replacing ours is harmless because the content is a pure function of the cache id
		and the CpG floor, which name the file: both write the same bytes (asserted in the spec). */
		await fs.promises.rename(tmpBed + '.gz.tbi', gz + '.tbi')
		await fs.promises.rename(tmpBed + '.gz', gz)
	} finally {
		for (const f of [tmpBed, tmpBed + '.gz', tmpBed + '.gz.tbi']) await fs.promises.rm(f, { force: true })
	}
	return name
}
