import type { RouteApi } from '#types'
import { aiHistoListPayload } from '#types/checkers'
import { connect_db } from '../src/utils.js'

const routePath = 'aiHistoList'
export const api: RouteApi = {
	endpoint: `${routePath}`,
	methods: {
		get: {
			...aiHistoListPayload,
			init
		},
		post: {
			...aiHistoListPayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		try {
			const query = req.query
			const g = genomes[query.genome]
			const ds = g.datasets[query.dslabel]

			const projects = getProjects(ds)

			res.send(projects)
		} catch (e: any) {
			console.warn(e)
			res.status(500).send({
				status: 'error',
				error: e.message || e
			})
		}
	}
}

function getProjects(ds: any) {
	if (!ds.queries?.WSImages?.db) return
	const db = ds.queries.WSImages.db
	const sql = 'SELECT project.name as value FROM Project'

	try {
		db.connection = connect_db(db.file, { readonly: false, fileMustExist: true })
		const rows = db.connection.prepare(sql).all()
		return rows
	} catch (e) {
		console.error('Error fetching projects:', e)
		throw new Error('Failed to fetch projects')
	}
}
