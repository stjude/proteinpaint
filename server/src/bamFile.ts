import { BamFile, streamBamRecords } from '@gmod/bam'
import type { BamRecord, BamStreamHeader } from '@gmod/bam'
import { SharedBudget } from '@gmod/shared-read-cache'
import { LocalFile } from 'generic-filehandle2'
import type { GenericFilehandle } from 'generic-filehandle2'
import { libraryErrorText } from './utils/libraryError.ts'
import { locateDataFile, locateIndexedFile } from './indexedFile.ts'
import { OpenFiles } from './utils/openFiles.ts'
import type { IndexKind } from './indexedFile.ts'

/*
Reads a bam file in the server process, with @gmod/bam, instead of with samtools. The reads are the same as those
of samtools: see isBamTruncated() for quickcheck, listBamChrs() for view -H, readBamRecords() and samLine() for
view and view -c, and forEachDepth() for depth.

A file is located as in indexedFile.ts. The index of a local file is found as htslib finds it, see bamIndex. The
index of a url file is url.csi, or else url.bai, which is kept in the cache dir of the url. A file that has no index,
such as a gdc slice or a truncated file, is read whole, see withoutIndex of ReadArg.

An opened file, with its parsed index, is kept for later reads, until its index or data file changes or it is one
of the files that have not been read for the longest time, see maxOpenFiles.
*/

type Region = { chr: string; start: number; end: number }
type ReadArg = {
	file: string
	dir?: string | null
	/** 0-based and half-open; none to read all the records of the file, without an index */
	region?: Region | null
	/** true to read the whole file, without an index, and keep the records of the region, such as of a gdc slice or a
	 * truncated file, which has no index */
	withoutIndex?: boolean
}
/** the records of a read, and the chromosome names of the file, by the reference id of a record */
export type BamReads = { records: BamRecord[]; refNames: string[] }
type OpenBam = { bam: BamFile; handles: GenericFilehandle[] }

/** the local index is file.csi, x.csi, file.bai, or x.bai, for a file x.bam, by the order that htslib looks for it */
const bamIndex: IndexKind = {
	name: 'bam',
	localPaths: f => {
		const x = f.endsWith('.bam') ? f.slice(0, -4) : null
		return x ? [f + '.csi', x + '.csi', f + '.bai', x + '.bai'] : [f + '.csi', f + '.bai']
	},
	exts: ['.csi', '.bai']
}
const maxOpenFiles = 100
/** the decompressed chunks that all open files keep for later reads, in bytes */
const chunkCacheBudget = new SharedBudget(256 * 2 ** 20)
/** the upper limit of a file that is read whole, without an index; a gdc slice is at most cacheMaxSize */
const maxWholeFileBytes = 256 * 2 ** 20
/** the compressed bytes of a read of the header, which is raised to one bgzf block, and is enough for most headers */
const headerWindowBytes = 2 ** 16
/** the end-of-file marker of a bgzf file, which is an empty block */
const bgzfEof = Buffer.from('1f8b08040000000000ff0600424302001b0003000000000000000000', 'hex')

/** the flags of the reads that samtools depth -g DUP excludes: unmapped, secondary, and qc fail */
export const depthExcludedFlags = 0x4 | 0x100 | 0x200

const openFiles = new OpenFiles<OpenBam>(maxOpenFiles, closeFile)

/*
returns true if a bam file is truncated, as samtools quickcheck finds it: the file has a bam header, with a
reference, but not the end-of-file marker. Rejects a file that does not have such a header.
*/
export async function isBamTruncated(file: unknown, dir?: unknown): Promise<boolean> {
	const fh = (await locateDataFile(file, dir, bamIndex)).open()
	try {
		const header = await readHeader(fh)
		if (!header.indexToChr.length) throw 'the bam file has no reference in its header'
		let tail: Buffer
		try {
			const { size } = await fh.stat()
			tail = Buffer.from(await fh.read(bgzfEof.length, Math.max(0, size - bgzfEof.length)))
		} catch (e) {
			throw libraryErrorText(e)
		}
		return !tail.equals(bgzfEof)
	} finally {
		fh.close().catch(() => {})
	}
}

