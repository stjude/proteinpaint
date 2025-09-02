import type { Menu } from '#dom'
import type { Div, Elem } from '../../types/d3'
import type { GeneArgumentEntry } from '#types'
import { addButton } from './addButton.ts'
import { make_one_checkbox } from '../checkbox.js'
import { makeRadiosWithContentDivs } from './radioWithContent.ts'
import { debounce } from 'debounce'
import type { ClientGenome } from '../../types/clientGenome'

type GenesMenuArgs = {
	/** tip holder for displaying the Menu */
	tip: Menu
	genome: ClientGenome
	/** object sent from the view model
	 * .param is the defined arg from the dataset
	 * .input is the element created in addParameter and returned
	 * to the view model
	 */
	params: { param: GeneArgumentEntry; input?: Elem }[]
	/** Called when 'Calculate genes' is clicked */
	callback: (f?: number) => void
	/** Adds nested .options: [] for parameters back to opts
	 * after rendering to avoid duplicate elements
	 */
	addOptionalParams: ({ param, input }) => void
}

export class GenesMenu {
	tip: Menu
	genome: ClientGenome
	params: { param: GeneArgumentEntry; input?: Elem }[]
	callback: (f?: number) => void
	addOptionalParams: ({ param, input }) => void
	/** Collects nested param .options:[] for submenus. See 'boolean' type. */
	readonly params2Add: { param: GeneArgumentEntry; input: Elem }[] = []

	constructor(opts: GenesMenuArgs) {
		this.tip = opts.tip
		this.genome = opts.genome
		this.params = opts.params
		this.callback = opts.callback
		this.addOptionalParams = opts.addOptionalParams

		this.tip.d.style('padding', '15px')
		this.render()

		for (const param of this.params2Add) this.addOptionalParams(param)
	}

	render() {
		for (const param of this.params) {
			const input = this.addParameter(param.param, this.tip.d.append('div'))
			param.input = input
		}
		/** Prevents the gene set edit ui disappearing when clicking 
		within this menu. User can still click the gene set edit ui
		to close this menu. */
		this.tip.d.on('mousedown', (event: Event) => {
			event.stopPropagation()
		})
		//Submits all the inputs from the menu to the callback
		const calGenesBtn = addButton({
			div: this.tip.d.append('div').style('padding', '20px').style('display', 'inline-block'),
			text: 'Calculate genes',
			callback: async () => {
				calGenesBtn.property('disabled', true).text('Loading...')
				await this.callback()
				this.tip.hide()
			}
		})
	}

	addParameter(param, div: Div) {
		let input
		if (param.type == 'boolean') {
			if (param?.options?.length) {
				/* ** Submenu ** 
				Use checkbox to expand div for additional options when checked. */
				const holder = div.append('div').attr('data-testid', 'sjpp-submenu-checkbox').style('padding', '2px')
				const contentDiv = div.append('div').style('padding-left', '20px')
				input = make_one_checkbox({
					holder: holder,
					id: param.id,
					checked: param.checked,
					labeltext: param.label,
					callback: () => {
						contentDiv.style('display', input.property('checked') ? 'block' : 'none')
					}
				})
				input.on('mousedown', (event: Event) => {
					event.stopPropagation()
				})
				for (const option of param.options) {
					const optionInput = this.addParameter(option, contentDiv.append('div'))
					option.parentId = param.id
					this.params2Add.push({ param: option, input: optionInput })
				}
				contentDiv.style('display', input.property('checked') ? 'block' : 'none')
			} else {
				input = div.append('input').style('padding', '2px').attr('type', 'checkbox').attr('id', param.id)
				if (param.value) input.property('checked', param.value)
				this.addLabels(div, 'label', param)
			}
		}
		//The parameter value will be used as the input value if the option is checked
		else if (param.type == 'string' && param.value) {
			input = make_one_checkbox({
				holder: div,
				id: param.id,
				checked: true,
				labeltext: param.label,
				callback: event => {
					event.stopPropagation()
				}
			})
		} else if (param.type == 'number') {
			input = div
				.append('input')
				.attr('type', 'number')
				.style('width', '50px')
				.style('padding', '5px')
				.attr('id', param.id)
			if (param.value) input.attr('value', param.value)
			this.addLabels(div, 'span', param)
		} else if (param.type == 'radio') {
			const hasChecked = param.options.find((d: any) => d.checked)
			if (!hasChecked) param.options[0].checked = true
			input = div.append('div').attr('id', param.id)
			input.append('p').style('font-size', '0.8em').style('opacity', 0.75).text(param.label)
			this.addRadioValue(param)
			this.addRadioCallbacks(param, this.genome)
			makeRadiosWithContentDivs(param.options, input as any)
		}
		return input
	}

	addLabels(div: Div, elem: string, param: GeneArgumentEntry) {
		if (!param.sublabel) div.append(elem).html(param.label!).attr('for', param.id)
		else {
			const labelDiv = div.append('div').style('display', 'inline-block').style('vertical-align', 'middle')
			labelDiv
				.append(elem)
				.style('display', 'block')
				.style('padding-top', '3px')
				.html(param.label!)
				.attr('for', param.id)
			labelDiv.append('span').style('display', 'block').style('font-size', '0.75em').html(param.sublabel)
		}
	}

	addRadioValue(param) {
		if (param.value) return
		const checked = param.options.find((d: any) => d.checked)
		if (checked) {
			param.value = {
				type: checked.value,
				geneList: null
			}
		}
	}

	addRadioCallbacks(param, genome) {
		for (const opt of param.options) {
			if (!opt.type) opt.type = 'boolean'
			if (opt.type == 'tree') {
				opt.callback = async (holder: Elem) => {
					const termdb = await import('../../termdb/app.js')
					const treeDiv = holder.append('div')
					await termdb.appInit({
						holder: treeDiv,
						state: {
							dslabel: opt.value,
							genome: genome.name,
							nav: {
								header_mode: 'search_only'
							}
						},
						tree: {
							click_term: (term: any) => {
								holder
									.append('div')
									.classed('ts_pill sja_filter_tag_btn sja_tree_click_term termlabel', true)
									.style('margin', '5px')
									.text(`${term.id}`)
								param.value = {
									type: opt.value,
									geneList: term._geneset.map((t: any) => t.symbol)
								}
								treeDiv.selectAll('*').remove()
							}
						}
					})
				}
			}
			if (opt.type == 'text') {
				opt.callback = async (holder: Elem) => {
					holder
						.append('span')
						.style('display', 'block')
						.style('font-size', '0.8em')
						.style('opacity', 0.75)
						.text('Enter genes separated by spaces or commas')
					holder
						.append('textarea')
						.style('display', 'block')
						.on(
							'keyup',
							debounce(function (this: any) {
								const geneList = this.value
									.split(/[\s,]+/)
									.map((t: string) => t.trim())
									.filter((t: string) => t !== '')
								param.value = {
									type: opt.value,
									geneList
								}
							}),
							500
						)
				}
			}
			if (opt.type == 'boolean') {
				opt.callback = () => {
					param.value = {
						type: opt.value,
						geneList: null
					}
				}
			}
		}
	}
}
