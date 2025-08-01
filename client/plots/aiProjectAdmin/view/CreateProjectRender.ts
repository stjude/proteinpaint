import { filterInit, getNormalRoot } from '#filter'

export class CreateProjectRender {
	dom: any
	app: any

	constructor(dom: any, app: any) {
		this.dom = dom
		this.app = app
	}

	render() {
		const filterDiv = this.dom.holder
			.append('div')
			.attr('class', 'sjpp-deletable-ai-prjt-admin-div')
			.style('padding', '10px')

		const state = this.app.getState()

		const callback = filter => {
			//Save somewhere
			//Will send to server on apply
			console.log('test:', filter)
		}

		const filter = filterInit({
			holder: filterDiv.append('div').attr('id', 'sjpp-ai-prjt-admin-filter-div'),
			emptyLabel: 'Add fitler',
			vocabApi: this.app.vocabApi,
			termdbConfig: this.app.vocabApi.termdbConfig,
			callback
		})

		const root = getNormalRoot(state.termfilter.filter)
		filter.main(root)
	}
}
