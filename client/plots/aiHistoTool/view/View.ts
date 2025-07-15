import { renderTable } from '#dom'
import { debounce } from 'debounce'
import type { AIHistoInteractions } from '../interactions/AIHistoInteractions'

export class View {
	dom: any
	projects: any[]
	interactions: AIHistoInteractions

	constructor(dom: any, projects: any[], interactions: AIHistoInteractions) {
		this.dom = dom
		this.projects = projects //returns as [{ value: 'Project1' }, { value: 'Project2' }, ...]
		this.interactions = interactions
	}

	render() {
		const projectDiv = this.dom.holder.append('div').attr('class', 'ai-histo-tool-projects')
		this.renderNewProject(projectDiv)
		this.renderExistingProjects(projectDiv)
	}

	renderNewProject(projectDiv) {
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
			.on('click', () => {
				const projectName = input.property('value')
				const notEmpty = projectName.trim().length > 0
				if (!notEmpty) {
					//TODO: use say error instead
					//Shouldn't be necessary because of the debouncer
					console.warn('Project name cannot be empty')
					return
				}
				const notUnique = this.projects.some((p: any) => p.value === projectName)
				if (notUnique) {
					//TODO: use say error instead
					console.warn(`Project name '${projectName}' already exists`)
					return
				}
				this.interactions.addProject(projectName)
				//TODO: clear UI and open meta data and image selector
			})

		input.on('keydown', () => {
			const debouncer = () => {
				button.property('disabled', input.property('value').length == 0)
			}
			debounce(debouncer, 300)()
		})
	}

	renderExistingProjects(projectDiv) {
		if (!this.projects.length) return

		const tableDiv = projectDiv.append('div').attr('class', 'sjpp-project-select-table').style('padding', '10px')
		const columns = [{ label: 'Project', sortable: true }]

		const columnButtons = [
			{
				text: 'Edit',
				callback: (e, i) => {
					//TODO: open wsisamples plot
					this.interactions.editProject()
					console.log('TODO', e, i)
				}
			}
		]

		//TODO: add once user roles are implemented
		// if (userInfo.isAdmin) {
		// 	columnButtons.push({
		// 			text: 'Delete',
		// 			callback: (_, i) => {
		// 				const project = this.projects[i]
		// 				this.interactions.deleteProject(project)

		// 				//Update UI after deletion. Maybe cleaner way to handle this?
		// 				//Maybe app.dispatch and rerender instead?
		// 				this.projects.splice(i, 1)
		// 				//Remove the table from the projectDiv and re-render
		// 				projectDiv.select('.sjpp-project-select-table').remove()
		// 				this.renderExistingProjects(projectDiv)
		// 			}
		// 		})
		// }

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
