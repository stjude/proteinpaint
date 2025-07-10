import type { RouteApi } from '#types'
import { aiHistoProjectAdminPayload } from '#types/checkers'
// import { connect_db } from '../src/utils.js'

const routePath = 'aiHistoProjectAdmin'
export const api: RouteApi = {
	endpoint: `${routePath}`,
	methods: {
		post: {
			...aiHistoProjectAdminPayload,
			init
		},
		delete: {
			...aiHistoProjectAdminPayload,
			init
		},
		put: {
			...aiHistoProjectAdminPayload,
			init
		}
	}
}

function init() {
	return async (req, res): Promise<void> => {
		try {
			console.log('AIHistoProjectAdmin init', req)
			// const query = req.query
			// const g = genomes[query.genome]
			// const ds = g.datasets[query.dslabel]

			// res.send(projects)
		} catch (e: any) {
			console.warn(e)
			res.status(500).send({
				status: 'error',
				error: e.message || e
			})
		}
	}
}
