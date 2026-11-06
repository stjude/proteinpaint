import { BigWig } from '@gmod/bbi'
import type { GenericFilehandle } from 'generic-filehandle2'
import { libraryErrorText } from './utils/libraryError.ts'
import { locateDataFile } from './indexedFile.ts'
import { OpenFiles } from './utils/openFiles.ts'
import type { IndexKind } from './indexedFile.ts'

/*
Reads a bigWig file in the server process, with @gmod/bbi, as the mean value of each bin of a range, see
readBigwigBins().

A file is located as in indexedFile.ts. A bigWig file has its index inside it, so that a url file has no index in a
cache dir.

An opened file, with its parsed header, is kept for later reads, until its data file changes or it is one of the
files that have not been read for the longest time, see maxOpenFiles.
*/

type OpenFile = { bw: BigWig; fh: GenericFilehandle }

const maxOpenFiles = 100
/** the upper limit of a 0-based coordinate */
const maxCoord = 999_999_999_999
/** a chromosome name, which does not start with "-" */
const chrPattern = /^[A-Za-z0-9_.][A-Za-z0-9_.-]{0,99}$/
const bigwigKind: IndexKind = { name: 'bigWig', localPaths: () => [], exts: [] }

/*
maxBytes: upper limit of the compressed data that is read for a range, which is checked from the index before any
data is read, so that the values of a file without zoom levels are not all held in memory for a large range; a test
may change it
*/
export const read_limits = { maxBytes: 10_000_000 }

const openFiles = new OpenFiles<OpenFile>(maxOpenFiles, closeFile)

/*
returns the mean value of each of nBins bins of a range, or null for a chromosome that is not in the file, where a
bin without data is NaN

file: the full path of a local file, or a url
start, end: 0-based and half-open

The bins and the zoom level are those of the bigWig library of pyBigWig: bin i ends at
floor(start + (end-start)*(i+1)/nBins), and the zoom level is the one with the largest reduction that is at most
half the bases of a bin, or the base data if there is no such level. The mean of a bin is over the bases of the
values that overlap it, where a value of a zoom level is the mean of its bases.
*/
export async function readBigwigBins(
	file: string,
	chr: string,
	start: number,
	end: number,
	nBins: number
): Promise<number[] | null> {
	if (typeof chr != 'string' || !chrPattern.test(chr)) throw 'invalid chr'
	if (!isCoord(start) || !isCoord(end) || end <= start) throw 'invalid start or end'
	if (!Number.isSafeInteger(nBins) || nBins < 1) throw 'invalid number of bins'
	const f = await openBigwigFile(file)
	let data
	try {
		const { refsByName, zoomLevels } = await f.bw.getHeader()
		if (!Object.hasOwn(refsByName, chr)) return null
		const opts = zoomOpts(zoomLevels, Math.floor(Math.floor((end - start) / nBins) / 2))
		if ((await f.bw.getRegionByteSize(chr, start, end, opts)) > read_limits.maxBytes)
			throw 'too much data in view range, zoom in to see the data'
		data = await f.bw.getFeaturesAsArrays(chr, start, end, opts)
	} catch (e) {
		throw libraryErrorText(e)
	}
	return binMeans(data.starts, data.ends, data.scores, start, end, nBins)
}

/** returns the options of a read, by which @gmod/bbi reads the zoom level with the largest reduction that is at
most maxReduction, or the base data if there is no such level */
function zoomOpts(zoomLevels: { reductionLevel: number }[], maxReduction: number) {
	let reduction = 0
	for (const z of zoomLevels) {
		if (z.reductionLevel <= maxReduction && z.reductionLevel > reduction) reduction = z.reductionLevel
	}
	// @gmod/bbi reads the level with the largest reduction of at most 2*basesPerSpan, and the base data if there is
	// none, where a basesPerSpan of 0 is not used; a reduction is at least 1, so 0.25 reads the base data
	return { basesPerSpan: reduction ? reduction / 2 : 0.25 }
}

/** returns the mean of each bin, by the bases of the values that overlap it, where the values are sorted by start */
function binMeans(
	starts: ArrayLike<number>,
	ends: ArrayLike<number>,
	scores: ArrayLike<number>,
	start: number,
	end: number,
	nBins: number
): number[] {
	const bins: number[] = new Array(nBins)
	// the first value that may overlap a bin, as no later bin overlaps a value that ends before a bin
	let first = 0
	let binStart = start
	for (let i = 0; i < nBins; i++) {
		const binEnd = Math.floor(start + ((end - start) * (i + 1)) / nBins)
		while (first < starts.length && ends[first] <= binStart) first++
		let sum = 0,
			bases = 0
		for (let j = first; j < starts.length && starts[j] < binEnd; j++) {
			const n = Math.min(ends[j], binEnd) - Math.max(starts[j], binStart)
			if (n <= 0) continue
			sum += n * scores[j]
			bases += n
		}
		bins[i] = bases ? sum / bases : NaN
		binStart = binEnd
	}
	return bins
}

function isCoord(v: unknown): v is number {
	return typeof v == 'number' && Number.isSafeInteger(v) && v >= 0 && v <= maxCoord
}

/** returns the open file of a bigWig file, which is opened again if its data file has changed, or throws */
async function openBigwigFile(file: unknown): Promise<OpenFile> {
	const { location, stamp, open } = await locateDataFile(file, null, bigwigKind)
	const cached = openFiles.get(location, stamp)
	if (cached) return cached
	const fh = open()
	const f: OpenFile = { bw: new BigWig({ filehandle: fh }), fh }
	try {
		if ((await f.bw.getHeader()).fileType != 'bigwig') throw 'not a bigWig file'
	} catch (e) {
		closeFile(f)
		throw libraryErrorText(e)
	}
	const existing = openFiles.get(location, stamp)
	if (existing) {
		closeFile(f)
		return existing
	}
	openFiles.set(location, stamp, f)
	return f
}

function closeFile(f: OpenFile) {
	// a read in progress may still use the handle, which is opened again if so
	f.fh.close().catch(() => {})
}
