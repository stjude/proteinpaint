import { BigBed } from '@gmod/bbi'
import type { GenericFilehandle } from 'generic-filehandle2'
import { libraryErrorText } from './utils/libraryError.ts'
import { locateDataFile } from './indexedFile.ts'
import { OpenFiles } from './utils/openFiles.ts'
import type { IndexKind } from './indexedFile.ts'

/*
Reads a bigBed file in the server process, with @gmod/bbi, instead of with the bigBed tools of ucsc. The reads are
the same as those of the tools, see readBigbedLines(), readBigbedByName(), and isBigbedFile().

A file is located as in indexedFile.ts. A bigBed file has its index inside it, so that a url file has no index in a
cache dir.

An opened file, with its parsed header, is kept for later reads, until its data file changes or it is one of the
files that have not been read for the longest time, see maxOpenFiles.
*/

type OpenFile = { bb: BigBed; fh: GenericFilehandle }

const maxOpenFiles = 100
/** the upper limit of a 0-based coordinate */
const maxCoord = 999_999_999_999
/** a chromosome name, which does not start with "-" */
const chrPattern = /^[A-Za-z0-9_.][A-Za-z0-9_.-]{0,99}$/
/** a name in an extra index of a file, such as a snp rsid or a gene name */
const namePattern = /^[A-Za-z0-9_.][A-Za-z0-9_.:+-]{0,199}$/
/** the column of the name field of a bed line, which is the field of the extra index that is searched by name */
const nameField = 3
const bigbedKind: IndexKind = { name: 'bigBed', localPaths: () => [], exts: [] }

const openFiles = new OpenFiles<OpenFile>(maxOpenFiles, closeFile)

/*
returns the bed lines of the items that overlap a range, as bigBedToBed -chrom -start -end: an item overlaps when it
has a base in the range, or when it has no base and is at the start or end of the range, such as an insertion

file: the full path of a local file, or a url
start, end: 0-based and half-open, where an end of 0 is the end of the chromosome
*/
export async function readBigbedLines(file: string, chr: string, start: number, end: number): Promise<string[]> {
	if (typeof chr != 'string' || !chrPattern.test(chr)) throw 'invalid chr'
	if (!isCoord(start) || !isCoord(end)) throw 'invalid start or end'
	const f = await openBigbedFile(file)
	let features
	try {
		if (end == 0) {
			// an end of 0 is the end of the chromosome, as bigBedToBed reads it
			const { refsByName, refsByNumber } = await f.bb.getHeader()
			if (!Object.hasOwn(refsByName, chr)) return []
			end = refsByNumber[refsByName[chr]].length
		}
		// the range is one base wider on each side, so that an item without a base at its start or end is read
		features = await f.bb.getFeatures(chr, Math.max(0, start - 1), end + 1)
	} catch (e) {
		throw libraryErrorText(e)
	}
	const lines: string[] = []
	for (const i of features) {
		if ((i.start < end && i.end > start) || (i.start == i.end && (i.start == end || i.end == start)))
			lines.push(bedLine(chr, i.start, i.end, i.rest))
	}
	return lines
}

/** returns the bed lines of the items that have a name, by the extra index of the name field, as bigBedNamedItems */
export async function readBigbedByName(file: string, name: string): Promise<string[]> {
	if (typeof name != 'string' || !namePattern.test(name)) throw 'invalid name'
	const f = await openBigbedFile(file)
	try {
		if (!(await f.bb.readIndices()).some(i => i.field == nameField))
			throw 'the bigBed file has no index of the name field'
		const lines: string[] = []
		for (const i of await f.bb.searchExtraIndex(name)) {
			if (i.field == nameField && i.refName !== undefined) lines.push(bedLine(i.refName, i.start, i.end, i.rest))
		}
		return lines
	} catch (e) {
		throw libraryErrorText(e)
	}
}

/** true if a file is a bigBed file; false for any other file, or one that cannot be opened or is not allowed */
export async function isBigbedFile(file: string): Promise<boolean> {
	try {
		await openBigbedFile(file)
		return true
	} catch (_) {
		return false
	}
}

/** a bed line as bigBedToBed prints it, where an item of a bed3 file has no rest */
function bedLine(chr: string, start: number, end: number, rest: string | undefined) {
	return `${chr}\t${start}\t${end}${rest ? '\t' + rest : ''}`
}

function isCoord(v: unknown): v is number {
	return typeof v == 'number' && Number.isSafeInteger(v) && v >= 0 && v <= maxCoord
}

/** returns the open file of a bigBed file, which is opened again if its data file has changed, or throws */
async function openBigbedFile(file: unknown): Promise<OpenFile> {
	const { location, stamp, open } = await locateDataFile(file, null, bigbedKind)
	const cached = openFiles.get(location, stamp)
	if (cached) return cached
	const fh = open()
	const f: OpenFile = { bb: new BigBed({ filehandle: fh }), fh }
	try {
		// a file that is not a bigBed file is not kept, such as a tabix file that isBigbedFile() is called with
		if ((await f.bb.getHeader()).fileType != 'bigbed') throw 'not a bigBed file'
	} catch (e) {
		closeFile(f)
		throw libraryErrorText(e)
	}
	openFiles.set(location, stamp, f)
	return f
}

function closeFile(f: OpenFile) {
	// a read in progress may still use the handle, which is opened again if so
	f.fh.close().catch(() => {})
}
