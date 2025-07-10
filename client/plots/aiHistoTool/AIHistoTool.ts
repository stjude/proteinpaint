import { RxComponentInner } from '../../types/rx.d'
import { getCompInit, copyMerge } from '#rx'
import type { MassState } from '#mass/types/mass'
import { getDefaultAIHistoToolSettings } from './defaults'
// import { renderTable } from '#dom'
// import { debounce } from 'debounce'
import { Model } from './model/Model'

class AIHistoTool extends RxComponentInner {
	public type = 'AIHistoTool'
	model?: Model

	constructor(opts: any) {
		super()
		this.opts = opts
		this.dom = {
			holder: opts.holder
		}
	}

	getState(appState: MassState) {
		const config = appState.plots.find((p: any) => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		return {
			config
		}
	}

	async init(appState: MassState) {
		try {
			console.log(appState)
			this.model = new Model()
			await this.model.getProjects(appState.vocab.genome, appState.vocab.dslabel)
		} catch (e: any) {
			console.error('Error initializing AIHistoTool:', e)
			throw e
		}
		// const projectDiv = this.dom.holder.append('div').attr('class', 'ai-histo-tool-projects')

		// // Render new project input
		// const newProjectDiv = projectDiv.append('div').attr('class', 'sjpp-project-select-new').style('padding', '10px')

		// const input = newProjectDiv
		// 	.append('input')
		// 	.attr('id', 'sjpp-new-project-name')
		// 	.attr('display', 'inline-block')
		// 	.attr('placeholder', 'New project name')

		// const button = newProjectDiv
		// 	.append('button')
		// 	.text('Create Project')
		// 	.attr('display', 'inline-block')
		// 	.property('disabled', true)
		// 	.on('click', () => {
		// 		const projectName = input.property('value')
		// 		console.log('Creating new project:', projectName)
		// 	})

		// input.on('keydown', () => {
		// 	const debouncer = () => {
		// 		button.property('disabled', input.property('value').length == 0)
		// 	}
		// 	debounce(debouncer, 300)()
		// })

		// // Render existing projects
		// const tableDiv = projectDiv.append('div').attr('class', 'sjpp-project-select-table').style('padding', '10px')
		// const rows: any = [[{ value: 'test' }], [{ value: 'test2' }]]
		// const columns = [{ label: 'Project', sortable: true }]

		// renderTable({
		// 	div: tableDiv,
		// 	rows,
		// 	header: {
		// 		allowSort: true
		// 	},
		// 	columns,
		// 	singleMode: true,
		// 	noButtonCallback: (i: any, node: any) => {
		// 		console.log('Selected project:', i, node)
		// 		//TODO: app.dispatch
		// 	}
		// })
	}

	main() {
		const config = structuredClone(this.state.config)
		if (config.chartType != this.type) return
	}
}

export const aiHistoToolInit = getCompInit(AIHistoTool)
export const componentInit = aiHistoToolInit

export async function getPlotConfig(opts: any) {
	const config = {
		chartType: 'AIHistoTool',
		subfolder: 'aiHistoTool',
		extension: 'ts',
		settings: getDefaultAIHistoToolSettings(opts.overrides)
	}

	return copyMerge(config, opts)
}
