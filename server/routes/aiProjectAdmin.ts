import type { RouteApi } from '#types'
import { aiProjectAdminPayload } from '#types/checkers'
import { connect_db } from '../src/utils.js'

const routePath = 'aiProjectAdmin'
export const api: RouteApi = {
	endpoint: `${routePath}`,
	methods: {
		post: {
			//edit
			...aiProjectAdminPayload,
			init
		},
		delete: {
			//delete
			...aiProjectAdminPayload,
			init
		},
		put: {
			//add
			...aiProjectAdminPayload,
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
			if (req.method === 'DELETE') deleteProject(db.connection, query)
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
	console.log(58, 'called editProject')
	// try {
	// 	const rows = connection.prepare(sql).run(params)
	// 	return rows
	// } catch (e) {
	// 	console.error('Error fetching projects:', e)
	// 	throw new Error('Failed to fetch projects')
	// }
}

function deleteProject(connection: any, query: any) {
	const sql = `DELETE FROM Project WHERE id= ?`
	const params = [query.project.id]

	runSQL(connection, sql, params, 'delete')
}

function addProject(connection: any, query: any) {
	const sql = `INSERT INTO Project (name) VALUES (?)`
	const params = [query.project.name]

	runSQL(connection, sql, params, 'add')
}

function runSQL(connection: any, sql: string, params: any[] = [], errorText = 'fetch') {
	try {
		const rows = connection.prepare(sql).run(params)
		return rows
	} catch (e) {
		console.error(`Error executing SQL for ${errorText}:`, e)
		throw new Error(`Failed to ${errorText} projects`)
	}
}
