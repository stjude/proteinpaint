import type { RouteApi } from '#types'
import { aiProjectAdminPayload } from '#types/checkers'
import { connect_db } from '../src/utils.js'

const routePath = 'aiProjectAdmin'
export const api: RouteApi = {
	endpoint: `${routePath}`,
	methods: {
		get: {
			//all requests
			...aiProjectAdminPayload,
			init
		},
		post: {
			//'admin' -> edit
			...aiProjectAdminPayload,
			init
		},
		delete: {
			//'admin' -> delete
			...aiProjectAdminPayload,
			init
		},
		put: {
			//'admin' -> add
			...aiProjectAdminPayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		try {
			const query = req.query
			if (!query.genome || !query.dslabel) {
				throw new Error('Genome and dataset label are required for aiProjectAdmin request.')
			}
			const g = genomes[query.genome]
			const ds = g.datasets[query.dslabel]

			if (!ds.queries?.WSImages?.db) throw new Error('WSImages database not found.')
			const db = ds.queries.WSImages.db

			db.connection = connect_db(db.file, { readonly: false, fileMustExist: true })

			/** get list of projects from db */
			if (query.for === 'list') {
				const projects = getProjects(db.connection)
				res.send(projects)
			} else if (query.for === 'admin') {
				/** update projects in db */
				/** If the url is too long, the method will be changed to POST
				 * in dofetch. Checking if project.type == 'new' ensures the project
				 * is added to the db.*/
				if (req.method === 'PUT' || query.project.type === 'new') addProject(db.connection, query.project)
				else if (req.method === 'POST') editProject(db.connection, query.project)
				else if (req.method === 'DELETE') deleteProject(db.connection, query.project.id)
				else throw new Error('Invalid request method for="admin" in aiProjectAdmin route.')

				res.status(200).send({
					status: 'ok',
					message: `Project ${query.project.name} processed successfully`
				})
			} else if (query.for === 'images') {
				/** get selections (i.e. slides) matching the project
				 * from the ad hoc dictionary. */
				const q = ds.cohort.termdb.q
				const data = await q.getFilteredImages(query.project.filter)
				/** TODO: Should send list of images to API */
				res.status(200).send({
					status: 'ok',
					data
				})
			} else {
				res.send({
					status: 'error',
					message: 'Invalid request'
				})
			}
		} catch (e: any) {
			console.warn(e)
			res.status(500).send({
				status: 'error',
				error: e.message || e
			})
		}
	}
}

function getProjects(connection: any) {
	const sql = 'SELECT project.name as value, id FROM project'
	return runSQL(connection, sql)
}

function editProject(connection: any, project: any) {
	const stmts: { sql: string; params: any[] }[] = []
	if (!project.id) {
		const res = connection.prepare(`SELECT id FROM project WHERE name = ?`).get(project.name)
		project.id = res.id
	}

	if (project.images) {
		stmts.push({
			sql: `DELETE FROM project_images WHERE project_id = ? AND image NOT IN (${
				project.images.map(() => '?').join(',') || "''"
			})`,
			params: [[project.id, ...project.images]]
		})
		const existingImg = connection.prepare(`SELECT 1 FROM project_images WHERE project_id = ? AND image = ?`)

		const multiParams: any[] = []
		for (const img of project.images) {
			const exists = existingImg.get(project.id, img)
			if (!exists) multiParams.push([project.id, img])
		}
		if (multiParams.length > 0) {
			const insertImg = `INSERT INTO project_images (project_id, image) VALUES (?, ?)`
			stmts.push({ sql: insertImg, params: multiParams })
		}
	}
	if (project.filter) {
		stmts.push({
			sql: `UPDATE project SET filter = ? WHERE id = ?`,
			params: [[JSON.stringify(project.filter), project.id]]
		})
	}
	if (project.classes) {
		stmts.push({
			sql: `DELETE FROM project_classes WHERE project_id = ? AND name NOT IN (${
				project.classes.map(() => '?').join(',') || "''"
			})`,
			params: [project.id, ...project.classes.map(c => c.name)]
		})
		const existingClasses = connection.prepare(`SELECT 1 FROM project_classes WHERE project_id = ? AND name = ?`)

		const multiParams: any = []
		for (const cls of project.classes) {
			const exists = existingClasses.get(project.id, cls.name)
			if (!exists) multiParams.push([project.id, cls.name, cls.color])
		}
		if (multiParams.length > 0) {
			const insertClass = `INSERT INTO project_classes (project_id, name, color) VALUES (?, ?, ?)`
			stmts.push({ sql: insertClass, params: multiParams })
		}
	}
	runMultiStmtSQL(connection, stmts, 'add')
}

function deleteProject(connection: any, projectId: number) {
	if (!projectId) throw new Error('Invalid project ID [aiProjectAdmin route deleteProject()]')
	// Deletes ** ALL ** project data
	const stmts = [
		{ sql: 'DELETE FROM project_annotations WHERE project_id = ?', params: [[projectId]] },
		{ sql: 'DELETE FROM project_classes WHERE project_id = ?', params: [[projectId]] },
		{ sql: 'DELETE FROM project_images WHERE project_id = ?', params: [[projectId]] },
		{ sql: 'DELETE FROM project_users WHERE project_id = ?', params: [[projectId]] },
		{ sql: 'DELETE FROM project WHERE id = ?', params: [[projectId]] }
	]
	runMultiStmtSQL(connection, stmts, 'delete')
}

function addProject(connection: any, project: any) {
	//Add project record
	const projectSql = `INSERT INTO project (name, filter) VALUES (?, ?)`
	const projectParams = [project.name, JSON.stringify(project.filter)]
	const rows = runSQL(connection, projectSql, projectParams, 'add')

	//Add corresponding project classes
	const classSql = `INSERT INTO project_classes (project_id, name, color) VALUES (?, ?, ?)`
	const classParams = project.classes.map((c: any) => [rows.lastInsertRowid, c.label, c.color])
	for (const params of classParams) {
		runSQL(connection, classSql, params, 'add')
	}
}

/** Run only one SQL statement at a time */
function runSQL(connection: any, sql: string, params: any[] = [], errorText = 'fetch') {
	try {
		if (!params.length) {
			return connection.prepare(sql).all()
		}
		return connection.prepare(sql).run(params)
	} catch (e: any) {
		console.error(`Error executing SQL for ${errorText}: ${e.message || e}`)
		throw new Error(`Failed to ${errorText} projects`)
	}
}

/** Run multiple SQL statements in a transaction
 * More performant than running .prepare().run() each time */
function runMultiStmtSQL(connection: any, stmts: { sql: string; params: any[] }[], errorText = 'execute') {
	const transaction = connection.transaction((batch: typeof stmts) => {
		for (const { sql, params = [] } of batch) {
			//Reuse the same prepared statement for memory efficiency
			const sqlStmt = connection.prepare(sql)
			for (const item of params) {
				sqlStmt.run(item)
			}
		}
	})

	try {
		transaction(stmts)
	} catch (e: any) {
		console.error(`Error executing transaction for ${errorText}: ${e.message || e}`)
		throw new Error(`Failed to ${errorText} projects`)
	}
}
