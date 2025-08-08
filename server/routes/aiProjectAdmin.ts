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

			if (req.method === 'POST') editProject(db.connection, query)
			if (req.method === 'DELETE') deleteProject(db.connection, query)
			if (req.method === 'PUT') addProject(db.connection, query)

			res.status(200).send({
				status: 'ok',
				message: `Project ${query.project.name} processed successfully`
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

function editProject(connection: any, query: any) {
	console.log('Editing project:', connection, query.project)
	// const sql = `UPDATE project SET name = ? WHERE id= ?`
	// const params = [query.project.name, query.project.id]
	// try {
	// 	const rows = connection.prepare(sql).run(params)
	// 	return rows
	// } catch (e) {
	// 	console.error('Error fetching projects:', e)
	// 	throw new Error('Failed to fetch projects')
	// }
}

function deleteProject(connection: any, query: any) {
	// Deletes ** ALL ** project data
	runSQL(connection, 'DELETE FROM project_annotations WHERE project_id = ?', [query.project.id], 'delete')
	runSQL(connection, 'DELETE FROM project_classes WHERE project_id = ?', [query.project.id], 'delete')
	runSQL(connection, 'DELETE FROM project_images WHERE project_id = ?', [query.project.id], 'delete')
	runSQL(connection, 'DELETE FROM project_users WHERE project_id = ?', [query.project.id], 'delete')
	runSQL(connection, 'DELETE FROM project WHERE id = ?', [query.project.id], 'delete')
}

function addProject(connection: any, query: any) {
	//Add project record
	const projectSql = `INSERT INTO project (name, filter) VALUES (?, ?)`
	const projectParams = [query.project.name, JSON.stringify(query.project.filter)]
	const rows = runSQL(connection, projectSql, projectParams, 'add')

	//Add corresponding project classes
	const classSql = `INSERT INTO project_classes (project_id, name, color) VALUES (?, ?, ?)`
	const classParams = query.project.classes.map((c: any) => [rows.lastInsertRowid, c.label, c.color])
	for (const params of classParams) {
		runSQL(connection, classSql, params, 'add')
	}
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
