import { addGeneSearchbox } from '../genesearch.ts'
import { Menu } from '#dom'
import { select } from 'd3-selection'
import { mclass, dt2color, dt2label } from '#shared/common.js'
import { TermTypes } from '#shared/terms.js'
import type { Button, Div, Elem } from '../../types/d3'
import type { ClientCopyGenome } from '../../types/global'
import type { GeneArgumentEntry } from '#types'
import { GenesMenu } from './GenesMenu'
import { addButton } from './addButton.ts'
import { dofetch3 } from '#common/dofetch'

type API = {
	dom: {
		holder: Div
		/** text links above the gene holding div
		 * Opens a menu to select genes from different datasets
		 */
		textControlDiv: Div
		/** on click clears the gene holding div */
		clearBtn: Button
		/** on click populates the geneHoldingDiv with original gene list */
		restoreBtn: Button | null
		/** gene holding area, shows bunch of gene buttons pending submission */
		geneHoldingDiv: Div
		/** legend area, to show available stats legend on genes */
		statLegendDiv: Div
		/** Submit button */
		submitBtn: Button
	}
	/** originally .params and split into two
	 * Derived from termdbConfig.queries.topMutatedGenes.arguments
	 * input for the param is add in the gene set menu
	 */
	topMutatedGenesParams: { param: GeneArgumentEntry; input?: any }[]
	/** Derived from termdbConfig.queries.topVariablyExpressedGenes.arguments
	 * input for the param is add in the gene set menu
	 */
	topVariablyExpressedGenesParams: { param: GeneArgumentEntry; input?: any }[]
	/** while rendering each gene button, if gene stat is available,
	 * it records color and labels for each color,
	 * to be shown in statLegendDiv */
	statColor2label: Map<string, any>
	/** destory the original menu (i.e. tip == opts.holder) */
	destroy: () => void
}

type Gene = {
	gene: string
	mutationStat?: { class: string; count: number; dt?: number }[]
}

export type CallbackArg = {
	geneList: Gene[]
}

/** optional instruction to add new button(s) and pull in gene sets by custom-designed means.
 * used by gdc oncomatrix react wrapper to call the GFF gene set modal */
type CustomInputs = {
	/** button name */
	label: string
	/** Change button display based on caller logic */
	getDisplayStyle?: () => void
	/** callback to trigger upon clicking this button. should show some ui to collect
	 * gene names and bring them into holding box */
	showInput: (arg: any) => void
}[]

export type GeneSetEditArg = {
	holder: Elem
	genome: ClientCopyGenome
	/** Optional: If provided, allow to load top variably mutated ('geneVariant') or
	 * expressed genes ('geneExpression'). If not provided, only allow to add genes manually
	 * later can be union of multiple mode strings */
	mode?: 'geneVariant' | 'geneExpression'
	/** Minimum number of genes to return in the callback */
	minNumGenes?: number
	/** What to do with the genes returned */
	callback: (arg: CallbackArg) => void
	/** passed termdb instance */
	vocabApi: any
	/** List of genes returned by the callback */
	geneList?: Gene[]
	/** Title appearing above the UI */
	titleText?: string
	customInputs?: CustomInputs
	/** Pass the genes available to be used by the caller. When not in the limited
	 * list, genes will appear with a strikethrough */
	limitedGenesList?: string[]
	/** show the terms in the order of input*/
	termsAsListed?: boolean
}

type MenuListEntry = {
	/** Label shown, either on the button or link */
	label: string
	/** For buttons, set display per condition(s) */
	getDisplayStyle?: () => string
	callback: (f?: any) => void
	/** Element tagname. If button, uses addButton to create elem */
	tagName?: string
}

export class GeneSetEditUI {
	holder: Elem
	genome: ClientCopyGenome
	callback: (arg: CallbackArg) => void
	/** termdb */
	vocabApi: any
	tip2: Menu
	origLst: Gene[]
	origNames: string
	api: API
	geneSearch: any //cheating
	/** Objects detailing the menus to create above the api.dom.geneHoldingDiv as clickable links  */
	menuList: MenuListEntry[]
	mode?: 'geneVariant' | 'geneExpression'
	minNumGenes: number
	geneList: Gene[]
	titleText?: string
	customInputs?: CustomInputs
	limitedGenesList?: string[]
	termsAsListed?: boolean

