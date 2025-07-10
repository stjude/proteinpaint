import { renderTable } from '#dom'
import { debounce } from 'debounce'

export class View {
	dom: any
	projects: any[]

	constructor(dom, projects) {
		this.dom = dom
		this.projects = projects //returns as [{ value: 'Project1' }, { value: 'Project2' }, ...]
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
				console.log('Creating new project:', projectName)
				//TODO: new endpoint to create project and app.dispatch
				//add interaction
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

		renderTable({
			div: tableDiv,
			rows: this.projects.map((p: any) => {
				return [p]
			}),
			header: {
				allowSort: true
			},
			columns,
			singleMode: true
		})
	}
}
