import path from 'path'
import fs from 'fs'
import { promisify } from 'util'
import { execFile } from 'child_process'
import { randomUUID } from 'crypto'
import serverconfig from '#src/serverconfig.js'

const run = promisify(execFile)

/* Bgzip + tabix a BED file into the "bedj" cache subdir that block tracks read with isCache:true.

Written by whatever analysis produced the items rather than served by a route of its own: such a
route puts the analysis in the genome browser, which then has to name the cached result, fetch the
items of whichever chromosome is on screen and swap them into the track on every pan. A file is
just a track; the browser fetches the region in view like it does for any other bedj file.

The CALLER owns the name and the content. The name keys the cache, so it must name everything the
content depends on -- a rebuild under a name already published must produce the same bytes (see
the spec). Written only when absent, and swept on the bedj subdir's own TTL. */
export async function writeBedjFile(
	/** cache file name, ending in .gz; no path separators */
	name: string,
	/** BED lines, tab-delimited and already sorted by (chr, start) as tabix requires: `text` is
	 * the whole file as a string, `file` the path to an uncompressed one to bgzip in place */
	content: { text: string } | { file: string }
): Promise<string> {
	// the name lands in a path and goes back to a client: keep it a bare file name in this dir
	if (!name.endsWith('.gz') || name.includes('/') || name.includes('\\') || name.startsWith('.')) {
		throw new Error(`invalid bedj cache file name: ${name}`)
	}
	const dir = path.join(serverconfig.cachedir, 'bedj')
	const gz = path.join(dir, name)
	// both must be there: the .gz is the commit point, so a lone .tbi is an unfinished publish
	if (fs.existsSync(gz) && fs.existsSync(gz + '.tbi')) {
		/* The subdir is swept by mtime, so touch on reuse: the TTL should mean last-used, not
		first-written, or a result someone still has open can be swept out from under the track.
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

	/* Built under a unique name and renamed into place, so two requests for the same result cannot
	read each other's half-written file. Copied rather than bgzipped where it lies, since bgzip
	consumes its input. */
	const tmpBed = path.join(dir, `.tmp-${randomUUID()}-${name.slice(0, -3)}`)
	try {
		if ('file' in content) await fs.promises.copyFile(content.file, tmpBed)
		else await fs.promises.writeFile(tmpBed, content.text)
		await run(serverconfig.bgzip, ['-f', tmpBed]) // writes tmpBed + '.gz'
		await run(serverconfig.tabix, ['-f', '-p', 'bed', tmpBed + '.gz'])
		/* Publish the index first and let the .gz rename be the commit point, since that is what
		the reuse check and any reader key off. Publishing the data first leaves a window where a
		concurrent read finds a .gz whose index is absent.

		Nothing is unlinked first, deliberately: rename replaces the destination atomically, so a
		leftover from an aborted publish is overwritten by these two moves anyway, and a writer
		that clears the destination first would delete a file a competing writer had already
		committed -- and whose name that writer may have returned to a client. The competing
		writer replacing ours is harmless only because the name keys the content, so both write
		the same bytes. */
		await fs.promises.rename(tmpBed + '.gz.tbi', gz + '.tbi')
		await fs.promises.rename(tmpBed + '.gz', gz)
	} finally {
		for (const f of [tmpBed, tmpBed + '.gz', tmpBed + '.gz.tbi']) await fs.promises.rm(f, { force: true })
	}
	return name
}