	constructor(opts: GeneSetEditArg) {
		this.holder = opts.holder
		this.genome = opts.genome
		this.callback = opts.callback
		this.vocabApi = opts.vocabApi
		this.termsAsListed = opts.termsAsListed
		this.customInputs = opts.customInputs
		this.geneList = structuredClone(opts.geneList || [])
		this.tip2 = new Menu({ padding: '0px', parent_menu: opts.holder.node(), test: 'test' })
		this.minNumGenes = opts.minNumGenes || 0
		if ('mode' in opts) this.mode = opts.mode
		if ('titleText' in opts) this.titleText = opts.titleText
		this.origLst = structuredClone(this.geneList)
		this.origNames = JSON.stringify(this.geneList.map(t => t.gene).sort())

		this.holder.selectAll('*').remove()
		const div = this.holder.append('div').attr('class', 'sja_genesetinput').style('padding', '5px')

		if (this.titleText) {
			div.append('div').style('margin-bottom', '10px').html(this.titleText)
		}
		if (opts.limitedGenesList) {
			this.limitedGenesList = opts.limitedGenesList
		}

		const headerDiv = div.append('div')

		const label = headerDiv.append('label')
		label.append('span').html('Search')
		const row = label
			.append('div')
			.style('display', 'inline-flex')
			.style('align-items', 'center')
			.style('margin', '8px 0px -5px 0px')

		// a holder to render optional buttons
		const controlDiv = headerDiv
			.append('div')
			.style('display', 'inline-flex')
			.style('align-items', 'center')
			.style('float', 'right')
			.style('gap', '5px')

		const addGene = this.addGene.bind(this)
		this.geneSearch = addGeneSearchbox({
			tip: this.tip2,
			genome: this.genome,
			row,
			searchOnly: 'gene',
			callback: addGene,
			hideHelp: true,
			focusOff: true
		})

		this.menuList = []

		this.api = {
			dom: {
				holder: div,
				textControlDiv: controlDiv.append('div'),
				clearBtn: addButton({
					div: controlDiv,
					text: 'Clear',
					disabled: !this.geneList?.length,
					callback: () => {
						this.geneList = []
						this.renderGenes()
					}
				}),
				restoreBtn: this.geneList?.length
					? addButton({
							div: controlDiv,
							disabled: true,
							text: 'Restore',
							callback: () => {
								this.geneList = this.origLst
								this.renderGenes()
							}
					  })
					: null,
				geneHoldingDiv: this.renderGeneHoldingDiv(div),
				statLegendDiv: div.append('div'),
				submitBtn: addButton({
					div: div.append('div').style('margin-top', '10px'),
					text: 'Submit',
					disabled: !this.geneList?.length,
					callback: () => {
						this.callback({ geneList: this.geneList })
					}
				})
			},
			topMutatedGenesParams: [],
			topVariablyExpressedGenesParams: [],
			statColor2label: new Map(),
			destroy() {
				opts.holder.remove()
			}
		}
		this.getParams()
		this.createMenuList()
		this.renderTextControls(this.api.dom.textControlDiv)
		this.renderGenes()
	}

	getParams() {
		if (this.mode == TermTypes.GENE_VARIANT && this.vocabApi.termdbConfig?.queries?.topMutatedGenes) {
			if (this.vocabApi.termdbConfig.queries.topMutatedGenes.arguments) {
				for (const param of this.vocabApi.termdbConfig.queries.topMutatedGenes.arguments)
					this.api.topMutatedGenesParams.push({ param })
			}
		}
		if (this.mode == TermTypes.GENE_EXPRESSION && this.vocabApi.termdbConfig?.queries?.topVariablyExpressedGenes) {
			if (this.vocabApi.termdbConfig.queries.topVariablyExpressedGenes.arguments) {
				for (const param of this.vocabApi.termdbConfig.queries.topVariablyExpressedGenes.arguments) {
					if (param.type == 'radio' && (!param.options || param.options.length == 0))
						throw 'Radio button must have options'
					this.api.topVariablyExpressedGenesParams.push({ param })
				}
			}
		}
	}

