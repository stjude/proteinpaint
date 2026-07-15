import fs from 'fs'
import readline from 'readline'
import type {
	RouteApi,
	RoutePayload,
	TermdbJunctionOneSampleTkRequest,
	TermdbJunctionOneSampleTkResponse,
	TermdbJunctionOneSampleTkItem
} from '#types'
import * as utils from '#src/utils.js'
import serverconfig from '#src/serverconfig.js'

const get_lines_bigfile: any = utils.get_lines_bigfile

const payload: RoutePayload = {
	init,
	request: { typeId: 'TermdbJunctionOneSampleTkRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'TermdbJunctionOneSampleTkResponse' }
}

export const api: RouteApi = {
	endpoint: 'termdb/junction/onesampletk',
	methods: {
		get: payload
	}
}

export function init({ genomes }) {
	return async (req, res) => {
		try {
			const q: TermdbJunctionOneSampleTkRequest = req.query
			const lst = await do_query(q, genomes)
			res.send({ lst } satisfies TermdbJunctionOneSampleTkResponse)
		} catch (e: any) {
			res.send({ error: e.message || e })
			if (e.stack) console.log(e.stack)
		}
	}
}

async function do_query(q: TermdbJunctionOneSampleTkRequest, genomes): Promise<TermdbJunctionOneSampleTkItem[]> {
	const gn = genomes[q.genome]
	if (!gn) throw 'invalid genome'
	utils.validateRglst(q, gn)

	const [e, file, isurl] = utils.fileurl({ query: q })
	if (e) throw e
	if (q.rglst.reduce((i, j) => j.stop - j.start + i, 0) > 1000000) throw 'Zoom in below 1 Mb to show junctions'

	let lst: TermdbJunctionOneSampleTkItem[] // list of junctions
	if (q.isrnapeg) {
		if (!serverconfig.features.junctionrnapeg) throw 'rnapeg not supported on this server'
		if (isurl) throw 'rnapeg file from url is not supported'
		lst = await get_rnapeg(q, file)
	} else {
		// a tabix file
		const dir = isurl ? await utils.cache_index(file, q.indexURL) : null
		lst = await get_tabix(q, file, dir)
	}
	return lst
}

async function get_tabix(q: TermdbJunctionOneSampleTkRequest, file: string, dir: string | null) {
	const items: TermdbJunctionOneSampleTkItem[] = []
	for (const r of q.rglst) {
		await get_lines_bigfile({
			args: [file, r.chr + ':' + r.start + '-' + r.stop],
			dir,
			callback: (line: string) => {
				const l = line.split('\t')
				const start = Number.parseInt(l[1]),
					stop = Number.parseInt(l[2])
				if ((start >= r.start && start <= r.stop) || (stop >= r.start && stop <= r.stop)) {
					// only use those with either start/stop in region
					const j: TermdbJunctionOneSampleTkItem = {
						chr: r.chr,
						start,
						stop,
						type: l[4],
						rawdata: []
					}
					for (let i = 5; i < l.length; i++) {
						j.rawdata.push(Number.parseInt(l[i]))
					}
					items.push(j)
				}
			}
		})
	}
	return items
}

async function get_rnapeg(q: TermdbJunctionOneSampleTkRequest, file: string) {
	try {
		await fs.promises.stat(file)
	} catch (e: any) {
		if (e.code == 'EACCES') throw 'permission denied for rnapeg file'
		if (e.code == 'ENOENT') throw 'rnapeg file not found'
		throw 'cannot access rnapeg file (' + e.code + ')'
	}
	const items: TermdbJunctionOneSampleTkItem[] = []
	for (const r of q.rglst) {
		const lines = await get_lines_rnapeg({ file, chr: r.chr, start: r.start, stop: r.stop })
		for (const i of lines) items.push(i)
	}
	return items
}

function get_lines_rnapeg(args: { file: string; chr: string; start: number; stop: number }) {
	return new Promise<TermdbJunctionOneSampleTkItem[]>((resolve, _reject) => {
		const rl = readline.createInterface({ input: fs.createReadStream(args.file, { encoding: 'utf8' }) })
		const lines: TermdbJunctionOneSampleTkItem[] = []
		let first = true // skip header
		rl.on('line', line => {
			if (first) {
				first = false
				return
			}
			/*
			1	junction	chr1:3415390:+,chr1:3415702:+
			2	count	37
			3	type	known
			4	genes	MEGF6
			5	transcripts	ENST00000356575,ENST00000485002,MEGF6.aAug10,NM_001409,uc001akl.2
			6	qc_flanking	31
			7	qc_plus	17
			8	qc_minus	20
			9	qc_perfect_reads	36
			10	qc_clean_reads	1
			*/
			const l = line.split('\t')
			const t = l[0].split(/[:,]/)
			const chr = t[0]

			if (chr != args.chr) {
				// not in same chr
				return
			}
			const start1 = Number.parseInt(t[1])
			const stop1 = Number.parseInt(t[4])
			if (Number.isNaN(start1) || Number.isNaN(stop1)) return
			const start = start1 - 1,
				stop = stop1 - 1
			if ((start > args.start && start < args.stop) || (stop > args.start && stop < args.stop)) {
				// either start or stop is within range
				const count = Number.parseInt(l[1]) // read count
				const type = l[2]
				lines.push({ chr, start, stop, type, rawdata: [count] })
				return
			}
			if (start > args.stop) {
				// assumes that file is sorted by start:stop; if junction start is bigger than view range stop, then stops reading file
				rl.close()
			}
		})
		rl.on('close', () => {
			resolve(lines)
		})
	})
}
