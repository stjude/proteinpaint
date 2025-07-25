import { filterPromptInit } from '#filter'

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
			.attr('id', 'sjpp-ai-histo-tool-filter-div')
			.attr('class', 'sjpp-deletable-ai-histo-div')
			.style('padding', '10px')

		const filter = filterPromptInit({
			holder: filterDiv,
			emptyLabel: 'Add fitler',
			vocabApi: this.app.vocabApi,
			termdbConfig: this.app.vocabApi.termdbConfig,
			debug: true,
			callback: () => {
				console.log('Filter applied')
			}
		})
		filter.main({ type: 'tvslst', join: '', lst: [] })
	}
}
