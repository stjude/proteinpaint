import fs from 'fs'
import { gunzipSync } from 'zlib'
import { TabixIndexedFile } from '@gmod/tabix'
import { unzip } from '@gmod/bgzf-filehandle'
import { SharedBudget } from '@gmod/shared-read-cache'
import { LocalFile } from 'generic-filehandle2'
import type { GenericFilehandle } from 'generic-filehandle2'
import { libraryErrorText } from './utils/libraryError.ts'
import { locateIndexedFile } from './indexedFile.ts'
import { OpenFiles } from './utils/openFiles.ts'
import type { IndexKind } from './indexedFile.ts'

/*
Reads a bgzipped, tabix-indexed file in the server process, with @gmod/tabix, instead of with the tabix tool.
The reads are the same as those of the tool, see readTabixLines(), readTabixHeader(), and listTabixChrs().

A file is located as in indexedFile.ts. The index of a local file is file.tbi, or else file.csi. The index of a url
file is url.tbi, or else url.csi, which is kept in the cache dir of the url.

An opened file, with its parsed index, is kept for later reads, until its index or data file changes or it is one
of the files that have not been read for the longest time, see maxOpenFiles.
*/

type Region = { chr: string; start: number | string; stop: number | string }
type ReadArg = {
	file: string
	dir?: string | null
	regions: Region[]
	callback: (line: string, stop: () => void) => void
}
/** a range of getLines(), which is 0-based and half-open; no end for the end of the chromosome */
type Range = { chr: string; start: number; end?: number }
type OpenFile = {
	tbx: TabixIndexedFile
	handles: GenericFilehandle[]
	indexPath: string
	isCsi: boolean
	/** the head of a csi index, see readCsiHead() */
	csiHead?: CsiHead
	/** the chromosome names of a bcf file, see listBcfChrs() */
	bcfChrs?: string[]
}
type CsiHead = { refCount: number; auxLength: number }

/** the upper limit of the regions of a read, which is the 1000 regions of a request at most, see utils.validateRglst() */
const maxRegions = 1000
const maxOpenFiles = 100
/** the decompressed chunks that all open files keep for later reads, in bytes */
const chunkCacheBudget = new SharedBudget(256 * 2 ** 20)
const tabixIndex: IndexKind = { name: 'tabix', localPaths: f => [f + '.tbi', f + '.csi'], exts: ['.tbi', '.csi'] }

const openFiles = new OpenFiles<OpenFile>(maxOpenFiles, closeFile)

/*
The read of each region of a file, in the order of the regions, as tabix reads them.

file: the full path of a local file, or a url
dir: the cache dir of a url file, where its index is kept, see indexedFile.ts; none for a local file
regions: [{chr, start, stop}], with the coordinates that tabix reads, see getRange()
callback(line, stop): called with each line; stop() ends the read early, such as when too many lines are read
	A callback that throws rejects the read.
*/
export async function readTabixLines({ file, dir = null, regions, callback }: ReadArg): Promise<void> {
	if (!Array.isArray(regions) || !regions.length) throw 'regions[] missing'
	if (regions.length > maxRegions) throw 'too many regions'
	if (typeof callback != 'function') throw 'callback() not a function'
	const ranges = regions.map(getRange)
	const f = await openTabixFile(file, dir)
	// tabix reads the records of a bcf file as vcf lines, which @gmod/tabix does not
	if (await isBcf(f)) throw 'bcf file is not supported'
	const controller = new AbortController()
	let stopped = false,
		failed = false,
		failure: unknown
	const stop = () => {
		stopped = true
		controller.abort()
	}
	const lineCallback = (line: string) => {
		if (stopped) return
		try {
			callback(line, stop)
		} catch (e) {
			failed = true
			failure = e
			stop()
		}
	}
	for (const r of ranges) {
		if (!r) continue
		try {
			await f.tbx.getLines(r.chr, r.start, r.end, { lineCallback, signal: controller.signal })
		} catch (e) {
			if (!failed && !stopped) throw libraryErrorText(e)
		}
		if (failed) throw failure
		if (stopped) return
	}
}

/** returns the header lines of a tabix file, which are the lines that start with the meta character, as tabix -H */
export async function readTabixHeader(file: string, dir?: string | null): Promise<string[]> {
	const f = await openTabixFile(file, dir)
	let header: string
	try {
		header = (await isBcf(f)) ? formatBcfHeader(await readBcfHeaderText(f.handles[0])) : await f.tbx.getHeader()
	} catch (e) {
		throw libraryErrorText(e)
	}
	const lines = header.split(/\r?\n/)
	if (lines.at(-1) === '') lines.pop()
	return lines
}

/** returns the chromosome names of a tabix file, or of a bcf file, as tabix -l */
export async function listTabixChrs(file: string, dir?: string | null): Promise<string[]> {
	const f = await openTabixFile(file, dir)
	try {
		if (await isBcf(f)) {
			f.bcfChrs ??= await listBcfChrs(f)
			return [...f.bcfChrs]
		}
		return await f.tbx.getReferenceSequenceNames()
	} catch (e) {
		throw libraryErrorText(e)
	}
}

/*
returns the getLines() range of a region, or null for a region that has no lines, from the coordinates that tabix
reads as chr:start-stop: 1-based and inclusive, where a start of 0 is read as 1 and a stop of 0 as the end of the
chromosome. A coordinate may be a numeric string, or fractional when computed from a view; a start or stop before 0
is read as 0.
*/
function getRange(r: Region): Range | null {
	const coord = (v: unknown) => {
		if (typeof v == 'string' && /^-?\d+(\.\d+)?$/.test(v)) v = Number(v)
		if (typeof v != 'number' || !Number.isFinite(v)) throw 'invalid region coordinate'
		return v
	}
	if (!r || typeof r.chr != 'string' || !r.chr) throw 'invalid region chr'
	const start = Math.max(1, Math.floor(coord(r.start))) - 1
	const stop = Math.max(0, Math.ceil(coord(r.stop)))
	if (stop == 0) return { chr: r.chr, start }
	if (stop <= start) return null
	return { chr: r.chr, start, end: stop }
}

