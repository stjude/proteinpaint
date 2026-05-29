import { getDbConnection } from '#src/aiHistoDBConnection.ts'
import { runMultiStmtSQL, runSQL } from '#src/runSQLHelpers.ts'
import type { AIProjectUserRoles } from '#types'
import type Database from 'better-sqlite3'
import { authApi } from '#src/auth.js'

type JWTTokenPayload = {
	dslabel: string
	iat: number
	time: number
	ip: string
	embedder: string
	route: string
	exp: number
	clientAuthResult: { role: AIProjectUserRoles }
	email: string
	datasets: string[]
}

export function init({ genomes }) {
	return async (req, res): Promise<void> => {
		try {
			const query /*: AIProjectAdminRequest*/ = req.query // todo: enable type check
			if (!query.genome || !query.dslabel) {
				throw new Error('Genome and dataset label are required for aiProjectAdmin request.')
			}
			const g = genomes[query.genome]
			const ds = g.datasets[query.dslabel]

			if (!ds.queries?.WSImages?.db) throw new Error('WSImages database not found.')
			const jwtPayload = authApi.getPayloadFromHeaderAuth(req, '/**') as JWTTokenPayload
			const role: AIProjectUserRoles | undefined = jwtPayload?.clientAuthResult?.role
			if (!role) throw new Error('Unauthorized: No role found in request payload.')
			const connection = getDbConnection(ds) as Database.Database

			/** get list of projects from db */
			if (query.for === 'list') {
				const projects = getProjects(connection)
				res.send(projects)
			} else if (query.for === 'role') {
				res.status(200).send({
					status: 'ok',
					role
				})
			} else if (query.for === 'admin') {
				if (role !== 'admin') throw new Error('Unauthorized: Admin role required to perform this action.')
				/** update projects in db */
				/** If the url is too long, the method will be changed to POST
				 * in dofetch. Checking if project.type == 'new' ensures the project
				 * is added to the db.*/
				if (req.method === 'PUT' || query.project.type === 'new') addProject(connection, query.project)
				else if (req.method === 'POST') {
					editProject(connection, query.project)
				} else if (req.method === 'DELETE') deleteProject(connection, query.project.id)
				else throw new Error('Invalid request method for="admin" in aiProjectAdmin route.')

				let projectId = query.project.id

				if (!projectId) {
					const row = connection.prepare(`SELECT id FROM project WHERE name = ?`).get(query.project.name) as
						| { id: number }
						| undefined

					if (!row) {
						throw new Error(`Project not found: ${query.project.name}`)
					}

					projectId = row.id
				}

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
				data.selectedImages = await ds.queries?.WSImages?.selectWSIImages()
				res.status(200).send({
					status: 'ok',
					data
				})
			} else if (query.for === 'images') {
				const images = getImages(connection, query.project)
				const userEmail = jwtPayload?.email
				if (!userEmail) throw new Error('User email not found in request.')
				const users = getUsers(connection, query.project)
				if (!users.includes(userEmail)) throw new Error(`User not authorized for project ${query.project.name}`)
				const loginStatus = setUser(connection, query.project.id, userEmail)
				if (loginStatus !== 'ok') {
					res.send({ status: 'error', error: loginStatus })
					return
				}
				res.send({ images, status: 'ok' })
			} else if (query.for === 'logout') {
				setUser(connection, query.projectId, null)

				res.status(200).send({
					status: 'ok',
					message: 'User logged out successfully'
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

function getProjects(connection: Database.Database): Database.RunResult | any[] {
	const sql = 'SELECT name, id FROM project'
	return runSQL(connection, sql)
}

function getUsers(connection: Database.Database, project: any): string[] {
	const sql = 'SELECT email FROM project_users WHERE project_id = ?'
	const rows = connection.prepare(sql).all(project.id) as { email: string }[]
	return rows.map(r => r.email)
}

function setUser(connection: Database.Database, projectId: number, requestingUser: string | null): string | undefined {
	if (requestingUser === null) {
		connection.prepare('UPDATE project SET current_user = NULL WHERE id = ?').run(projectId)
		return 'Logged Out'
	}
	const currentUser = connection.prepare('SELECT current_user FROM project WHERE id = ?').get(projectId) as {
		current_user: string | null
	}
	if (currentUser?.current_user === requestingUser) {
		return 'ok'
	} else if (currentUser?.current_user === null) {
		connection.prepare('UPDATE project SET current_user = ? WHERE id = ?').run(requestingUser, projectId)
		return 'ok'
	} else if (currentUser.current_user !== requestingUser) {
		// TODO Need to find a way to get this error to frontend
		return `Project is assigned to a different user. Please contact the administrator if you believe this is an error.`
	}
}

export function getImages(connection: Database.Database, project: any): string[] {
	// Get project ID if not provided
	if (!project.id) {
		const res: any = connection.prepare(`SELECT id FROM project WHERE name = ?`).get(project.name)
		if (!res) throw new Error(`Project not found for name: ${project.name}`)
		project.id = res.id
	}

	// Query images
	const imageRows = connection
		.prepare(`SELECT image_path FROM project_images WHERE project_id = ? ORDER BY id ASC`)
		.all(project.id) as { image_path: string }[]

	return imageRows.map(r => r.image_path)
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
		{ sql: 'DELETE FROM project_flagged_annotations WHERE project_id = ?', params: [[projectId]] },
		{ sql: 'DELETE FROM project_annotations WHERE project_id = ?', params: [[projectId]] },
		{ sql: 'DELETE FROM project_flagged_predictions WHERE project_id = ?', params: [[projectId]] },
		{ sql: 'DELETE FROM project_classes WHERE project_id = ?', params: [[projectId]] },
		{ sql: 'DELETE FROM project_images WHERE project_id = ?', params: [[projectId]] },
		{ sql: 'DELETE FROM project_users WHERE project_id = ?', params: [[projectId]] },
		{ sql: 'DELETE FROM project WHERE id = ?', params: [[projectId]] }
	]
	runMultiStmtSQL(connection, stmts, 'delete')
}

function addProject(connection: Database.Database, project: any): void {
	const projectSql = `INSERT INTO project (name, filter)
                        VALUES (?, ?)`
	const projectParams = [project.name, JSON.stringify(project.filter)]
	const row = runSQL(connection, projectSql, projectParams, 'add') as Database.RunResult

	if (project.users) {
		const userSql = `INSERT INTO project_users (project_id, email)
                         VALUES (?, ?)`
		const userParams = project.users.map((email: string) => [row.lastInsertRowid, email])
		runMultiStmtSQL(connection, [{ sql: userSql, params: userParams }], 'add')
	}

	const classSql = `INSERT INTO project_classes (project_id, label, color, key_shortcut)
                      VALUES (?, ?, ?, ?)`
	const classParams = project.classes.map((c: any) => [row.lastInsertRowid, c.label, c.color, c.key_shortcut || ''])
	runMultiStmtSQL(connection, [{ sql: classSql, params: classParams }], 'add')
}