	baseGeneMenuArgs(arr) {
		arr = this.removeDuplicates(arr)
		return {
			tip: this.tip2,
			genome: this.genome,
			params: arr,
			addOptionalParams: ({ param, input }) => {
				arr.push({ param, input })
			}
		}
	}

	removeDuplicates(arr) {
		for (const param of arr) {
			if (param.param?.options) {
				param.param.options.forEach(opt => {
					if (!opt.id) return
					const i = arr.findIndex(i => i.param.id == opt.id)
					if (i != -1) arr.splice(i, 1)
				})
			}
		}
		return arr
	}

	createMenuList() {
		if (this.api?.topMutatedGenesParams.length > 0) {
			this.menuList.push({
				label: 'Top mutated genes',
				callback: async (event: Event) => {
					this.tip2.clear().showunder(event.target)
					const callback = async () => {
						const args = {
							genome: this.vocabApi.vocab.genome,
							dslabel: this.vocabApi.vocab.dslabel,
							filter: this.vocabApi.state.termfilter.filter,
							filter0: this.vocabApi.state.termfilter.filter0
						}

						this.getInputs(this.api.topMutatedGenesParams, args)
						const result = await dofetch3('termdb/topMutatedGenes', { method: 'GET', body: args })

						this.geneList = []
						this.geneList.push(...result.genes)
						this.renderGenes()
					}
					const menuArgs = Object.assign(this.baseGeneMenuArgs(this.api.topMutatedGenesParams), { callback })
					new GenesMenu(menuArgs)
				}
			})
		}
		if (this.api?.topVariablyExpressedGenesParams.length > 0) {
			this.menuList.push({
				label: 'Top variably expressed genes',
				callback: (event: Event) => {
					this.api.topVariablyExpressedGenesParams
						.filter(p => p.param.type == 'radio' && p.param?.options)
						.forEach(p => {
							//Sets the default value of the radio button to the first option
							//for top VE args, it will always be a string
							if (typeof p.param.options![0].value === 'string') {
								p.param.value = { type: p.param.options![0].value, value: null }
							} else {
								console.error(`Unexpected radio button value type: ${typeof p.param.options![0].value}`)
							}
						})
					this.tip2.clear().showunder(event.target)
					const callback = async () => {
						const args: any = {
							genome: this.vocabApi.state.vocab.genome,
							dslabel: this.vocabApi.state.vocab.dslabel
						}
						// supply filters from app state
						if (this.vocabApi.state.termfilter) {
							if (this.vocabApi.state.termfilter.filter) args.filter = this.vocabApi.state.termfilter.filter // pp filter
							if (this.vocabApi.state.termfilter.filter0) args.filter0 = this.vocabApi.state.termfilter.filter0 // gdc filter
						}

						this.getInputs(this.api.topVariablyExpressedGenesParams, args)
						const result = await this.vocabApi.getTopVariablyExpressedGenes(args)

						this.geneList = []
						if (result.genes) {
							for (const gene of result.genes) this.geneList.push({ gene })
						}
						this.renderGenes()
					}

					const menuArgs = Object.assign(this.baseGeneMenuArgs(this.api.topVariablyExpressedGenesParams), { callback })
					new GenesMenu(menuArgs)
				}
			})
		}
		if (this.genome?.termdbs?.msigdb) {
			for (const key in this.genome.termdbs) {
				const tdb = this.genome.termdbs[key]
				this.menuList.push({
					label: `${tdb.label} gene set`,
					callback: async () => {
						this.tip2.clear().showunder(this.api.dom.textControlDiv.node()!)
						const termdb = await import('../../termdb/app.js')
						termdb.appInit({
							holder: this.tip2.d,
							state: {
								dslabel: key,
								genome: this.genome.name,
								nav: {
									header_mode: 'search_only'
								}
							},
							tree: {
								click_term: term => {
									this.geneList = []
									const geneset = term._geneset
									if (geneset) {
										for (const gene of geneset) this.geneList.push({ gene: gene.symbol })
										this.renderGenes()
									}
									this.tip2.hide()
									this.api.dom.submitBtn.node()!.focus()
								}
							}
						})
					}
				})
			}
		}
		if (this.customInputs) {
			for (const btn of this.customInputs) {
				const opts = {
					label: btn.label,
					callback: () => {
						btn.showInput({
							callback: ({ geneList }) => {
								this.geneList = geneList
								this.renderGenes()
							}
						})
					},
					tagName: 'button'
				} as any
				if (btn.getDisplayStyle) opts.getDisplayStyle = btn.getDisplayStyle
				this.menuList.push(opts)
			}
		}
	}

