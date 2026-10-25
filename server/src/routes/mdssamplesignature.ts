import type { RouteApi, RoutePayload } from '#types'
import { genomes } from '#src/initGenomesDs.js'
import { hasMdsDataset } from '#src/mds.shared.js'

/*
The route of the mutation signature of a sample of a legacy mds dataset.
*/

const payload: RoutePayload = {
	// a getter so that the loaded genomes are checked when augen sets up the route, not when this module is evaluated;
	// the route is only set up when a loaded genome has a legacy mds dataset
	get init() {
		return hasMdsDataset(genomes) ? init : null
	},
	request: { typeId: 'any' },
	response: { typeId: 'any' }
}

export const api: RouteApi = {
	endpoint: 'mdssamplesignature',
	methods: {
		post: payload
	}
}

function init({ genomes }) {
	return function handle_mdssamplesignature(req, res) {
		try {
			const q = req.query
			if (!q.sample) throw '.sample missing'
			const gn = genomes[q.genome]
			if (!gn) throw 'invalid genome'
			const ds = gn.datasets[q.dslabel]
			if (!ds) throw 'invalid dataset'
			if (!ds.cohort) throw 'no cohort for dataset'
			if (!ds.cohort.mutation_signature) throw 'no mutation_signature for cohort'
			const lst: any[] = []
			for (const k in ds.cohort.mutation_signature.sets) {
				const s = ds.cohort.mutation_signature.sets[k]
				if (!s.samples) continue
				const v = s.samples.map.get(q.sample)
				if (!v) continue
				const l: any[] = []
				for (const x in s.signatures) {
					if (v[x]) {
						l.push({ k: x, v: v[x] })
					}
				}
				if (l.length) {
					lst.push({
						key: k,
						valuename: s.samples.valuename,
						annotation: l.sort((i, j) => j.v - i.v)
					})
				}
			}
			res.send({ lst: lst })
		} catch (err: any) {
			if (err.stack) console.error(err.stack)
			res.send({ error: err.message || err })
		}
	}
}