/** returns the chromosome names of a bam file, from its header, as samtools view -H; see withoutIndex of ReadArg */
export async function listBamChrs(file: unknown, dir: unknown, withoutIndex: boolean): Promise<string[]> {
	if (withoutIndex) {
		const fh = (await locateDataFile(file, dir, bamIndex)).open()
		try {
			return (await readHeader(fh)).indexToChr.map(c => c.refName)
		} finally {
			fh.close().catch(() => {})
		}
	}
	const f = await openBamFile(file, dir)
	try {
		await f.bam.getHeader()
	} catch (e) {
		throw libraryErrorText(e)
	}
	return f.bam.indexToChr!.map(c => c.refName)
}

/*
returns the records of a region of a bam file, which overlap the region, in the order of the file, as samtools view
reads them. A file that is read whole, without an index, is read up to its last complete record if it is truncated,
as samtools view reads it. The records of an indexed read are shared with other reads, and must not be changed.
*/
export async function readBamRecords({
	file,
	dir = null,
	region = null,
	withoutIndex = false
}: ReadArg): Promise<BamReads> {
	if (region) {
		const { chr, start, end } = region
		if (typeof chr != 'string' || !chr) throw 'invalid region chr'
		if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start) throw 'invalid region'
	}
	if (!region || withoutIndex) {
		const reads = await readWholeFile(file, dir)
		return region ? regionReads(reads, region) : reads
	}
	const { chr, start, end } = region
	const f = await openBamFile(file, dir)
	try {
		await f.bam.getHeader()
	} catch (e) {
		throw libraryErrorText(e)
	}
	// samtools view rejects such a region with an error
	if (!Object.hasOwn(f.bam.chrToIndex!, chr)) throw 'the chromosome of the region is not in the bam file'
	try {
		const records = await f.bam.getRecordsForRange(chr, start, end)
		return { records, refNames: f.bam.indexToChr!.map(c => c.refName) }
	} catch (e) {
		throw libraryErrorText(e)
	}
}

/*
returns the records of a whole file that overlap a region, as getRecordsForRange() finds them: the end of a record
that has no base on the reference, such as an unmapped read at the position of its mate, is after its start
*/
function regionReads({ records, refNames }: BamReads, { chr, start, end }: Region): BamReads {
	const refId = refNames.indexOf(chr)
	// samtools view rejects such a region with an error
	if (refId < 0) throw 'the chromosome of the region is not in the bam file'
	return {
		records: records.filter(r => r.ref_id == refId && r.start < end && r.end > start),
		refNames
	}
}

/** returns the first 11 fields of the sam line of a record, as samtools view prints them, without the tags */
export function samLine(r: BamRecord, refNames: string[]): string {
	const rname = r.ref_id < 0 ? '*' : refNames[r.ref_id]
	const rnext = r.next_refid < 0 ? '*' : r.next_refid == r.ref_id ? '=' : refNames[r.next_refid]
	return [
		r.name,
		r.flags,
		rname,
		r.start + 1,
		r.mq ?? 255,
		r.CIGAR || '*',
		rnext,
		r.next_pos + 1,
		r.template_length,
		r.seq || '*',
		qualText(r.qual)
	].join('\t')
}

/** the phred+33 text of the base qualities of a record, or "*" for none, which bam stores as 0xff */
function qualText(q: Uint8Array | null): string {
	if (!q || !q.length || q[0] == 0xff) return '*'
	const b = Buffer.allocUnsafe(q.length)
	for (let i = 0; i < q.length; i++) b[i] = q[i] + 33
	return b.toString('latin1')
}

