import type { ProjectReposity } from '../repo/ProjectReposity'
import type { AIProjectAdminResponse } from '#types'
import { buildAnnotationsCsv } from '#plots/wsiviewer/interactions/annotationsCsv.ts'

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

	async addProject(opts: { project: any }): Promise<void> {
		const config = this.getConfig()
		const projectObject = Object.assign({}, config.settings.project, opts.project)

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
		const project = Object.assign(
			{},
			config.settings.project,
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
		await this.appDispatchEdit({ settings: { project } }, config)
	}

	async deleteProject(project: { value: string; id: number }): Promise<void> {
		const body = {
			genome: this.genome,
			dslabel: this.dslabel,
			project: {
				name: project.value,
				id: project.id
			}
		}

		try {
			await this.prjtRepo.updateProject(body, 'DELETE')
		} catch (e: any) {
			console.error('Error deleting project:', e.message || e)
			throw e
		}
	}

	async getFilteredImages(filter: any): Promise<AIProjectAdminResponse> {
		const config = this.getConfig()
		return await this.app.vocabApi.getFilteredAiImages(config.settings.project, filter)
	}

	async launchViewer(holder: any, _images?: string[]): Promise<void> {
		holder.selectAll('.sjpp-deletable-ai-prjt-admin-div').remove()

		const config = this.getConfig()
		let images: string[] = []

		if (_images && _images.length > 0) {
			images = _images
		} else {
			const response: AIProjectAdminResponse = await this.prjtRepo.getImagePaths(
				this.genome,
				this.dslabel,
				config.settings.project
			)
			images = response.images
		}

		const wsiViewer = await import('#plots/wsiviewer/plot.wsi.js')
		wsiViewer.default(this.dslabel, holder, { name: this.genome }, null, config.settings.project.id, images, true)
	}

	public async appDispatchEdit(settings: any, config: any = {}): Promise<void> {
		if (!config?.settings) {
			config = this.getConfig()
			if (!config) throw new Error(`No plot with id='${this.id}' found.`)
		}

		await this.app.dispatch({
			type: 'plot_edit',
			id: this.id,
			config: Object.assign(settings, config.settings)
		})
	}

	private getConfig(): any {
		return this.app.getState().plots.find((p: any) => p.id === this.id)
	}

	public async exportAnnotations(projectId: number): Promise<void> {
		const config = this.getConfig()
		if (!config || !config.settings) throw new Error(`No plot with id='${this.id}' found.`)

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
		const rawName =
			config.settings && config.settings.project && config.settings.project.name
				? String(config.settings.project.name)
				: `project-${projectId}`
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
}