	renderTextControls(div: Div) {
		for (const menu of this.menuList) {
			if (menu.tagName == 'button')
				addButton({
					div,
					text: menu.label,
					getDisplayStyle: menu.getDisplayStyle || (() => ''),
					callback: menu.callback
				})
			else
				div
					.append('a')
					.style('text-decoration', 'underline')
					.style('padding', '0px 10px')
					.style('color', 'black')
					.html(`${menu.label} &#9660;`)
					.on('click', async (event: Event) => {
						await menu.callback(event)
					})
		}
	}

	getInputs(arr, args) {
		for (const { param, input } of arr) {
			if (param.parentId) {
				const parent = arr.find(i => i.param.id == param.parentId)
				//Parents are always checkboxes/boolean
				//Do not include submenu inputs in the request if not checked
				if (!parent || !parent.input.node().checked) return
			}
			const id = input.attr('id')
			args[id] = this.getInputValue({ param, input })
		}
	}

	getInputValue({ param, input }) {
		if (param.type == 'radio') return param.value
		const value = input.node().value
		if (input.attr('type') == 'number') return Number(value)
		if (input.attr('type') == 'checkbox') {
			if (param.type == 'string') return input.node().checked ? param.value : ''
			if (param.type == 'boolean') return input.node().checked ? 1 : 0
		}
	}

	renderGeneHoldingDiv(div: Div) {
		return div
			.append('div')
			.append('div')
			.style('display', 'flex')
			.style('flex-wrap', 'wrap')
			.style('gap', '5px')
			.style('min-height', '20px')
			.style('border', 'solid 1px #aaa')
			.style('margin', '15px 0px')
			.style('padding', '6px 2px')
			.style('min-height', '30px')
	}

	renderStatLegend() {
		if (!this.api.statColor2label || this.api.statColor2label.size == 0) {
			// no legend to display
			this.api.dom.statLegendDiv.style('display', 'none')
			return
		}
		this.api.dom.statLegendDiv.style('display', 'block').selectAll('*').remove()
		for (const [c, n] of this.api.statColor2label) {
			this.api.dom.statLegendDiv
				.append('div')
				.style('display', 'inline-block')
				.style('width', '12px')
				.style('height', '12px')
				.style('background-color', c)
			this.api.dom.statLegendDiv.append('span').html(` ${n} &nbsp;&nbsp;`)
		}
		return this.api.dom.statLegendDiv
	}

	/** Functions supporting adding/removing genes from the geneHoldingDiv */
	addGene() {
		const gene = this.geneSearch.geneSymbol
		for (const item of this.geneList) {
			if (item.gene == gene) {
				window.alert(`The gene ${gene} has already been added`)
				return
			}
		}
		if (gene) this.geneList.push({ gene })
		this.renderGenes()
	}