/*
calls back with the depth of each position of a region, as samtools depth -r prints it for the reads of the region:
a position is in a match (M, = or X), deletion (D), or skip (N) of a read that has none of excludedFlags, and its
depth is the number of such reads that have it in a match. The positions are 0-based, in order, from region.start
to before region.end; a position that no read has is skipped.
*/
export function forEachDepth(
	{ records, refNames }: BamReads,
	region: Region,
	excludedFlags: number,
	callback: (position: number, depth: number) => void
) {
	const refId = refNames.indexOf(region.chr)
	if (refId < 0) return
	const reads = records.filter(r => r.ref_id == refId && !(r.flags & excludedFlags))
	let lo = region.end,
		hi = region.start
	for (const r of reads) {
		lo = Math.min(lo, r.start)
		hi = Math.max(hi, r.end)
	}
	lo = Math.max(lo, region.start)
	hi = Math.min(hi, region.end)
	if (hi <= lo) return
	const depth = new Int32Array(hi - lo)
	const covered = new Uint8Array(hi - lo)
	for (const r of reads) {
		const cigar = r.NUMERIC_CIGAR
		let pos = r.start
		for (let i = 0; i < cigar.length; i++) {
			const len = cigar[i] >> 4,
				op = cigar[i] & 0xf
			// M, D, N, =, X are on the reference, and only M, = and X are counted
			if (op != 0 && op != 2 && op != 3 && op != 7 && op != 8) continue
			const isMatch = op != 2 && op != 3
			const a = Math.max(pos, lo),
				b = Math.min(pos + len, hi)
			for (let p = a; p < b; p++) {
				covered[p - lo] = 1
				if (isMatch) depth[p - lo]++
			}
			pos += len
		}
	}
	for (let i = 0; i < covered.length; i++) {
		if (covered[i]) callback(lo + i, depth[i])
	}
}

/** returns the open file of a file, which is opened again if its index or data file has changed */
async function openBamFile(file: unknown, dir: unknown): Promise<OpenBam> {
	const { location, index, open } = await locateIndexedFile(file, dir, bamIndex)
	const key = location + '\t' + index.path
	const cached = openFiles.get(key, index.stamp)
	if (cached) return cached
	const fh = open()
	const ih = new LocalFile(index.path)
	const f: OpenBam = {
		bam: new BamFile({
			bamFilehandle: fh,
			...(index.isCsi ? { csiFilehandle: ih } : { baiFilehandle: ih }),
			cacheBudget: chunkCacheBudget
		}),
		handles: [fh, ih]
	}
	openFiles.set(key, index.stamp, f)
	return f
}

function closeFile(f: OpenBam) {
	f.bam.clearFeatureCache()
	// a read in progress may still use a handle, which is opened again if so
	for (const h of f.handles) h.close().catch(() => {})
}

/** returns the header of a bam file, which is read from the start of the file, without an index */
async function readHeader(fh: GenericFilehandle): Promise<BamStreamHeader> {
	const controller = new AbortController()
	let header: BamStreamHeader | undefined
	const records = streamBamRecords({
		bamFilehandle: fh,
		signal: controller.signal,
		windowSize: headerWindowBytes,
		readAhead: 1,
		onHeader: h => {
			header = h
			// the records after the header are not read
			controller.abort()
		}
	})
	try {
		// the header is read before the first records are returned
		await records.next()
	} catch (e) {
		if (!header) throw libraryErrorText(e)
	} finally {
		// ends the read of the records, with the read that is ahead of it
		await records.return().catch(() => {})
	}
	if (!header) throw 'cannot read the bam header'
	return header
}

/** the reads of a whole file, see readBamRecords() */
async function readWholeFile(file: unknown, dir: unknown): Promise<BamReads> {
	const fh = (await locateDataFile(file, dir, bamIndex)).open()
	try {
		let size: number
		try {
			size = (await fh.stat()).size
		} catch (e) {
			throw libraryErrorText(e)
		}
		if (size > maxWholeFileBytes) throw 'the bam file is too large to read without an index'
		let refNames: string[] = []
		const records: BamRecord[] = []
		try {
			const batches = streamBamRecords({
				bamFilehandle: fh,
				onHeader: h => (refNames = h.indexToChr.map(c => c.refName))
			})
			for await (const batch of batches) {
				for (const r of batch) records.push(r)
			}
		} catch (e) {
			// the error of a file that ends before its end-of-file marker, after its last complete record
			if (!(e instanceof Error && e.message.startsWith('truncated BAM'))) throw libraryErrorText(e)
		}
		return { records, refNames }
	} finally {
		fh.close().catch(() => {})
	}
}
