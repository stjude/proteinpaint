import type { RouteApi, RoutePayload, TermdbJunctionsRequest, TermdbJunctionsResponse } from '#types'
import { genomes } from '#src/initGenomesDs.js'
import { authApi } from '#src/auth.js'
import { resolveSampleMapping } from '#src/termdb.matrix.js'
import { groupOrder, getSampleGroups } from '#src/utils/sampleGroups.ts'

/*
list junctions from a locus
*/

const payload: RoutePayload = {
	// a getter so that the loaded genomes are checked when augen sets up the route, not when this module
	// is evaluated; the route is only set up when at least one mds3 ds has a junction query
	get init() {
		return hasJunctionDs(genomes) ? init : null
	},
	request: { typeId: 'TermdbJunctionsRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'TermdbJunctionsResponse' }
}

export const api: RouteApi = {
	endpoint: 'termdb/junctions',
	methods: {
		get: payload,
		post: payload
	}
}

/*
returns true when any loaded mds3 ds from any genome has .queries.junction
legacy mds ds may also have .queries.junction (type=mdsjunction) but are not served by j2 routes
*/
export function hasJunctionDs(genomes) {
	return Object.values(genomes).some((g: any) =>
		Object.values(g.datasets || {}).some((ds: any) => ds.isMds3 && ds.queries?.junction)
	)
}

export function init({ genomes }) {
	return async (req, res) => {
		try {
			const q: TermdbJunctionsRequest = req.query
			const gn = genomes[q.genome]
			if (!gn) throw 'invalid genome'
			const ds = gn.datasets?.[q.dslabel]
			if (!ds) throw 'invalid dslabel'
			if (!ds.queries?.junction) throw 'junction query not supported'
			// assuming genomic data in tk is at sample-level, so setting
			// sampleMapping=parentToChildren to allow parent-level term data to be mapped
			// onto tk data (e.g. parent-level terms in variant2sample query or in tk filter)
			resolveSampleMapping(Object.assign(q, { sampleMapping: 'parentToChildren' }), ds)
			const groups = q.groupTw ? await junctionGroups(q, ds) : undefined
			const result = await ds.queries.junction.listJunctions(q, undefined, groups)
			// the matrix has a row per sample: only for a user who may see sample names
			if (result.matrix && !authApi.canDisplaySampleIds(req, ds)) delete result.matrix
			res.send(result satisfies TermdbJunctionsResponse)
		} catch (e: any) {
			res.send({ status: e.status || 400, error: e.message || String(e) } satisfies TermdbJunctionsResponse)
			if (e.stack) console.log(e.stack)
		}
	}
}

/* the group of each sample of the junction file, by its id there, for the two groups of q.groupTw, the first the
reference; resolved as the methylation locus view resolves its groups */
async function junctionGroups(q: TermdbJunctionsRequest, ds: any) {
	const names = groupOrder(q)
	if (names?.length != 2) throw new Error('groupTw must have two groups')
	const samples: { name: string | number }[] = ds.queries.junction.samples
	const nameOf = (id: string | number) => String(ds.cohort?.termdb?.q?.id2sampleName?.(id) ?? id)
	const byName = (await getSampleGroups(q, ds, new Set(samples.map(s => nameOf(s.name)))))!
	const groupOf = new Map<string | number, string>()
	for (const s of samples) {
		const g = byName.get(nameOf(s.name))
		if (g) groupOf.set(s.name, g)
	}
	const r = q.groupRegion
	if (r && (typeof r.chr != 'string' || !Number.isInteger(r.start) || !Number.isInteger(r.stop) || r.start > r.stop))
		throw new Error('groupRegion must be {chr, start, stop}')
	return { groupOf, names: names as [string, string], ...(r ? { region: r } : {}) }
}