	renderGenes() {
		const hasStat = this.geneList.some(g => g.mutationStat)
		if (!hasStat && !this.termsAsListed)
			this.geneList.sort((a, b) => {
				if (a.gene < b.gene) return -1
				if (a.gene > b.gene) return 1
				return 0
			})
		this.api.dom.geneHoldingDiv.selectAll('*').remove()

		const renderGene = this.renderGene.bind(this)
		const deleteGene = this.deleteGene.bind(this)

		this.api.dom.geneHoldingDiv
			.selectAll('div')
			.data(this.geneList || [])
			.enter()
			.append('div')
			.attr('aria-label', 'Click to delete')
			.attr('class', 'sja_menuoption')
			.attr('tabindex', 0)
			.style('position', 'relative')
			.style('display', 'inline-block')
			.style('padding', '5px 16px 5px 9px')
			.style('margin-left', '5px')
			.each(function (this: any, gene) {
				const div = select(this).style('border-radius', '5px')
				renderGene(div, gene)
				div.on('click', () => deleteGene(gene))
			})
			// .on('click', deleteGene)
			.on('mouseover', function (event) {
				const div = select(event.target)
				div
					.append('div')
					.style('margin-left', '4px')
					.classed('sjpp_deletebt', true)
					.style('display', 'inline-block')
					.style('position', 'absolute')
					.style('right', '0px')
					.style('top', '0px')

					.style('transform', 'scale(0.6)')
					.style('pointer-events', 'none')
					.html(
						`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#000" class="bi bi-x-lg" viewBox="0 0 16 16">
                <path stroke='#f00' d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/>
                </svg>`
					)
			})
			.on('mouseout', function (event) {
				select(event.target).select('.sjpp_deletebt').remove()
			})
			.on('focus', event => {
				event.target.dispatchEvent(new PointerEvent('mouseover'))
			})
			.on('blur', event => {
				event.target.dispatchEvent(new PointerEvent('mouseout'))
			})
			.on('keyup', event => {
				if (event.key == 'Enter') event.target.click()
			})

		this.renderStatLegend() // api.statColor2label has been accumulated if available

		this.api.dom.clearBtn.property('disabled', !this.geneList?.length)
		const hasChanged = this.origNames !== JSON.stringify(this.geneList.map(t => t.gene).sort())
		this.api.dom.restoreBtn?.property('disabled', !hasChanged)
		// disable submit button when gene list not changed or is empty in expression mode
		this.api.dom.submitBtn.property(
			'disabled',
			!hasChanged || this.geneList?.length < this.minNumGenes || !this.geneList?.length
		)
		if (hasChanged) this.api.dom.submitBtn!.node()!.focus()
	}

	renderGene(div: Div, gene: Gene) {
		let notInList = false
		//Check if list is present, then run check
		if (this.limitedGenesList && !this.limitedGenesList?.includes(gene.gene)) {
			notInList = true
		}
		if (gene.mutationStat) {
			div.style('text-decoration', notInList ? 'line-through' : '').html(`${gene.gene}&nbsp;&nbsp;`)
			for (const m of gene.mutationStat) {
				// m is {class,count} or {dt,count}; if class is given, bgcolor is determined by class; otherwise by dt and logicis  a bit shaky now (may
				let bgcolor: string
				/** bg and text color of gene button
				 * default is black
				 */
				let textcolor = 'black'
				if ('class' in m) {
					if (!mclass[m.class]) throw 'invalid stat class'
					bgcolor = mclass[m.class].color
					this.api.statColor2label.set(bgcolor, mclass[m.class].label)
				} else if ('dt' in m) {
					if (!dt2color[m['dt']]) throw 'invalid stat dt'
					bgcolor = dt2color[m['dt']]
					textcolor = 'white' // hardcode it for now
					this.api.statColor2label.set(bgcolor, dt2label[m['dt']])
				} else {
					throw 'stat missing dt/class'
				}
				div
					.insert('span')
					.style('font-size', '.7em')
					.style('background-color', bgcolor)
					.style('padding', '1px 2px')
					.style('color', textcolor)
					.text(m.count)
			}
			/* enable different types of gene stats this way
		} else if(gene.expStat) {
		*/
		} else {
			div
				.insert('div')
				.style('display', 'inline-block')
				.style('text-decoration', notInList ? 'line-through' : '')
				.html(gene.gene)
		}
	}

	deleteGene(d: Gene) {
		const i = this.geneList.findIndex(g => g.gene === d.gene)
		if (i != -1) {
			this.geneList.splice(i, 1)
			this.renderGenes()
		}
	}
}
