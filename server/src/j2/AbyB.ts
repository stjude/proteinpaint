import type { RouteApi, RoutePayload, TermdbJunctionsAbyBRequest, TermdbJunctionsAbyBResponse } from '#types'
import computePercentile from '#shared/compute.percentile.js'

/*
get junction A median read count for the same set of samples with junction B
*/

const payload: RoutePayload = {
	init,
	request: { typeId: 'TermdbJunctionsAbyBRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'TermdbJunctionsAbyBResponse' }
}

export const api: RouteApi = {
	endpoint: 'termdb/junctions/AbyB',
	methods: {
		get: payload,
		post: payload
	}
}

export function init({ genomes }) {
	return async (req, res) => {
		try {
			const q: TermdbJunctionsAbyBRequest = req.query
			const gn = genomes[q.genome]
			if (!gn) throw 'invalid genome'
			const ds = gn.datasets?.[q.dslabel]
			if (!ds) throw 'invalid dslabel'
			if (!ds.queries?.junction) throw 'junction query not supported'

			if (typeof q.junctionB != 'object') throw 'q.junctionB not obj'
			let start = q.junctionB.start
			let stop = q.junctionB.stop
			if (!Number.isInteger(start)) throw 'q.junctionB.start not int'
			if (!Number.isInteger(stop)) throw 'q.junctionB.stop not int'

			if (!Array.isArray(q.junctionAposlst)) throw 'q.junctionAposlst not array'
			const keepLst: { start: number; stop: number; strand: string }[] = [
				{
					start: q.junctionB.start,
					stop: q.junctionB.stop,
					strand: q.junctionB.strand
				}
			]

			q.junctionAposlst.forEach(i => {
				// [start, stop]
				if (!Number.isInteger(i[0])) throw 'q.junctionAposlst[][0] not integer'
				if (!Number.isInteger(i[1])) throw 'q.junctionAposlst[][1] not integer'
				start = Math.min(start, i[0])
				stop = Math.max(stop, i[1])
				keepLst.push({ start: i[0], stop: i[1], strand: i[2] })
			})
			const rglst = [{ chr: q.junctionB.chr, start, stop }]

			const re = await ds.queries.junction.listJunctions(Object.assign({}, q, { rglst }), keepLst)
			if (!Array.isArray(re.junctions)) throw new Error('re.junctions[]')

			const jB = re.junctions.find(
				i => i.start == q.junctionB.start && i.stop == q.junctionB.stop && i.strand == q.junctionB.strand
			)
			if (!jB) throw new Error('jB not found in re.junctions')
			const lst: { start: number; stop: number; strand: string; v: number }[] = []
			for (const j of q.junctionAposlst) {
				const jA = re.junctions.find(i => i.start == j[0] && i.stop == j[1] && i.strand == j[2])
				if (!jA) throw new Error('one jA not found in re.junctions')
				// list of eligible samples are in jB.sn2rc; find jA samples that are eligible, and compute median
				const counts: number[] = []
				for (const [sn, rc] of jA.sn2rc) {
					if (!jB.sn2rc.has(sn)) continue
					counts.push(rc)
				}
				let v = 0
				if (counts.length) {
					v = counts.length == 1 ? counts[0] : computePercentile(counts, 50, false)
				}
				lst.push({
					start: j[0],
					stop: j[1],
					strand: j[2],
					v
				})
			}

			res.send({ lst } satisfies TermdbJunctionsAbyBResponse)
		} catch (e: any) {
			res.send({ status: e.status || 400, error: e.message || String(e) } satisfies TermdbJunctionsAbyBResponse)
			if (e.stack) console.log(e.stack)
		}
	}
}
