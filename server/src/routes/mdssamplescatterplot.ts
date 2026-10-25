import type { RouteApi, RoutePayload } from '#types'
import { genomes } from '#src/initGenomesDs.js'
import { hasMdsDataset } from '#src/mds.shared.js'

/*
The route of the sample scatterplot of a legacy mds dataset.
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
	endpoint: 'mdssamplescatterplot',
	methods: {
		get: payload
	}
}

function init({ genomes }) {
	return async function handle_mdssamplescatterplot(req, res) {
		try {
			const gn = genomes[req.query.genome]
			if (!gn) throw 'invalid genome'
			const ds = gn.datasets[req.query.dslabel]
			if (!ds) throw 'invalid dataset'
			if (!ds.cohort) throw 'no cohort for dataset'
			if (!ds.cohort.annotation) throw 'cohort.annotation missing for dataset'
			const sp = ds.cohort.scatterplot
			if (!sp) throw 'scatterplot not supported for this dataset'

			const dots: any[] = []
			for (const sample in ds.cohort.annotation) {
				const anno = ds.cohort.annotation[sample]
				if (req.query.subsetkey) {
					if (anno[req.query.subsetkey] != req.query.subsetvalue) continue
				}
				const x = anno[sp.x.attribute]
				if (!Number.isFinite(x)) continue
				const y = anno[sp.y.attribute]
				if (!Number.isFinite(y)) continue
				dots.push({
					sample,
					x,
					y,
					s: anno
				})
			}
			res.send({
				colorbyattributes: sp.colorbyattributes, // optional
				colorbygeneexpression: sp.colorbygeneexpression, // optional
				querykey: sp.querykey,
				dots: dots,
				// optional, quick fix for showing additional tracks when launching single sample view by clicking a dot
				tracks: sp.tracks
			})
		} catch (e: any) {
			if (e.stack) console.error(e.stack)
			res.send({ error: e.message || e })
		}
	}
}
