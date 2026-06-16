import { getDbConnection } from '#src/aiHistoDBConnection.ts'
import { runMultiStmtSQL, runSQL } from '#src/runSQLHelpers.ts'
import type Database from 'better-sqlite3'
import { AIHalAuth } from './AIHalAuth.ts'
import type {
	RouteApi,
	AIProjectAdminRequest,
	AIProjectAdminForValues,
	AIProjectAdminProject,
	AIProjectAdminActions
} from '#types'
import { validGenomeDs, validString, validNumber, validStringArr } from '../routes/common.ts'
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
			const connection = getDbConnection(ds) as Database.Database
			const aiHalAuth = AIHalAuth
			if (!aiHalAuth) throw new Error('AIHalAuth queries not found in dataset.')
			const userEmail = req.query.__protected__.clientAuthResult?.email || ''
			/** get list of projects from db */
			if (query.for === 'list') {
				let projects = getProjects(connection) as { name: string; id: number; current_user: string | null }[]
				if (!aiHalAuth.checkAuthorization(req, 'listAllProjects')) {
					projects = projects.filter(p => aiHalAuth.getUsers(connection, p.id).includes(userEmail))
				}
				res.send(projects)
			} else if (query.for === 'admin') {
				/** update projects in db */
				/** If the url is too long, the method will be changed to POST
				 * in dofetch. Checking if project.type == 'new' ensures the project
				 * is added to the db.*/
				if (req.method === 'PUT' || (query.project.type === 'new' && aiHalAuth.checkAuthorization(req, 'addProject')))
					addProject(connection, query.project)
				else if (req.method === 'POST' && aiHalAuth.checkAuthorization(req, 'editProject')) {
					editProject(connection, query.project)
					aiHalAuth.setUser(connection, query.project.id, userEmail || 'admin')
				} else if (req.method === 'DELETE' && aiHalAuth.checkAuthorization(req, 'deleteProject'))
					deleteProject(connection, query.project.id)
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
				const parsedLogin = aiHalAuth.parseLogin(req, connection)
				if (parsedLogin.status === 'error') throw new Error('Authentication failed: ' + parsedLogin.error)
				const q = ds.cohort.termdb.q
				const data = await q.getFilteredImages(query.project.filter)
				data.selectedImages = await ds.queries?.WSImages?.selectWSIImages()
				res.status(200).send({
					status: 'ok',
					data
				})
			} else if (query.for === 'images') {
				const parsedLogin = aiHalAuth.parseLogin(req, connection)
				if (parsedLogin.status === 'error') throw new Error('Authentication failed: ' + parsedLogin.error)
				const images = getImages(connection, query.project)
				res.send({ images, status: 'ok' })
			} else if (query.for === 'logout') {
				aiHalAuth.setUser(connection, query.project.id, null)

				res.status(200).send({
					status: 'ok',
					message: 'User logged out successfully'
				})
			} else if (query.for === 'auth') {
				const authorizations: { [key in AIProjectAdminActions]?: boolean } = {}
				const actions: AIProjectAdminActions[] = query.auth || []
				for (const action of actions) {
					authorizations[action] = aiHalAuth.checkAuthorization(req, action)
				}
				res.status(200).send(authorizations)
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
	const sql = 'SELECT name, id, current_user FROM project'
	return runSQL(connection, sql)
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

export const api: RouteApi = {
	endpoint: 'aiProjectAdmin',
	methods: {
		get: {
			// read-only requests
			init,
			// TODO: the init, request/response typeId and checker should all be specific to the get method
			request: {
				typeId: 'AIProjectAdminRequest',
				checker: validAIProjectAdminRequest
			},
			response: { typeId: 'AIProjectAdminResponse' }
		},
		post: {
			//'admin' -> edit
			init,
			// TODO: the init, request/response typeId and checker should all be specific to the post method
			request: {
				typeId: 'AIProjectAdminRequest',
				checker: validAIProjectAdminRequest
			},
			response: { typeId: 'AIProjectAdminResponse' }
		},
		put: {
			//'admin' -> add
			init,
			// TODO: the init, request/response typeId and checker should all be specific to the put method
			request: {
				typeId: 'AIProjectAdminRequest',
				checker: validAIProjectAdminRequest
			},
			response: { typeId: 'AIProjectAdminResponse' }
		},
		delete: {
			//'admin' -> delete
			init,
			// TODO: the init, request/response typeId and checker should all be specific to the delete method
			request: {
				typeId: 'AIProjectAdminRequest',
				checker: validAIProjectAdminRequest
			},
			response: { typeId: 'AIProjectAdminResponse' }
		}
	}
}

//
export function validAIProjectAdminRequest(input): AIProjectAdminRequest {
	return {
		...validGenomeDs(input),
		for: validAIProjectFor(input.for),
		/** required for 'project' and 'selection' requests */
		/* TODO: create separate init functions for each route method, so project will be either optional or required */
		project: !input.project ? undefined : getValidAIAdminProject(input.project)
	}
}

const allowedAIProjectForStrings: Set<AIProjectAdminForValues> = new Set([
	'list',
	'admin',
	'filterImages',
	'images',
	'logout',
	'auth'
])

function validAIProjectFor(val) {
	if (!allowedAIProjectForStrings.has(val)) throw `invalid aiProjectAdminPayload request payload.for='${val}'`
	return val
}

function getValidAIAdminProject(input): AIProjectAdminProject {
	const id = input?.id == null ? undefined : validNumber(input.id, 'invalid ai project.id')
	// TODO fixed validation for delete requests, which only require id.
	//  Separate init functions for each route method to allow for different required fields
	// If payload contains only id (delete), return minimal valid shape
	if (input && Object.keys(input).length === 1 && 'id' in input) {
		return {
			id,
			// `name` is required by the type; use empty string as a safe placeholder for delete
			name: '',
			filter: undefined,
			classes: undefined,
			images: undefined,
			type: undefined,
			users: undefined
		}
	}

	const filter = typeof input?.filter === 'string' && input.filter !== '' ? input.filter : undefined
	const images =
		input?.images == null
			? undefined
			: validStringArr(input.images, `AIProjectAdminRequest must be an array of strings`)
	const users =
		input?.users == null || (Array.isArray(input.users) && input.users.length === 0)
			? undefined
			: validStringArr(input.users, 'invalid ai project.users')

	return {
		name: validString(input.name),
		id,
		filter,
		classes: input.classes as any, // TODO: convert to a validator function call
		images,
		type: input?.type == null ? undefined : validString(input.type, 'invalid ai project.type'),
		users
	}
}
