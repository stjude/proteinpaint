/*
Validates request values that the /hicdata and /hicgenome routes pass as straw arguments.

straw is a spawned tool that is not restricted by the node permission model, and its arguments are
positional, so each value is checked against the expected format instead of being passed through.
*/

/** straw matrix types, where the client's 'log(oe)' is computed from straw's 'oe' */
const matrixTypes = new Set(['observed', 'expected', 'oe', 'log(oe)'])

/** a normalization name is read from the hic file, such as NONE, VC, VC_SQRT, KR, SCALE, or GW_KR */
const nmethRegexp = /^[A-Z][A-Z0-9_]{0,31}$/

/** a chromosome name must not start with '-', which would be parsed as an option */
const chrRegexp = /^[A-Za-z0-9_.][A-Za-z0-9_.-]{0,99}$/

/** a coordinate may be fractional when computed from a view position */
const coordRegexp = /^\d+(\.\d+)?$/

/** the genome view spawns one straw process per chromosome pair, n*(n+1)/2 for n chromosomes;
 * the client sends the genome's major chromosomes, which is 25 for human */
export const MAX_CHRLST = 100

/** at most this many straw processes are spawned at once by the genome view */
export const STRAW_CONCURRENCY = 8

export function getStrawArgs(q: { matrixType?: any; nmeth?: any; resolution?: any }) {
	const matrixType = q.matrixType || 'observed'
	if (!matrixTypes.has(matrixType)) throw 'invalid matrixType'
	const nmeth = q.nmeth || 'NONE'
	if (typeof nmeth != 'string' || !nmethRegexp.test(nmeth)) throw 'invalid nmeth'
	// a GET request has a string value
	const resolution = Number(q.resolution)
	if (!Number.isInteger(resolution) || resolution < 1) throw 'invalid resolution'
	return {
		/** the straw matrix type */
		strawMatrixType: matrixType == 'log(oe)' ? 'oe' : matrixType,
		nmeth,
		resolution: String(resolution)
	}
}

export function validHicChr(chr: any) {
	if (typeof chr != 'string' || !chrRegexp.test(chr)) throw 'invalid chromosome name'
	return chr
}

/** pos is a chromosome name, or chr:start:stop */
export function validHicPos(pos: any) {
	if (typeof pos != 'string') throw 'invalid position'
	const [chr, ...coords] = pos.split(':')
	validHicChr(chr)
	if (coords.length == 0) return pos
	if (coords.length != 2 || !coords.every(c => coordRegexp.test(c))) throw 'invalid position'
	if (Number(coords[0]) > Number(coords[1])) throw 'invalid position: start > stop'
	return pos
}

export function validChrlst(chrlst: any) {
	if (!Array.isArray(chrlst) || !chrlst.length) throw 'chrlst must be a non-empty array'
	if (chrlst.length > MAX_CHRLST) throw `chrlst must not have more than ${MAX_CHRLST} chromosomes`
	for (const chr of chrlst) validHicChr(chr)
	if (new Set(chrlst).size != chrlst.length) throw 'chrlst must not have duplicate chromosomes'
	return chrlst as string[]
}
