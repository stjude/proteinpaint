import { renderTable, sayerror } from '#dom'
import { debounce } from 'debounce'
import type { AIProjectAdminInteractions } from '../interactions/AIProjectAdminInteractions'

export class ProjectAdminRender {
	dom: any
	projects: any[]
	interactions: AIProjectAdminInteractions

	constructor(dom: any, projects: any[], interactions: AIProjectAdminInteractions) {
		this.dom = dom
		this.projects = projects //returns as [{ value: 'Project1' }, { value: 'Project2' }, ...]
		this.interactions = interactions
	}

	/** Renders project administration UI, allowing users to
	 * create new projects or edit existing ones.*/
	renderProjectAdmin() {
		const projectDiv = this.dom.holder
			.append('div')
			.attr('id', 'sjpp-ai-prjt-admin-projects')
			.attr('class', 'sjpp-deletable-ai-prjt-admin-div')
		this.renderCreateProject(projectDiv)
		this.renderProjectSelection(projectDiv)
	}

	/** Users submit a new project name before sample
	 * filtering UI to finalize project creation.*/
	renderCreateProject(projectDiv) {
		const newProjectDiv = projectDiv.append('div').attr('class', 'sjpp-project-select-new').style('padding', '10px')

		const input = newProjectDiv
			.append('input')
			.attr('id', 'sjpp-new-project-name')
			.attr('display', 'inline-block')
			.attr('placeholder', 'New project name')

		const button = newProjectDiv
			.append('button')
			.text('Create Project')
			.attr('display', 'inline-block')
			.property('disabled', true)
			.on('click', async () => {
				const projectName = input.property('value')
				const notEmpty = projectName.trim().length > 0
				if (!notEmpty) {
					//Shouldn't be necessary because of the debouncer
					return sayerror(this.dom.errorDiv, 'Project name cannot be empty')
				}
				const notUnique = this.projects.some((p: any) => p.value === projectName.trim())
				if (notUnique) {
					return sayerror(this.dom.errorDiv, `Project name '${projectName}' already exists`)
				}
				await this.interactions.appDispatchEdit({ settings: { project: { name: projectName, type: 'new' } } })
			})

		input.on('keydown', () => {
			const debouncer = () => {
				button.property('disabled', input.property('value').length == 0)
			}
			debounce(debouncer, 300)()
		})
	}

	/** Users may select an existing project from a table
	 * returned for the db to edit or delete, depending
	 * on user roles.*/
	renderProjectSelection(projectDiv) {
		if (!this.projects.length) return

		const tableDiv = projectDiv.append('div').attr('class', 'sjpp-project-select-table').style('padding', '10px')
		const columns = [{ label: 'Project', sortable: true }]

		const columnButtons = [
			{
				text: 'Edit',
				callback: (e, i) => {
					//TODO: open wsisamples plot
					// this.interactions.editProject()
					console.log('TODO', e, i)
				}
			},
			{
				//TODO: Add logic for admins only once user roles are implemented
				//Leave here for development
				text: 'Delete',
				callback: (_, i) => {
					const project = this.projects[i]
					this.interactions.deleteProject(project)

					//Update UI after deletion. Maybe cleaner way to handle this?
					//Maybe app.dispatch and rerender instead?
					this.projects.splice(i, 1)
					//Remove the table from the projectDiv and re-render
					projectDiv.select('.sjpp-project-select-table').remove()
					this.renderProjectSelection(projectDiv)
				}
			}
		]

		renderTable({
			div: tableDiv,
			rows: this.projects.map((p: any) => {
				return [{ value: p.value }]
			}),
			header: {
				allowSort: true
			},
			columns,
			singleMode: true,
			columnButtons
		})
	}
}
