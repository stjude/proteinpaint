import { filterPromptInit, filterInit } from '#filter'

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

		const callback = filterUiRoot => {
			filterDiv.selectAll('#sjpp-ai-prjt-admin-filter-prompt-div').remove()
			this.makeFilterRow(filterDiv, filterUiRoot)
		}

		//Initial filter prompt
		//Removed and replaced by term pill
		const filter = filterPromptInit({
			holder: filterDiv.append('div').attr('id', 'sjpp-ai-prjt-admin-filter-prompt-div'),
			emptyLabel: 'Add fitler',
			vocabApi: this.app.vocabApi,
			termdbConfig: this.app.vocabApi.termdbConfig,
			callback
		})
		filter.main({ type: 'tvslst', join: '', lst: [] })
	}

	//Shows the filter row with the selected filter(s)
	makeFilterRow(filterDiv, filterUiRoot) {
		filterInit({
			holder: filterDiv,
			vocabApi: this.app.vocabApi,
			termdbConfig: this.app.vocabApi.termdbConfig,
			callback: f => {
				// Handle filter selection
				console.log('Filter selected:', f)
			}
		}).main(filterUiRoot)
	}
}
