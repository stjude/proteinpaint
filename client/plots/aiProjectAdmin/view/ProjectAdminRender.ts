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
			.append('div')
			.text('Create Project')
			.classed('sja_menuoption', true)
			.style('display', 'inline-block')
			.property('disabled', true)
			.on('click', async () => {
				const projectName = input.property('value')
				const prjtNameLen = projectName.trim().length

				const showError = (msg: string) => {
					sayerror(this.dom.errorDiv, msg)
					input.property('value', '')
					button.property('disabled', true)

					//Show error for 3 seconds, then remove
					setTimeout(() => {
						this.dom.errorDiv.selectAll('*').remove()
					}, 3000)
				}

				if (prjtNameLen == 0) {
					//Shouldn't be necessary because of the debouncer
					return showError('Project name cannot be empty')
				}
				if (prjtNameLen > 50 || prjtNameLen < 3) {
					return showError('Project name must be between 3 and 50 characters')
				}
				const notUnique = this.projects.some((p: any) => p.value === projectName.trim())
				if (notUnique) {
					return showError(`Project name '${projectName}' already exists`)
				}

				//Show project name in sandbox header
				if (this.dom.header) this.dom.header.text(`Project: ${projectName}`)

				//calls main() to trigger CreateProjectRender
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
				class: 'sja_menuoption',
				//e, i
				callback: (_, __) => {
					/** TODO: open wsisamples plot ||
					 *  get project details rather than edit the db */
					// this.interactions.editProject()
					// console.log('TODO', e, i)
					this.interactions.launchViewer(this.dom.holder)
				}
			},
			{
				//TODO: Add logic for admins only once user roles are implemented
				//Leave here for development
				text: 'Delete',
				class: 'sja_menuoption',
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
