import type { RouteApi } from '#types'
import { aiProjectAdminPayload } from '#types/checkers'
import { getDbConnection } from '#src/aiHistoDBConnection.js'
import { runSQL, runMultiStmtSQL } from '#src/runSQLHelpers.ts'
import type Database from 'better-sqlite3'

export const api: RouteApi = {
	endpoint: 'aiProjectAdmin',
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

			const connection = getDbConnection(ds) as Database.Database

			/** get list of projects from db */
			if (query.for === 'list') {
				const projects = getProjects(connection)
				res.send(projects)
			} else if (query.for === 'admin') {
				/** update projects in db */
				/** If the url is too long, the method will be changed to POST
				 * in dofetch. Checking if project.type == 'new' ensures the project
				 * is added to the db.*/
				if (req.method === 'PUT' || query.project.type === 'new') addProject(connection, query.project)
				else if (req.method === 'POST') editProject(connection, query.project)
				else if (req.method === 'DELETE') deleteProject(connection, query.project.id)
				else throw new Error('Invalid request method for="admin" in aiProjectAdmin route.')

				const projectId =
					query.project.id || connection.prepare(`SELECT id FROM project WHERE name = ?`).get(query.project.name)

				res.status(200).send({
					status: 'ok',
					projectId,
					message: `Project ${query.project.name} processed successfully`
				})
			} else if (query.for === 'filterImages') {
				/** get selections (i.e. slides) matching the project
				 * from the ad hoc dictionary. */
				const q = ds.cohort.termdb.q
				const data = await q.getFilteredImages(query.project.filter)
				/** TODO: Should send list of images to API */
				res.status(200).send({
					status: 'ok',
					data
				})
			} else if (query.for === 'images') {
				const images: Database.RunResult | any[] = getImages(connection, query.project)
				if (Array.isArray(images)) {
					res.send(images.map(row => row.image_path))
				} else {
					throw new Error('Images are not in expected format')
				}
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

function getProjects(connection: Database.Database): Database.RunResult | any[] {
	const sql = 'SELECT name, id FROM project'
	return runSQL(connection, sql)
}

function getImages(connection: Database.Database, project: any): Database.RunResult | any[] {
	if (!project.id) {
		const res: any = connection.prepare(`SELECT id FROM project WHERE name = ?`).get(project.name)
		project.id = res.id
	}

	const sql = `SELECT image_path FROM project_images WHERE project_id = ${project.id}`
	return runSQL(connection, sql)
}

function editProject(connection: Database.Database, project: any): void {
	const stmts: { sql: string; params: any[] }[] = []
	if (!project.id) {
		const res: any = connection.prepare(`SELECT id FROM project WHERE name = ?`).get(project.name)
		project.id = res.id
	}

	if (project.images) {
		stmts.push({
			sql: `DELETE FROM project_images WHERE project_id = ? AND image_path NOT IN (${
				project.images.map(() => '?').join(',') || "''"
			})`,
			params: [[project.id, ...project.images]]
		})
		const existingImg = connection.prepare(`SELECT 1 FROM project_images WHERE project_id = ? AND image_path = ?`)
		const multiParams: any[] = []
		for (const img of project.images) {
			const exists = existingImg.get(project.id, img)
			if (!exists) multiParams.push([project.id, img])
		}
		if (multiParams.length > 0) {
			const insertImg = `INSERT INTO project_images (project_id, image_path) VALUES (?, ?)`
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
			if (!exists) multiParams.push([project.id, cls.name, cls.color, cls.key_shortcut || ''])
		}
		if (multiParams.length > 0) {
			const insertClass = `INSERT INTO project_classes (project_id, name, color, key_shortcut) VALUES (?, ?, ?, ?)`
			stmts.push({ sql: insertClass, params: multiParams })
		}
	}
	runMultiStmtSQL(connection, stmts, 'add')
}

function deleteProject(connection: Database.Database, projectId: number): void {
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

function addProject(connection: Database.Database, project: any): void {
	//Add project record
	const projectSql = `INSERT INTO project (name, filter) VALUES (?, ?)`
	const projectParams = [project.name, JSON.stringify(project.filter)]
	const row = runSQL(connection, projectSql, projectParams, 'add') as Database.RunResult

	const userSql = `INSERT INTO project_users (project_id, email) VALUES (?, ?)`
	const userParams = [row.lastInsertRowid, 'user@domain.com'] as string[]
	runSQL(connection, userSql, userParams, 'add')

	//Add corresponding project classes
	const classSql = `INSERT INTO project_classes (project_id, label, color, key_shortcut) VALUES (?, ?, ?, ?)`
	const classParams = project.classes.map((c: any) => [row.lastInsertRowid, c.label, c.color, c.key_shortcut || ''])
	runMultiStmtSQL(connection, [{ sql: classSql, params: classParams }], 'add')
}
