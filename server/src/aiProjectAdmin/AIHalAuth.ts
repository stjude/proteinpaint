import type { AIProjectAdminActions, AIProjectAdminRequest, AIProjectAuthInfo } from '#types'
import { authApi } from '#src/auth.ts'
import type Database from 'better-sqlite3'

export const AIHalAuth = {
	checkAuthorization(req: any, action: AIProjectAdminActions, currentUser: string | null = null): boolean {
		//returns true if you are authorized to perform the action
		const clientAuthResult = req.query.__protected__.clientAuthResult as AIProjectAuthInfo
		const authFound: boolean = this.isAuthRequired(req)
		const { email = '', role = '' } = clientAuthResult || {}
		switch (action) {
			case 'required':
				return authFound
			case 'logOut':
				return authFound && role === 'admin'
			case 'addProject':
			case 'editProject':
			case 'deleteProject':
				return !authFound || (role === 'admin' && email !== '')
			case 'listAllProjects':
				return !authFound || role === 'admin'
			case 'annotate':
				return (email !== '' && currentUser === email && ['admin', 'annotator'].includes(role)) || !authFound
			default:
				return false
		}
	},
	isAuthRequired(req: any): boolean {
		return authApi.getRequiredCredForDsEmbedder(req.query.dslabel, req.query.embedder) !== undefined
	},
	SessionHourTimeout: 12,
	getLoginTimeOut(lastLogin: string, hourLimit: number): boolean {
		const millisecondsInHour = 1000 * 60 * 60
		const lastLoginDate = new Date(lastLogin)
		const currentDate = new Date()
		return (currentDate.getTime() - lastLoginDate.getTime()) / millisecondsInHour > hourLimit
	},
	parseLogin(req: any, connection: Database.Database): { status: 'ok' } | { status: 'error'; error: string } {
		const authFound: boolean = this.isAuthRequired(req)
		if (!authFound) return { status: 'ok' }
		const clientAuthResult = req.query.__protected__.clientAuthResult as AIProjectAuthInfo
		const query = req.query as AIProjectAdminRequest
		const { email = undefined, role = undefined } = clientAuthResult || {}
		if (!email || !role) return { status: 'error', error: 'Invalid login' }
		if (!query.project) return { status: 'error', error: 'Project information missing in request.' }
		if (query.project.id) {
			const users = this.getUsers(connection, query.project.id)
			if (!users.includes(email) && role !== 'admin')
				return { status: 'error', error: `User not authorized for project ${query.project.name ?? ''}` }
			const loginStatus = this.setUser(connection, query.project.id, email)
			if (loginStatus !== 'ok') {
				return { status: 'error', error: loginStatus }
			}
		}

		return { status: 'ok' }
	},
	getUsers(connection: Database.Database, projectID: number): string[] {
		const sql = 'SELECT email FROM project_users WHERE project_id = ?'
		const rows = connection.prepare(sql).all(projectID) as { email: string }[]
		return rows.map(r => r.email)
	},
	setUser(connection: Database.Database, projectId: number, requestingUser: string | null): string {
		const { last_login } = connection.prepare('SELECT last_login FROM project WHERE id = ?').get(projectId) as {
			last_login: string | null
		}
		if (
			requestingUser === null ||
			(last_login && this.getLoginTimeOut(last_login || new Date().toISOString(), this.SessionHourTimeout))
		) {
			connection.prepare('UPDATE project SET current_user = NULL, last_login = NULL WHERE id = ?').run(projectId)
			if (requestingUser === null) return 'Logged Out'
		}
		const currentUser = connection.prepare('SELECT current_user FROM project WHERE id = ?').get(projectId) as {
			current_user: string | null
		}
		if (currentUser?.current_user === requestingUser) {
			connection.prepare('UPDATE project SET last_login = ? WHERE id = ?').run(new Date().toISOString(), projectId)
			return 'ok'
		} else if (currentUser?.current_user === null) {
			connection
				.prepare('UPDATE project SET current_user = ?, last_login = ? WHERE id = ?')
				.run(requestingUser, new Date().toISOString(), projectId)
			return 'ok'
		} else if (currentUser.current_user !== requestingUser) {
			return `Project is assigned to a different user. Please contact the administrator if you believe this is an error.`
		}
		return `Could not set user for project ${projectId} due to an unknown error.`
	}
}
