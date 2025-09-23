import type { RouteApi, AIProjectTrainModelRequest } from '#types'
import { aiProjectTrainModelPayload } from '#types/checkers'

export const api: RouteApi = {
	endpoint: 'aiProjectTrainModel',
	methods: {
		get: {
			...aiProjectTrainModelPayload,
			init
		},
		post: {
			...aiProjectTrainModelPayload,
			init
		}
	}
}

function init({ genomes }) {
	return async function (req, res) {
		try {
			const query: AIProjectTrainModelRequest = req.query
			console.log(query)
			const g = genomes[query.genome]
			if (!g) throw 'invalid genome name'
			const ds = g.datasets[query.dslabel]
			if (!ds) throw 'invalid dataset name'

			if (typeof ds.queries.WSImages.retrainModel == 'function') {
				await ds.queries.WSImages.retrainModel(query.projectId)
			} else {
				res.status(500).send({
					status: 'error',
					error: 'No retraining script defined'
				})
			}

			res.status(200).send({
				status: 'ok',
				message: `Retraining model completed`
			})
		} catch (e: any) {
			console.warn(e)
			res.status(500).send({
				status: 'error',
				error: e.message || e
			})
		}
	}
}
