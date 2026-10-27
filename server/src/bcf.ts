import { gunzipSync } from 'zlib'
import { CSI } from '@gmod/bam'
import { LocalFile } from 'generic-filehandle2'
import type { GenericFilehandle } from 'generic-filehandle2'
import { libraryErrorText } from './utils/libraryError.ts'
import { locateIndexedFile } from './indexedFile.ts'
import { OpenFiles } from './utils/openFiles.ts'
import { readBcfHeaderText } from './tabix.ts'
import type { IndexKind } from './indexedFile.ts'

/*
Reads the records of a bcf file in the server process, instead of with bcftools query.

readBcfRecords() reads the records of regions as bcftools query -r or -R reads them, of the samples of -s, and of the
INFO conditions of -i, see InfoCondition. A record gives the text that bcftools query prints for the fields of a
record: see BcfRecord for %ID, %CHROM, %POS, %REF and %ALT, and BcfRecord.info() for %INFO, format() for %FORMAT,
and tgt() for [\t%TGT].

A file is located as in indexedFile.ts. Its index is file.csi, or for a url file url.csi, which is kept in the cache
dir of the url. An opened file, with its parsed header and index, is kept for later reads, as in tabix.ts.

A region is read by the chunks of its index, which are read and decompressed a window at a time, so that the
records of a large region do not all stay in memory.
*/

/** a region of a read, as chr:start-stop of bcftools: 1-based and inclusive; a fractional coordinate is truncated */
export type BcfRegion = { chr: string; start: number; stop: number }
export type InfoOp = '=' | '!=' | '<' | '<=' | '>' | '>='
/** a condition on an INFO field of a record, as INFO/key op value of a bcftools expression, where a string value is
 * quoted, and a number is not */
export type InfoCondition = { key: string; op: InfoOp; value: string | number }
type QueryArg = {
	file: string
	dir?: string | null
	regions: BcfRegion[]
	/** the names of the samples of each record, in this order; all samples of the file if none */
	samples?: string[]
	/** the conditions that a record must all meet */
	infoFilter?: InfoCondition[]
	/** called with each record; stop() ends the read early. A callback that throws rejects the read. */
	callback: (record: BcfRecord, stop: () => void) => void
}

type InfoMeta = { number: string; type: string }
type BcfHeader = {
	/** the dictionary of the FILTER, INFO, and FORMAT ids, by their index in a record */
	ids: string[]
	/** the index of each id, as of ids[] */
	idIndex: Map<string, number>
	/** the contigs, by their index in a record and in the csi index */
	contigs: string[]
	contigIndex: Map<string, number>
	info: Map<string, InfoMeta>
	samples: string[]
	sampleIndex: Map<string, number>
	/** the index of GT in ids[], or -1 if the file has none */
	gtId: number
}
type OpenBcf = { header: BcfHeader; csi: CSI; handles: GenericFilehandle[] }

/** the upper limit of the regions of a read, which is the 1000 regions of a request at most, see utils.validateRglst() */
const maxRegions = 1000
const maxOpenFiles = 100
const bcfIndex: IndexKind = { name: 'bcf', localPaths: f => [f + '.csi'], exts: ['.csi'] }
/** the compressed bytes of a read of the chunk of a region, which is decompressed and decoded before the next read,
 * and the decompressed bytes of the blocks that are taken from a read, since a block of the same byte repeated, such
 * as of a genotype that most samples have, is about 100 bytes; a test may change them */
export const readWindow = { bytes: 2 ** 20, decodedBytes: 2 ** 24 }
/** the upper limit of the compressed and of the decompressed bytes of a bgzf block */
const maxBgzfBlockBytes = 2 ** 16
/** a virtual offset as a number, the block position times 2**16 plus the data position, is exact for a file of up to
 * 2**37 bytes */
const maxBlockPosition = 2 ** 37

const openFiles = new OpenFiles<OpenBcf>(maxOpenFiles, closeFile)

