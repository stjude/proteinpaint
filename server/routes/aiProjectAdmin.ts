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
				const projects = getProjects(ds)
				res.send(projects)
			} else if (query.for === 'admin') {
				/** update projects in db */
				/** If the url is too long, the method will be changed to POST
				 * in dofetch. Checking if project.type == 'new' ensures the project
				 * is added to the db.*/
				if (req.method === 'PUT' || query.project.type === 'new') addProject(db.connection, query)
				else if (req.method === 'POST') editProject(db.connection, query)
				else if (req.method === 'DELETE') deleteProject(db.connection, query)

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

function getProjects(ds: any) {
	if (!ds.queries?.WSImages?.db) return
	const db = ds.queries.WSImages.db
	const sql = 'SELECT project.name as value, id FROM project'

	try {
		db.connection = connect_db(db.file, { readonly: false, fileMustExist: true })
		const rows = db.connection.prepare(sql).all()
		return rows
	} catch (e) {
		console.error('Error fetching projects:', e)
		throw new Error('Failed to fetch projects')
	}
}

function editProject(connection: any, query: any) {
	console.log('Editing project:', connection, query.project)
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
	//Add corresponding project images
	const imagesSql = `INSERT INTO project_images (project_id, image) VALUES (?, ?)`
	const imagesParams = query.project.images.map((img: any) => [rows.lastInsertRowid, img])
	for (const params of imagesParams) {
		runSQL(connection, imagesSql, params, 'add')
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
