import type { RouteApi } from '#types'
import { aiHistoProjectAdminPayload } from '#types/checkers'
import { connect_db } from '../src/utils.js'

const routePath = 'aiHistoProjectAdmin'
export const api: RouteApi = {
	endpoint: `${routePath}`,
	methods: {
		post: {
			//edit
			...aiHistoProjectAdminPayload,
			init
		},
		delete: {
			//delete
			...aiHistoProjectAdminPayload,
			init
		},
		put: {
			//add
			...aiHistoProjectAdminPayload,
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

			if (!ds.queries?.WSImages?.db) return
			const db = ds.queries.WSImages.db

			db.connection = connect_db(db.file, { readonly: false, fileMustExist: true })

			if (req.method === 'POST') editProject()
			if (req.method === 'DELETE') deleteProject()
			if (req.method === 'PUT') addProject(db.connection, query)

			res.status(200).send({
				status: 'ok',
				message: `Project ${query.projectName} processed successfully`
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

function editProject() {
	// try {
	// 	const rows = connection.prepare(sql).run(params)
	// 	return rows
	// } catch (e) {
	// 	console.error('Error fetching projects:', e)
	// 	throw new Error('Failed to fetch projects')
	// }
}

function deleteProject() {
	// try {
	// 	const rows = connection.prepare(sql).run(params)
	// 	return rows
	// } catch (e) {
	// 	console.error('Error fetching projects:', e)
	// 	throw new Error('Failed to fetch projects')
	// }
}

function addProject(connection: any, query: any) {
	const sql = `INSERT INTO Project (name) VALUES (?)`
	const params = [query.projectName]

	try {
		const rows = connection.prepare(sql).run(params)
		return rows
	} catch (e) {
		console.error('Error fetching projects:', e)
		throw new Error('Failed to fetch projects')
	}
}