export async function readBcfRecords({
	file,
	dir = null,
	regions,
	samples,
	infoFilter,
	callback
}: QueryArg): Promise<void> {
	if (!Array.isArray(regions) || !regions.length) throw 'regions[] missing'
	if (regions.length > maxRegions) throw 'too many regions'
	if (typeof callback != 'function') throw 'callback() not a function'
	const f = await openBcfFile(file, dir)
	const h = f.header
	const selected = selectSamples(h, samples)
	const conditions = (infoFilter || []).map(c => compileCondition(h, c))
	let stopped = false
	const stop = () => {
		stopped = true
	}
	for (const [chr, intervals] of groupRegions(regions)) {
		const rid = h.contigIndex.get(chr)
		// bcftools reads no record of a chromosome that is not in the file
		if (rid === undefined) continue
		/* the virtual offset of the last record that is read, as a record may overlap two intervals. The intervals are
		sorted, so that a record before it, which is read or is in no chunk of an earlier interval, does not overlap a
		later interval unless it is read, and a chunk is read from it, instead of again from the start of the chunk. */
		let last = -1
		for (const [start, end] of intervals) {
			let chunks: Awaited<ReturnType<CSI['blocksForRange']>>
			try {
				chunks = await f.csi.blocksForRange(rid, start, end)
			} catch (e) {
				throw libraryErrorText(e)
			}
			for (const chunk of chunks) {
				if (last >= toNumber(chunk.maxv)) continue
				const minv = last > toNumber(chunk.minv) ? fromNumber(last) : chunk.minv
				let past = false
				await scanChunk(f.handles[0], minv, chunk.maxv, (buf, recStart, voffset) => {
					if (voffset <= last) return true
					const record = new BcfRecord(h, buf, recStart, selected)
					if (record.rid != rid || record.pos0 >= end) {
						past = true
						return false
					}
					last = voffset
					// htslib reads a record that overlaps the interval, by the length of its reference allele
					if (record.pos0 + record.rlen <= start) return true
					if (!conditions.every(c => c(record))) return true
					callback(record, stop)
					return !stopped
				})
				if (stopped) return
				if (past) break
			}
		}
	}
}

/** returns the open file of a file, which is opened again if its index or data file has changed */
async function openBcfFile(file: unknown, dir: unknown): Promise<OpenBcf> {
	const { location, index, open } = await locateIndexedFile(file, dir, bcfIndex)
	const key = location + '\t' + index.path
	const cached = openFiles.get(key, index.stamp)
	if (cached) return cached
	const fh = open()
	const ih = new LocalFile(index.path)
	let header: BcfHeader
	try {
		header = parseHeader(await readBcfHeaderText(fh))
	} catch (e) {
		fh.close().catch(() => {})
		ih.close().catch(() => {})
		throw libraryErrorText(e)
	}
	const f: OpenBcf = { header, csi: new CSI({ filehandle: ih }), handles: [fh, ih] }
	openFiles.set(key, index.stamp, f)
	return f
}

function closeFile(f: OpenBcf) {
	// a read in progress may still use a handle, which is opened again if so
	for (const h of f.handles) h.close().catch(() => {})
}

