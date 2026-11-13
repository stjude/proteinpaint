import path from 'path'
import type { RouteApi, RoutePayload, TermdbMds3LDRequest, TermdbMds3LDResponse } from '#types'
import { string2pos } from '#shared/common.js'
import { genomes } from '#src/initGenomesDs.js'
import serverconfig from '#src/serverconfig.js'
import { readTabixLines } from '#src/utils.js'
import { validGenomeDs } from '#routes/common.ts'

export const payload: RoutePayload = {
	get init() {
		return hasMds3LDDataDs(genomes) ? init : null
	},
	request: {
		typeId: 'TermdbMds3LDRequest',
		checker: validTermdbMds3LDRequest
	},
	response: { typeId: 'TermdbMds3LDResponse' }
}

export const api: RouteApi = {
	endpoint: 'termdb/mds3/getLDdata',
	methods: {
		get: payload,
		post: payload
	}
}

export function hasMds3LDDataDs(genomes) {
	return Object.values(genomes).some((genome: any) =>
		[...Object.values(genome.datasets || {}), ...Object.values(genome.termdbs || {})].some(
			(ds: any) => ds.queries?.ld?.tracks?.length
		)
	)
}

export function validTermdbMds3LDRequest(input): TermdbMds3LDRequest {
	const ids = validGenomeDs(input)
	if (typeof input.ldtkname != 'string' || !input.ldtkname) throw '.ldtkname missing'
	const m = input.m
	if (!m || typeof m != 'object' || Array.isArray(m)) throw 'q.m{} not object'
	if (typeof m.chr != 'string' || !m.chr || !Number.isInteger(m.pos)) throw 'invalid q.m.chr/pos'
	if (!m.ref || !m.alt) throw 'q.m{} invalid alleles'
	return { ...ids, ldtkname: input.ldtkname, m: { chr: m.chr, pos: m.pos, ref: m.ref, alt: m.alt } }
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		const q: TermdbMds3LDRequest = req.query
		let result: TermdbMds3LDResponse
		try {
			const genome = genomes[q.genome]
			if (!genome) throw 'invalid genome name'
			const ds = genome.datasets?.[q.dslabel] || genome.termdbs?.[q.dslabel]
			if (!ds) throw 'invalid dataset name'
			result = await getMds3LDdata(q, ds, genome)
		} catch (e: any) {
			if (e.stack) console.log(e.stack)
			result = { status: e.status || 400, error: e.message || e }
		}
		res.send(result satisfies TermdbMds3LDResponse)
	}
}

export async function getMds3LDdata(q: TermdbMds3LDRequest, ds, genome): Promise<TermdbMds3LDResponse> {
	const tracks = ds.queries?.ld?.tracks
	if (!tracks) throw 'no ld tk'
	const tk = tracks.find(i => i.name == q.ldtkname)
	if (!tk) throw 'unknown ld tk'

	const p = string2pos(`${q.m.chr}:${q.m.pos}`, genome)
	if (!p?.actualposition) throw 'invalid q.m.chr/pos'
	const chr = p.chr
	const pos = p.actualposition.position
	const thisAlleles = `${q.m.ref}.${q.m.alt}`
	const lst: { pos: number; alleles: string; r2: number }[] = []
	await readTabixLines({
		file: path.join(serverconfig.tpmasterdir, tk.file),
		regions: [{ chr: tk.nochr ? chr.replace('chr', '') : chr, start: pos, stop: pos + 1 }],
		callback: line => {
			const columns = line.split('\t')
			const start = Number.parseInt(columns[1])
			const stop = Number.parseInt(columns[2])
			const alleles1 = columns[3]
			const alleles2 = columns[4]
			const r2 = Number.parseFloat(columns[5])
			if (start == pos && alleles1 == thisAlleles) {
				lst.push({ pos: stop, alleles: alleles2, r2 })
			} else if (stop == pos && alleles2 == thisAlleles) {
				lst.push({ pos: start, alleles: alleles1, r2 })
			}
		}
	})
	return { lst }
}
