import fs from 'fs'
import path from 'path'
import { BgzipIndexedFasta, IndexedFasta } from '@gmod/indexedfasta'
import serverconfig from './serverconfig.js'
import { libraryErrorText } from './utils/libraryError.ts'

/*
Reads a region of an indexed fasta file in the server process, with @gmod/indexedfasta, instead of with samtools
faidx. The fasta file is a path under tp, where a relative path is under tp, with its file.fai index, and the
file.gzi index if the file is bgzipped.

An opened file, with its parsed index, is kept for later reads, until its index or data file changes.
*/

type Seq = { length: number; lineBases: number }
type OpenFasta = { stamp: string; fasta: IndexedFasta; seqs: Map<string, Seq> }

const openFastas = new Map<string, OpenFasta>()

/*
returns the fasta text of a region as samtools faidx: the header line >chr:start-stop, and the sequence by the line
length of the chromosome in the fasta file, without a newline at the end. start and stop are 1-based and inclusive.
Rejects a region that is not in the chromosome, for which samtools faidx gives a warning.
*/
export async function readFastaRegion(file: unknown, chr: string, start: number, stop: number): Promise<string> {
	if (!Number.isSafeInteger(start) || !Number.isSafeInteger(stop) || start < 1 || stop < start) throw 'invalid region'
	const f = await openFasta(checkFile(file))
	const seq = f.seqs.get(chr)
	if (!seq) throw 'chromosome not found in the fasta file'
	if (stop > seq.length) throw 'region is beyond the chromosome end'
	let s: string | undefined
	try {
		s = await f.fasta.getSequence(chr, start - 1, stop)
	} catch (e) {
		throw libraryErrorText(e)
	}
	if (s === undefined) throw 'chromosome not found in the fasta file'
	const lines = [`>${chr}:${start}-${stop}`]
	const n = seq.lineBases || s.length
	for (let i = 0; i < s.length; i += n) lines.push(s.slice(i, i + n))
	return lines.join('\n')
}

async function openFasta(file: string): Promise<OpenFasta> {
	const stat = (f: string) => fs.promises.stat(f).catch(() => null)
	const [data, fai, gzi] = await Promise.all([stat(file), stat(file + '.fai'), stat(file + '.gzi')])
	if (!data) throw 'cannot open the fasta file'
	if (!fai) throw 'cannot find the .fai index of the fasta file'
	if (!gzi && file.endsWith('.gz')) throw 'cannot find the .gzi index of the bgzipped fasta file'
	const stamp = [data, fai, gzi].map(s => (s ? `${s.mtimeMs}:${s.size}:${s.ino}` : '')).join(' ')
	const cached = openFastas.get(file)
	if (cached?.stamp == stamp) return cached
	const fasta = gzi
		? new BgzipIndexedFasta({ path: file, faiPath: file + '.fai', gziPath: file + '.gzi' })
		: new IndexedFasta({ path: file, faiPath: file + '.fai' })
	const f = { stamp, fasta, seqs: await readFai(file + '.fai') }
	openFastas.set(file, f)
	return f
}

/** returns the length and line length of each sequence of a .fai index, of which the columns are name, length,
 * offset, line bases, and line bytes */
async function readFai(file: string): Promise<Map<string, Seq>> {
	const seqs = new Map<string, Seq>()
	for (const line of (await fs.promises.readFile(file, 'utf8')).split('\n')) {
		const l = line.split('\t')
		if (l.length < 5) continue
		if (!seqs.has(l[0])) seqs.set(l[0], { length: Number(l[1]), lineBases: Number(l[3]) })
	}
	return seqs
}

/** returns the absolute path of a file under tp, where a relative path is under tp, or throws */
function checkFile(file: unknown): string {
	// eslint-disable-next-line no-control-regex
	if (typeof file != 'string' || !file || /[\x00-\x1f\x7f]/.test(file)) throw 'invalid fasta file'
	// a ".." segment could leave tp
	if (file.split('/').includes('..')) throw 'invalid fasta file'
	const root = path.resolve(serverconfig.tpmasterdir)
	const f = path.resolve(root, file)
	if (!f.startsWith(root + path.sep)) throw 'invalid fasta file'
	return f
}