/*
returns the dictionaries of a header as htslib reads them: an id or contig is at the index of its IDX, which htslib
writes in each header line of a bcf file, or else at the next index in the order of the lines, after PASS
*/
function parseHeader(text: string): BcfHeader {
	const ids: string[] = []
	const idIndex = new Map<string, number>()
	const contigs: string[] = []
	const contigIndex = new Map<string, number>()
	const info = new Map<string, InfoMeta>()
	let samples: string[] = []
	const lines = text.split('\n')
	const hasIdx = lines.some(l => /^##(FILTER|INFO|FORMAT)=<.*[<,]IDX=\d+/.test(l))
	if (!hasIdx) {
		ids.push('PASS')
		idIndex.set('PASS', 0)
	}
	for (const line of lines) {
		if (line.startsWith('#CHROM')) {
			samples = line.split('\t').slice(9)
			continue
		}
		const m = /^##(FILTER|INFO|FORMAT|contig)=<(.*)>\s*$/.exec(line)
		if (!m) continue
		const attr = (k: string) => new RegExp(`(?:^|,)${k}=([^,>]*)`).exec(m[2])?.[1]
		const id = attr('ID')
		if (!id) continue
		const idx = attr('IDX')
		const [dict, index] = m[1] == 'contig' ? [contigs, contigIndex] : [ids, idIndex]
		// htslib keeps the first of the lines that have the same id
		if (!index.has(id)) {
			const i = idx === undefined ? dict.length : Number(idx)
			dict[i] = id
			index.set(id, i)
		}
		if (m[1] == 'INFO' && !info.has(id)) info.set(id, { number: attr('Number') || '', type: attr('Type') || '' })
	}
	return {
		ids,
		idIndex,
		contigs,
		contigIndex,
		info,
		samples,
		sampleIndex: new Map(samples.map((s, i) => [s, i])),
		gtId: idIndex.get('GT') ?? -1
	}
}

/** the indexes of the samples of a read, in the header, as bcftools query -s selects them */
function selectSamples(h: BcfHeader, samples?: string[]): number[] {
	if (!samples) return h.samples.map((_, i) => i)
	if (!Array.isArray(samples)) throw 'samples[] not array'
	return samples.map(s => {
		const i = h.sampleIndex.get(s)
		if (i === undefined) throw 'sample not found in the bcf file'
		return i
	})
}

/*
returns the regions of each chromosome as bcftools reads them: the chromosomes in the order that they are first given,
and the regions of a chromosome sorted and merged, as [start, end] 0-based and half-open
*/
function groupRegions(regions: BcfRegion[]): Map<string, [number, number][]> {
	const byChr = new Map<string, [number, number][]>()
	for (const r of regions) {
		if (!r || typeof r.chr != 'string' || !r.chr) throw 'invalid region chr'
		if (!Number.isFinite(r.start) || !Number.isFinite(r.stop)) throw 'invalid region coordinate'
		const start = Math.max(1, Math.trunc(r.start)) - 1
		const end = Math.trunc(r.stop)
		if (!byChr.has(r.chr)) byChr.set(r.chr, [])
		if (end > start) byChr.get(r.chr)!.push([start, end])
	}
	for (const [chr, lst] of byChr) {
		lst.sort((a, b) => a[0] - b[0])
		const merged: [number, number][] = []
		for (const r of lst) {
			const prev = merged.at(-1)
			if (prev && r[0] <= prev[1]) prev[1] = Math.max(prev[1], r[1])
			else merged.push([...r])
		}
		byChr.set(chr, merged)
	}
	return byChr
}

/*
calls onRecord(buf, recStart, voffset) with each record of a chunk, by the order of the file, where the record is at
buf[recStart] and voffset is its virtual offset as a number; onRecord() returns false to end the scan. The chunk is
read and decompressed a window at a time, and a record that is cut by the end of a window is joined with the next.
*/
async function scanChunk(
	fh: GenericFilehandle,
	minv: Voffset,
	maxv: Voffset,
	onRecord: (buf: Buffer, recStart: number, voffset: number) => boolean
): Promise<void> {
	const endVoffset = toNumber(maxv)
	let pos = minv.blockPosition
	// the decompressed bytes that are not yet decoded, which start at the virtual offset carryVoffset
	let carry = Buffer.alloc(0)
	let carryVoffset = toNumber(minv)
	let skip = minv.dataPosition
	// a block that has a record of the chunk, which the block at maxv has only if the chunk ends after its start
	const inChunk = () => pos < maxv.blockPosition || (pos == maxv.blockPosition && maxv.dataPosition > 0)
	while (inChunk()) {
		// a read has at least one block, and ends with the last block of the chunk, at maxv.blockPosition
		const readSize = Math.max(
			maxBgzfBlockBytes,
			Math.min(readWindow.bytes, maxv.blockPosition - pos + maxBgzfBlockBytes)
		)
		const read = await fh.read(readSize, pos)
		const win = Buffer.from(read.buffer, read.byteOffset, read.byteLength)
		// the decompressed blocks of the window, with the buffer offset where each starts in data[]
		const parts: Buffer[] = carry.length ? [carry] : []
		const blocks: { filePos: number; start: number }[] = []
		let length = carry.length
		let off = 0
		while (inChunk()) {
			// the next read starts at a block that is not taken, and a record of the blocks that are is carried to it
			if (blocks.length && length >= readWindow.decodedBytes) break
			const size = blockSize(win, off)
			if (size > win.length - off) break
			let data = gunzipSync(win.subarray(off, off + size), { maxOutputLength: maxBgzfBlockBytes })
			if (skip) {
				data = data.subarray(skip)
				skip = 0
			}
			blocks.push({ filePos: pos, start: length })
			parts.push(data)
			length += data.length
			off += size
			pos += size
		}
		// a read has at least one block, unless the file ends before it
		if (!blocks.length) throw 'the bcf file is truncated'

		const data = parts.length == 1 ? parts[0] : Buffer.concat(parts, length)
		// the virtual offset of a buffer offset, by the block that it is in
		let b = -1
		const voffsetOf = (p: number) => {
			if (p < carry.length) return carryVoffset + p
			while (b + 1 < blocks.length && blocks[b + 1].start <= p) b++
			const block = blocks[b]
			// the first block of the chunk starts at the data position of minv, which it was cut at
			const dataStart = block.filePos == minv.blockPosition ? minv.dataPosition : 0
			return block.filePos * 2 ** 16 + dataStart + p - block.start
		}
		let p = 0
		while (p < data.length) {
			const voffset = voffsetOf(p)
			if (voffset >= endVoffset) return
			if (data.length - p < 8) break
			const total = 8 + data.readUInt32LE(p) + data.readUInt32LE(p + 4)
			if (total > data.length - p) break
			if (!onRecord(data, p, voffset)) return
			p += total
		}
		if (p < data.length) carryVoffset = voffsetOf(p)
		carry = data.subarray(p)
	}
	// a record of the chunk that does not end in it
	if (carry.length) throw 'the bcf file is truncated'
}

type Voffset = { blockPosition: number; dataPosition: number }

/** a virtual offset as a number, which keeps its order */
function toNumber(v: Voffset): number {
	if (v.blockPosition > maxBlockPosition) throw 'bcf file is too large'
	return v.blockPosition * 2 ** 16 + v.dataPosition
}

function fromNumber(n: number): Voffset {
	return { blockPosition: Math.floor(n / 2 ** 16), dataPosition: n % 2 ** 16 }
}

/** the size of the bgzf block at off of buf, or Infinity if buf does not have its header */
function blockSize(buf: Buffer, off: number): number {
	if (buf.length - off < 18) return Infinity
	if (buf[off] != 31 || buf[off + 1] != 139 || buf[off + 12] != 66 || buf[off + 13] != 67) throw 'not a bgzf file'
	return buf.readUInt16LE(off + 16) + 1
}

// the types of the typed values of a bcf record
const tNull = 0,
	tInt8 = 1,
	tInt16 = 2,
	tInt32 = 3,
	tFloat = 5,
	tChar = 7
const typeSize = [0, 1, 2, 4, 8, 4, 0, 1]
const int8Missing = -128,
	int8End = -127,
	int16Missing = -32768,
	int16End = -32767,
	int32Missing = -2147483648,
	int32End = -2147483647
const floatMissingBits = 0x7f800001,
	floatEndBits = 0x7f800002
/** the missing value and vector end of each integer type */
const intMissing = [0, int8Missing, int16Missing, int32Missing]
const intEnd = [0, int8End, int16End, int32End]

/*
A record of a bcf file, which is decoded as it is read, and whose INFO and FORMAT fields are decoded when they are
first used. The text of a field is as bcftools query prints it. A record keeps the decompressed window of the file
that it is in, so that a caller keeps the values that it needs instead of the record.
*/
export class BcfRecord {
	/** the index of the chromosome in the header */
	readonly rid: number
	/** 0-based */
	readonly pos0: number
	readonly rlen: number
	/** %CHROM */
	readonly chr: string
	/** %POS, 1-based */
	readonly pos: number
	/** %ID */
	readonly id: string
	/** %REF */
	readonly ref: string
	/** the alleles of %ALT, which is "." for none */
	readonly alts: string[]
	private readonly alleles: string[]
	private readonly nInfo: number
	private readonly nFmt: number
	private readonly nSample: number
	/** the offset of the INFO fields in buf */
	private readonly infoStart: number
	/** the offset of the FORMAT fields in buf */
	private readonly indivStart: number
	private infoFields?: TypedField[]
	private fmtFields?: TypedField[]

	constructor(private h: BcfHeader, private buf: Buffer, recStart: number, private selected: number[]) {
		const s = recStart + 8
		this.indivStart = s + buf.readUInt32LE(recStart)
		this.rid = buf.readInt32LE(s)
		this.pos0 = buf.readInt32LE(s + 4)
		this.rlen = buf.readInt32LE(s + 8)
		this.nInfo = buf.readUInt16LE(s + 16)
		const nAllele = buf.readUInt16LE(s + 18)
		this.nSample = buf.readUIntLE(s + 20, 3)
		this.nFmt = buf[s + 23]
		const c = new Cursor(buf, s + 24)
		this.id = c.sizedString()
		this.alleles = []
		for (let i = 0; i < nAllele; i++) this.alleles.push(c.sizedString())
		// FILTER
		const [n, type] = c.typeDescriptor()
		c.p += n * typeSize[type]
		this.infoStart = c.p
		this.chr = h.contigs[this.rid] ?? ''
		this.pos = this.pos0 + 1
		this.ref = this.alleles[0] ?? ''
		this.alts = this.alleles.length > 1 ? this.alleles.slice(1) : ['.']
	}

	/** the INFO fields, by the order of the record */
	private getInfo(): TypedField[] {
		if (!this.infoFields) {
			const c = new Cursor(this.buf, this.infoStart)
			this.infoFields = []
			for (let i = 0; i < this.nInfo; i++) {
				const key = c.typedInt()
				const [n, type] = c.typeDescriptor()
				this.infoFields.push({ key, n, type, off: c.p })
				c.p += n * typeSize[type]
			}
		}
		return this.infoFields
	}

	/** the FORMAT fields, by the order of the record, where n is the number of values of each sample */
	private getFormat(): TypedField[] {
		if (!this.fmtFields) {
			const c = new Cursor(this.buf, this.indivStart)
			this.fmtFields = []
			for (let i = 0; i < this.nFmt; i++) {
				const key = c.typedInt()
				const [n, type] = c.typeDescriptor()
				this.fmtFields.push({ key, n, type, off: c.p })
				c.p += this.nSample * n * typeSize[type]
			}
		}
		return this.fmtFields
	}

	/** the INFO field of an id index, or undefined if the record does not have it */
	infoField(key: number): TypedField | undefined {
		return this.getInfo().find(f => f.key == key)
	}

	/** %INFO */
	info(): string {
		let s = ''
		let first = true
		for (const f of this.getInfo()) {
			// as bcftools, which adds the separator before it skips a field without an id
			if (!first) s += ';'
			first = false
			const name = this.h.ids[f.key]
			if (name === undefined) continue
			s += name
			if (f.n <= 0) continue
			s += '=' + (f.n == 1 ? formatInfo1(this.buf, f) : formatArray(this.buf, f.off, f.n, f.type))
		}
		return first ? '.' : s
	}

	/** the text of a string INFO field of an id index, or null if the record does not have it or it is empty */
	infoString(key: number): string | null {
		const f = this.infoField(key)
		if (!f || f.n <= 0 || f.type != tChar) return null
		return this.buf.toString('utf8', f.off, f.off + f.n)
	}

	/*
	the values of a numeric INFO field of an id index as bcftools reads them for an expression, where null is a missing
	value, and none is a missing field: a field of one value, by its header, is read by its first value, or 0 if it does
	not have just one, and a missing value or vector end of an integer field of more values is read as a number
	*/
	infoNumbers(key: number, isVector: boolean): (number | null)[] {
		const f = this.infoField(key)
		if (!f) return []
		const buf = this.buf
		if (!isVector) {
			if (f.n != 1) return [0]
			if (f.type == tFloat) return buf.readUInt32LE(f.off) == floatMissingBits ? [] : [buf.readFloatLE(f.off)]
			if (f.type == tChar) return [buf.readInt8(f.off)]
			const v = readInt(buf, f.off, f.type)
			return v == intMissing[f.type] ? [] : [v]
		}
		const values: (number | null)[] = []
		for (let j = 0; j < f.n; j++) {
			const p = f.off + j * typeSize[f.type]
			if (f.type == tFloat) {
				// a vector end is a NaN, which meets only "!=", as a missing value does
				values.push(buf.readUInt32LE(p) == floatMissingBits ? null : buf.readFloatLE(p))
			} else if (f.type == tInt8 || f.type == tInt16 || f.type == tInt32) {
				const v = readInt(buf, p, f.type)
				values.push(v == intMissing[f.type] ? int32Missing : v == intEnd[f.type] ? int32End : v)
			}
		}
		return values
	}

	/** %FORMAT: the FORMAT ids joined by ":", and then the values of each sample joined by ":" */
	format(): string[] {
		if (!this.selected.length) return ['.']
		const fields = this.getFormat()
		if (!fields.length) return ['', ...Array(this.nSample + 1).fill('.')]
		let gt = -1
		const names: string[] = []
		for (const [i, f] of fields.entries()) {
			const name = this.h.ids[f.key]
			if (name === undefined) continue
			names.push(name)
			if (name == 'GT') gt = i
		}
		const columns = fields.map((f, i) =>
			formatSamples(this.buf, f, this.selected, off =>
				i == gt ? formatGt(this.buf, off, f.n, f.type) : formatArray(this.buf, off, f.n, f.type)
			)
		)
		const out = [names.length ? names.join(':') : '.']
		for (let j = 0; j < this.selected.length; j++) {
			let v = columns[0][j]
			for (let i = 1; i < columns.length; i++) v += ':' + columns[i][j]
			out.push(v)
		}
		return out
	}

	/** [\t%TGT]: the genotype of each sample, by the alleles of the record */
	tgt(): string[] {
		// bcftools does not read a file without GT for %TGT
		if (this.h.gtId < 0) throw 'no GT field in the bcf header'
		const f = this.getFormat().find(f => f.key == this.h.gtId)
		// bcftools prints a "." for a genotype that is not of int8, of a record that has 64 or more alleles
		if (!f || f.type != tInt8) return this.selected.map(() => '.')
		return formatSamples(this.buf, f, this.selected, off => this.formatTgt(off, f.n))
	}

	private formatTgt(off: number, ploidy: number): string {
		let s = ''
		let l = 0
		for (; l < ploidy && this.buf.readInt8(off + l) != int8End; l++) {
			const v = this.buf.readInt8(off + l)
			if (l) s += v & 1 ? '|' : '/'
			const allele = (v >> 1) - 1
			s += v >> 1 && allele >= 0 && allele < this.alleles.length ? this.alleles[allele] : '.'
		}
		return l ? s : '.'
	}
}

/*
returns the text of a FORMAT field of each selected sample, by format(off) of the offset of its value. A value of up to
2 bytes, such as a diploid genotype, is formatted once for all the samples that have it, as most samples of a record
have one of a few values.
*/
function formatSamples(buf: Buffer, f: TypedField, selected: number[], format: (off: number) => string): string[] {
	const size = f.n * typeSize[f.type]
	const out: string[] = new Array(selected.length)
	if (size > 2) {
		for (let j = 0; j < selected.length; j++) out[j] = format(f.off + selected[j] * size)
		return out
	}
	const byValue = new Map<number, string>()
	for (let j = 0; j < selected.length; j++) {
		const off = f.off + selected[j] * size
		const value = size == 2 ? buf.readUInt16LE(off) : size == 1 ? buf[off] : 0
		let s = byValue.get(value)
		if (s === undefined) {
			s = format(off)
			byValue.set(value, s)
		}
		out[j] = s
	}
	return out
}

/** a typed field of a record, of n values of a type at buf[off] */
type TypedField = { key: number; n: number; type: number; off: number }

/** reads the typed values of a record */
class Cursor {
	constructor(private buf: Buffer, public p: number) {}

	/** the number and type of the values of a typed value */
	typeDescriptor(): [number, number] {
		const b = this.buf[this.p++]
		let n = b >> 4
		const type = b & 15
		if (n == 15) n = this.typedInt()
		if (n < 0 || (!typeSize[type] && type != tNull)) throw 'invalid typed value of a bcf record'
		return [n, type]
	}

	/** a typed value of a single integer */
	typedInt(): number {
		const type = this.buf[this.p++] & 15
		const v = readInt(this.buf, this.p, type)
		this.p += typeSize[type]
		return v
	}

	/** a typed string, which is "." if it is empty */
	sizedString(): string {
		const [n, type] = this.typeDescriptor()
		const start = this.p
		this.p += n * typeSize[type]
		if (n == 0) return '.'
		return charString(this.buf, start, n)
	}
}

function readInt(buf: Buffer, off: number, type: number): number {
	if (type == tInt8) return buf.readInt8(off)
	if (type == tInt16) return buf.readInt16LE(off)
	if (type == tInt32) return buf.readInt32LE(off)
	throw 'invalid typed integer of a bcf record'
}

/** the string of n chars at buf[off], up to a NUL, as htslib prints it */
function charString(buf: Buffer, off: number, n: number): string {
	// a value that is as long as the longest of its field has no NUL, so that the search is of its n chars only
	let end = off
	while (end < off + n && buf[end] !== 0) end++
	return buf.toString('utf8', off, end)
}

/** the text of an INFO field of one value, as bcftools query prints it for %INFO */
function formatInfo1(buf: Buffer, f: TypedField): string {
	if (f.type == tChar) return String.fromCharCode(buf[f.off])
	if (f.type == tFloat) return buf.readUInt32LE(f.off) == floatMissingBits ? '.' : formatFloat(buf.readFloatLE(f.off))
	const v = readInt(buf, f.off, f.type)
	return v == intMissing[f.type] ? '.' : String(v)
}

/** the text of n values of a type at buf[off], as bcf_fmt_array() of htslib prints them */
function formatArray(buf: Buffer, off: number, n: number, type: number): string {
	if (n == 0) return '.'
	if (type == tChar) return charString(buf, off, n)
	const values: string[] = []
	for (let j = 0; j < n; j++) {
		const p = off + j * typeSize[type]
		if (type == tFloat) {
			const bits = buf.readUInt32LE(p)
			if (bits == floatEndBits) break
			values.push(bits == floatMissingBits ? '.' : formatFloat(buf.readFloatLE(p)))
		} else {
			const v = readInt(buf, p, type)
			if (v == intEnd[type]) break
			values.push(v == intMissing[type] ? '.' : String(v))
		}
	}
	return values.join(',')
}

/** the text of a GT value of a sample, as bcf_format_gt() of htslib prints it for %FORMAT: allele indexes */
function formatGt(buf: Buffer, off: number, n: number, type: number): string {
	if (type == tNull) return '.'
	let s = ''
	let i = 0
	for (; i < n; i++) {
		const v = readInt(buf, off + i * typeSize[type], type)
		if (v == intEnd[type]) break
		if (i) s += v & 1 ? '|' : '/'
		s += v >> 1 ? String((v >> 1) - 1) : '.'
	}
	return i ? s : '.'
}

/*
the text of a float as kputd() of htslib prints it: the 6 significant digits of a value from 0.0001 to 999999, without
trailing zeros, and %g of printf for other values
*/
export function formatFloat(d: number): string {
	if (d == 0) return Object.is(d, -0) ? '-0' : '0'
	if (Number.isNaN(d)) return 'nan'
	if (d < 0) return '-' + formatFloat(-d)
	if (!(d >= 0.0001 && d <= 999999)) return formatG(d)
	// the number of decimals of the 6 significant digits, by the magnitude of d
	let k = 9
	while (k > 0 && d >= decimalLimits[9 - k]) k--
	const digits = String(rint(d * 10 ** k)).padStart(k + 1, '0')
	return trimZeros(k ? digits.slice(0, -k) + '.' + digits.slice(-k) : digits)
}

/** the lower limit of a value that is printed with 8 decimals, 7 decimals, and so on, as in kputd() */
const decimalLimits = [0.001, 0.01, 0.1, 1, 10, 100, 1000, 10000, 100000]

/** rounds to an integer as rint() of C, with a tie to the even integer */
function rint(x: number): number {
	const r = Math.round(x)
	return r - x == 0.5 && r % 2 != 0 ? r - 1 : r
}

/** %g of printf for a positive value: 6 significant digits, without trailing zeros, in exponent form if the exponent
 * is less than -4 or more than 5 */
function formatG(d: number): string {
	if (d == Infinity) return 'inf'
	const [m, e] = d.toExponential(5).split('e')
	let mantissa = m
	let exp = Number(e)
	// toExponential() rounds a tie up, and printf to the even digit; only an integer can be a tie of 6 digits
	if (Number.isInteger(d) && exp >= 6) {
		const unit = 10n ** BigInt(exp - 5)
		const q = BigInt(d) / unit
		if ((BigInt(d) % unit) * 2n == unit && q % 2n == 0n) {
			const s = q.toString()
			mantissa = s[0] + '.' + s.slice(1)
			exp = s.length - 1 + (exp - 5)
		}
	}
	if (exp < -4 || exp >= 6)
		return trimZeros(mantissa) + 'e' + (exp < 0 ? '-' : '+') + String(Math.abs(exp)).padStart(2, '0')
	return trimZeros(d.toFixed(5 - exp))
}

/** a decimal number without the trailing zeros of its fraction, or the point if they are all of it */
function trimZeros(s: string): string {
	return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s
}

/*
returns the test of a record for a condition, as the -i expression of bcftools tests it: a record meets a condition if
any value of the field meets it, where a string field and a string value are split by commas, and "." is a missing
string. A missing value or field meets only "!=", except that bcftools reads a missing value of an integer field of
more than one value as -2147483648. Numbers are compared as 32-bit floats, unless one of them is more than 2**24.
*/
function compileCondition(h: BcfHeader, c: InfoCondition): (r: BcfRecord) => boolean {
	if (!c || typeof c.key != 'string') throw 'invalid info filter'
	const meta = h.info.get(c.key)
	const key = h.idIndex.get(c.key)
	if (!meta || key === undefined) throw `the tag "${c.key}" is not defined in the bcf header`
	const op = c.op
	if (!['=', '!=', '<', '<=', '>', '>='].includes(op)) throw 'invalid info filter operator'
	const isString = meta.type == 'String' || meta.type == 'Character'
	if (isString != (typeof c.value == 'string')) throw 'cannot use arithmetic operators to compare strings and numbers'
	if (typeof c.value == 'string') {
		if (op != '=' && op != '!=') throw 'invalid info filter operator for a string'
		const value = c.value
		return r => matchStrings(r.infoString(key), value, op == '!=')
	}
	if (typeof c.value != 'number' || Number.isNaN(c.value)) throw 'invalid info filter value'
	const value = c.value
	if (meta.type == 'Flag') return r => compareNumbers(r.infoField(key) ? 1 : 0, value, op)
	const isVector = meta.number != '1'
	return r => {
		const values = r.infoNumbers(key, isVector)
		if (!values.length) return op == '!='
		return values.some(v => (v === null ? op == '!=' : compareNumbers(v, value, op)))
	}
}

function compareNumbers(a: number, b: number, op: InfoOp): boolean {
	if (!(a > 16777216 || b > 16777216)) {
		a = Math.fround(a)
		b = Math.fround(b)
	}
	switch (op) {
		case '=':
			return a == b
		case '!=':
			return a != b
		case '<':
			return a < b
		case '<=':
			return a <= b
		case '>':
			return a > b
		case '>=':
			return a >= b
	}
}

/*
true if any comma-separated field of s meets "=" or "!=" with any field of value, as cmp_vector_strings() of bcftools,
where s is null for a record without the field, and an empty value is none
*/
function matchStrings(s: string | null, value: string, ne: boolean): boolean {
	// the result of a comparison with a missing value, by the number of sides that are missing
	const missingLogic = ne ? [true, true, false] : [true, false, true]
	if (s === null && !value) return missingLogic[2]
	if (s === null || !value) return missingLogic[fields(s ?? value).includes('.') ? 2 : 1]
	const b = fields(value)
	for (const x of fields(s)) {
		for (const y of b) {
			const nmiss = (x == '.' ? 1 : 0) + (y == '.' ? 1 : 0)
			if (nmiss) {
				if (missingLogic[nmiss]) return true
			} else if ((x == y) != ne) return true
		}
	}
	return false
}

/** the comma-separated fields of a string, up to a NUL, as bcftools reads them, where a trailing comma does not start a
 * field */
function fields(s: string): string[] {
	s = s.split('\0')[0]
	if (!s) return []
	const lst = s.split(',')
	if (lst.length > 1 && lst.at(-1) === '') lst.pop()
	return lst
}
