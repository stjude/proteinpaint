import type { ProjectReposity } from '../repo/ProjectReposity'
import type { AIProjectAdminResponse, AIProjectUserRoles } from '#types'
import { buildAnnotationsCsv } from '#plots/wsiviewer/interactions/annotationsCsv.ts'
import type Settings from '../Settings'
import { dofetch3, clearServerDataCache } from '#common/dofetch'
import { LogoutRenderer } from '../view/LogoutRenderer'
import { sayerror } from '#dom'

export class AIProjectAdminInteractions {
	app: any
	id: string
	genome: string
	dslabel: string
	prjtRepo: ProjectReposity

	constructor(app: any, id: string, prjtRepo: ProjectReposity) {
		this.app = app
		this.id = id
		this.genome = app.vocabApi.vocab.genome
		this.dslabel = app.vocabApi.vocab.dslabel
		this.prjtRepo = prjtRepo
	}

	async getRole(): Promise<AIProjectUserRoles | ''> {
		// TODO make a user type
		let role: AIProjectUserRoles | '' = ''
		try {
			const response = await dofetch3('aiProjectAdmin', {
				body: {
					genome: this.genome,
					dslabel: this.dslabel,
					for: 'role'
				}
			})
			role = response.role
		} catch (e: any) {
			console.error('Error getting role:', e.message || e)
			throw e
		}
		return role
	}

	async addProject(opts: { project: any }): Promise<void> {
		const config = this.getConfig()
		const settings: Settings = config.settings || {}
		const projectObject = Object.assign({}, settings.project, opts.project)

		const body = {
			genome: this.genome,
			dslabel: this.dslabel,
			project: projectObject
		}
		try {
			await this.prjtRepo.updateProject(body, 'PUT')
		} catch (e: any) {
			console.error('Error adding project:', e.message || e)
			throw e
		}
	}

	async editProject(opts: { project: any }): Promise<void> {
		const config = this.getConfig()
		const settings: Settings = config.settings || {}
		const project = Object.assign(
			{},
			settings.project,
			{
				type: 'edit'
			},
			opts.project
		)

		const body = {
			genome: this.genome,
			dslabel: this.dslabel,
			project
		}
		try {
			const res = (await this.prjtRepo.updateProject(body, 'POST')) as any
			if (!project.id) project.id = res.projectId
		} catch (e: any) {
			console.error('Error editing project:', e.message || e)
			throw e
		}
		await this.appDispatchEdit({ project }, config)
	}

	async deleteProject(project: { value: string; id: number }): Promise<boolean> {
		let success = false
		const body = {
			genome: this.genome,
			dslabel: this.dslabel,
			project: {
				name: project.value,
				id: project.id
			}
		}

		try {
			const response = await this.prjtRepo.updateProject(body, 'DELETE')
			if (response && response.status === 'ok') {
				success = true
			}
		} catch (e: any) {
			console.error('Error deleting project:', e.message || e)
			throw e
		}
		return success
	}

	async getFilteredImages(filter: any): Promise<AIProjectAdminResponse> {
		const config = this.getConfig()
		const settings: Settings = config.settings || {}
		return await this.app.vocabApi.getFilteredAiImages(settings.project, filter)
	}

	async launchViewer(holder: any, _images?: string[]): Promise<void> {
		const config = this.getConfig()
		const settings: Settings = config.settings
		if (!settings.project || !settings.project.id) throw new Error('Project is required to launch viewer')
		let images: string[] = []
		if (_images && _images.length > 0) {
			images = _images
		} else {
			const response: AIProjectAdminResponse = await this.prjtRepo.getImagePaths(
				this.genome,
				this.dslabel,
				settings.project
			)
			if (response.status !== 'ok') {
				await this.appDispatchEdit({ project: { name: '', type: 'logout' } }, config)

				sayerror(holder, response.error || 'Error fetching images')
				return
			}
			holder.selectAll('.sjpp-deletable-ai-prjt-admin-div').remove()
			images = response.images
		}
		const wsiViewer = await import('#plots/wsiviewer/plot.wsi.js')
		const genome = this.genome
		const dslabel = this.dslabel
		const logoutRenderer = new LogoutRenderer(this)
		logoutRenderer.render(holder, genome, dslabel)
		wsiViewer.default(this.dslabel, holder, { name: this.genome }, null, settings.project.id, images, true)
	}

	public async appDispatchEdit(settings: Settings, config: any = {}): Promise<void> {
		if (!config?.settings) {
			config = this.getConfig()
			if (!config) throw new Error(`No plot with id='${this.id}' found.`)
		}
		const configSettings: Settings = config.settings

		await this.app.dispatch({
			type: 'plot_edit',
			id: this.id,
			config: { settings: Object.assign({}, configSettings, settings) }
		})
	}

	private getConfig(): any {
		return this.app.getState().plots.find((p: any) => p.id === this.id)
	}

	public async exportAnnotations(projectId: number): Promise<void> {
		const config = this.getConfig()
		if (!config || !config.settings) throw new Error(`No plot with id='${this.id}' found.`)
		const settings: Settings = config.settings || {}
		// fetch annotations for the entire project (server endpoint will expand ['all'] to all images)
		let annotations: any[] = []
		try {
			annotations = await this.prjtRepo.getAnnotations(this.genome, this.dslabel, projectId)
		} catch (e: any) {
			console.error('Error fetching annotations for export:', e?.message || e)
			throw e
		}

		// Always produce CSV
		const mime = 'text/csv;charset=utf-8;'
		let content: string

		if (!Array.isArray(annotations) || annotations.length === 0) {
			content = ''
		} else {
			// use shared CSV builder; let it pick per-annotation filename (a.filename || a.image)
			content = buildAnnotationsCsv(annotations as any[])
		}

		// build a safe filename for download: prefer project name, fallback to projectId
		const rawName = settings.project && settings.project.name ? String(settings.project.name) : `project-${projectId}`
		const safeName = rawName.replace(/[^a-z0-9_.-]/gi, '_').slice(0, 200)
		const filename = `${safeName}-annotations.csv`

		try {
			const blob = new Blob([content], { type: mime })
			const url = URL.createObjectURL(blob)
			const a = document.createElement('a')
			a.href = url
			a.download = filename
			document.body.appendChild(a)
			a.click()
			a.remove()
			setTimeout(() => URL.revokeObjectURL(url), 1000)
		} catch (e: any) {
			console.error('Error creating annotation download:', e?.message || e)
			throw e
		}
	}

	async onLogOut(genome: string, dslabel: string): Promise<void> {
		try {
			await dofetch3('aiProjectAdmin', {
				body: {
					genome,
					dslabel,
					for: 'logout'
				}
			})
			clearServerDataCache()
			await this.appDispatchEdit({ project: { name: 'Log', type: 'logout' } })
		} catch (e: any) {
			console.error('Error logging out: ' + (e.message || e))
			throw e
		}
	}
}