/** returns the open file of a file, which is opened again if its index or data file has changed */
async function openTabixFile(file: unknown, dir: unknown): Promise<OpenFile> {
	const { location, index, open } = await locateIndexedFile(file, dir, tabixIndex)
	const key = location + '\t' + index.path
	const cached = openFiles.get(key, index.stamp)
	if (cached) return cached
	const fh = open()
	const ih = new LocalFile(index.path)
	const f: OpenFile = {
		tbx: new TabixIndexedFile({
			filehandle: fh,
			...(index.isCsi ? { csiFilehandle: ih } : { tbiFilehandle: ih }),
			chunkCacheBudget
		}),
		handles: [fh, ih],
		indexPath: index.path,
		isCsi: index.isCsi
	}
	openFiles.set(key, index.stamp, f)
	return f
}

function closeFile(f: OpenFile) {
	f.tbx.clearChunkCache()
	// a read in progress may still use a handle, which is opened again if so
	for (const h of f.handles) h.close().catch(() => {})
}

/** true if the index of a file is a csi index without the tabix header, which names the chromosomes, as of a bcf file */
async function isBcf(f: OpenFile): Promise<boolean> {
	if (!f.isCsi) return false
	f.csiHead ??= await readCsiHead(f.indexPath)
	return f.csiHead.auxLength < 28
}

/** the number of references and the aux length of a csi index */
async function readCsiHead(file: string): Promise<CsiHead> {
	const bytes = Buffer.from(await unzip(await fs.promises.readFile(file)))
	if (bytes.length < 16 || bytes.toString('latin1', 0, 4) != 'CSI\x01') throw 'not a csi index'
	const auxLength = bytes.readInt32LE(12)
	if (auxLength < 0 || bytes.length < 20 + auxLength) throw 'not a csi index'
	return { auxLength, refCount: bytes.readInt32LE(16 + auxLength) }
}

/*
returns the chromosome names of a bcf file, as tabix -l: the contigs of its header, by their order or IDX, that
its csi index has, which has one reference for each contig up to the last that has data
*/
async function listBcfChrs(f: OpenFile): Promise<string[]> {
	const refCount = f.csiHead!.refCount
	const text = await readBcfHeaderText(f.handles[0])
	const names: string[] = []
	const seen = new Set<string>()
	for (const line of text.split('\n')) {
		if (!line.startsWith('##contig=<')) continue
		const id = /[<,]ID=([^,>]+)/.exec(line)?.[1]
		// htslib keeps the first of the contigs that have the same id
		if (!id || seen.has(id)) continue
		const idx = /[<,]IDX=(\d+)/.exec(line)?.[1]
		names[idx === undefined ? seen.size : Number(idx)] = id
		seen.add(id)
	}
	return names.slice(0, refCount).filter(n => n !== undefined)
}

/*
returns the header of a bcf file as tabix prints it, as vcf: htslib gives the PASS filter, which it adds to every
header, the second line, after ##fileformat, and leaves out the IDX of each line
*/
function formatBcfHeader(text: string): string {
	const lines = text
		.replace(/,IDX=\d+>/g, '>')
		.split('\n')
		.filter(l => !l.startsWith('##FILTER=<ID=PASS,'))
	lines.splice(lines[0]?.startsWith('##fileformat=') ? 1 : 0, 0, '##FILTER=<ID=PASS,Description="All filters passed">')
	return lines.join('\n')
}

/** the upper limit of the header text of a bcf file; a bcf file of 5000 samples has a header of about 100KB */
const maxBcfHeaderLength = 16 * 2 ** 20
/** the upper limit of the decompressed bytes of a bgzf block */
const maxBgzfBlockBytes = 2 ** 16

/** returns the header text of a bcf file, from its first bgzf blocks */
export async function readBcfHeaderText(fh: GenericFilehandle): Promise<string> {
	const readSize = 2 ** 20
	let data = Buffer.alloc(0)
	let buf = Buffer.alloc(0)
	// the file offsets of buf and of the next block
	let bufPos = 0,
		pos = 0
	const need = async (n: number) => {
		while (data.length < n) {
			let off = pos - bufPos
			if (blockSize(buf, off) > buf.length - off) {
				buf = Buffer.from(await fh.read(readSize, pos))
				bufPos = pos
				off = 0
			}
			const size = blockSize(buf, off)
			if (size > buf.length - off) throw 'not a bcf file'
			// a block that inflates to more than a bgzf block can hold is not of a bgzf file
			data = Buffer.concat([data, gunzipSync(buf.subarray(off, off + size), { maxOutputLength: maxBgzfBlockBytes })])
			pos += size
		}
	}
	await need(9)
	if (data.toString('latin1', 0, 4) != 'BCF\x02') throw 'not a bcf file'
	const textLength = data.readUInt32LE(5)
	if (textLength > maxBcfHeaderLength) throw 'bcf header is too long'
	await need(9 + textLength)
	return data.toString('utf8', 9, 9 + textLength).replace(/\0+$/, '')
}

/** the size of the bgzf block at off of buf, or Infinity if buf does not have its header */
function blockSize(buf: Buffer, off: number): number {
	if (buf.length - off < 18) return Infinity
	if (buf[off] != 31 || buf[off + 1] != 139 || buf[off + 12] != 66 || buf[off + 13] != 67) throw 'not a bgzf file'
	return buf.readUInt16LE(off + 16) + 1
}
