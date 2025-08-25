import { filterInit, getNormalRoot } from '#filter'
import { ClassesTableRender } from './ClassesTableRender'
import type { Elem } from '../../../types/d3'
// import { InvalidDataUI, sayerror } from '#dom'
import type { AIProjectAdminInteractions } from '../interactions/AIProjectAdminInteractions'
import { SelectorTableRender } from './SelectorTableRender'

export class CreateProjectRender {
	dom: {
		holder: Elem
		errorDiv: Elem
		filterDiv: Elem
		classDiv: Elem
	}
	app: any
	interactions: AIProjectAdminInteractions
	filter: any
	classesTable?: ClassesTableRender

	constructor(dom: any, app: any, interactions: AIProjectAdminInteractions) {
		dom.holder.style('padding', '10px 20px').attr('class', 'sjpp-deletable-ai-prjt-admin-div')

		this.dom = {
			holder: dom.holder,
			errorDiv: dom.errorDiv,
			filterDiv: dom.holder.append('div').attr('id', 'sjpp-ai-prjt-admin-filter-div'),
			classDiv: dom.holder.append('div').attr('id', 'sjpp-ai-prjt-admin-classes-table').style('padding', '20px 0px')
		}
		this.app = app
		this.interactions = interactions
		this.filter = null
	}

	render() {
		this.renderFilter()
		this.classesTable = new ClassesTableRender(this.dom.classDiv)
		this.renderApplyBtn()
	}

	private renderFilter() {
		const filter = filterInit({
			holder: this.dom.filterDiv,
			emptyLabel: 'Add filter',
			vocabApi: this.app.vocabApi,
			termdbConfig: this.app.vocabApi.termdbConfig,
			callback: filter => {
				this.filter = filter
			}
		})

		const state = this.app.getState()
		const root = getNormalRoot(state.termfilter.filter)
		filter.main(root)
	}

	private renderApplyBtn() {
		this.dom.classDiv
			.append('div')
			.text('Apply')
			.classed('sja_menuoption', true)
			.style('display', 'inline-block')
			.style('margin-left', '200px')
			.on('click', async () => {
				/**** Uncomment before production */

				// const invalidInfo = this.validateInput()
				// const numInvalid = invalidInfo.entries?.length
				// if (numInvalid) {
				// 	/** TODO: allow user to ignore filter error on second click */
				// 	if (numInvalid === 1) sayerror(this.dom.errorDiv, invalidInfo.entries[0].reason)
				//  else InvalidDataUI.render(this.dom.errorDiv, invalidInfo)
				// 	return
				// }
				const selections: any = await this.interactions.getImages(this.filter)
				if (this.filter && (selections.status != 'ok' || selections.data.length === 0)) {
					alert('No images match your filter criteria.')
					return
				}

				this.interactions.addProject({
					project: {
						filter: this.filter,
						classes: this.classesTable!.rows.map((row, i) => {
							return { label: row[1].value, color: row[2].color, key_shortcut: `Digit${i}` }
						})
					}
				})
				this.dom.holder.selectAll('*').remove()
				new SelectorTableRender(this.dom.holder, this.interactions, selections.data)
			})
	}

	/**** Uncomment before production */
	// private validateInput() {
	// 	const invalidInfo = {
	// 		entries: [] as { dataType: string; reason: string }[],
	// 		errorMsg: 'Please clear all "Data type: Class" errors before applying changes.'
	// 	}

	// 	//Show user error if no filter is defined.
	// 	if (!this.filter) {
	// 		invalidInfo.entries.push({ dataType: 'Filter', reason: 'No filter defined. Did you mean to add a filter?' })
	// 	}
	// 	//Check if all classes were deleted
	// 	const classes = this.classesTable?.rows.map(row => row[1].value) || []
	// 	if (classes.length === 0) {
	// 		invalidInfo.entries.push({ dataType: 'Class', reason: 'No classes defined. Did you mean to add a class?' })
	// 	}
	// 	//Check to see if any class is still a default class
	// 	const unchangedClasses =
	// 		this.classesTable?.rows
	// 			.filter(row => (row[1]?.value as string)?.startsWith('New class'))
	// 			.map(r => r[1]?.value as string) || []
	// 	for (const c of unchangedClasses) {
	// 		invalidInfo.entries.push({ dataType: 'Class', reason: `${c} is the default class name. Please rename.` })
	// 	}

	// 	return invalidInfo
	// }
}
