import { addGeneSearchbox } from '../genesearch.ts'
import { Menu } from '../menu'
import { select } from 'd3-selection'
import { mclass, dt2color, dt2label } from '../../shared/common'
import { Button, Div, Elem, _Element_ } from 'types/d3'
import { ClientCopyGenome } from 'types/global'
import { GenesMenu } from './GenesMenu'
import { addButton } from './addButton.ts'

type API = {
	dom: {
		tdbBtns: { [key: string]: any }
		holder: Div
		/** text links above the gene holding div
		 * Opens a menu to select genes from different datasets
		 */
		textControlDiv: Div
		/** on click clears the gene holding div */
		clearBtn: Button
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
	topMutatedGenesParams: any[]
	/** Derived from termdbConfig.queries.topVariablyExpressedGenes.arguments
	 * input for the param is add in the gene set menu
	 */
	topVariablyExpressedGenesParams: any[]
	/** while rendering each gene button, if gene stat is available,
	 * it records color and labels for each color,
	 * to be shown in statLegendDiv */
	statColor2label: Map<string, any>
	destroy: (_obj) => void
}

type Gene = { gene: string }

type CallbackArg = {
	geneList: Gene[]
}

type GeneSetEditArg = {
	holder: Elem
	genome: ClientCopyGenome
	/** if provided, allow to load top variably mutated or expressed genes; later can be union of multiple mode strings */
	mode?: 'expression' | 'mutation'
	minNumGenes?: number
	callback: (arg: CallbackArg) => void
	vocabApi: any
	geneList?: {
		gene: string
		mutationStat?: { class: string; count: number }[]
	}[]
	titleText?: string
}

export class GeneSetEditUI {
	holder: Elem
	genome: ClientCopyGenome
	callback: (arg: CallbackArg) => void
	/** termdb */
	vocabApi: any
	tip2: Menu
	origLst: { gene: string; mutationStat?: { class: string; count: number }[] | undefined }[]
	origNames: string
	api: API
	geneSearch: any //cheating
	/** Objects detailing the menus to create above the api.dom.geneHoldingDiv as clickable links  */
	menuList: { label: string; callback: (f?: any) => void }[]
	mode?: 'expression' | 'mutation'
	minNumGenes?: number
	geneList: {
		gene: string
		mutationStat?: { class: string; count: number }[]
	}[]
	titleText?: string

	constructor(opts: GeneSetEditArg) {
		this.holder = opts.holder
		this.genome = opts.genome
		this.callback = opts.callback
		this.vocabApi = opts.vocabApi
		this.geneList = structuredClone(opts.geneList || [])
		this.tip2 = new Menu({ padding: '0px', parent_menu: opts.holder.node(), test: 'test' })
		if ('minNumGenes' in opts) this.minNumGenes = opts.minNumGenes
		if ('mode' in opts) this.mode = opts.mode
		if ('titleText' in opts) this.titleText = opts.titleText
		this.origLst = structuredClone(this.geneList)
		this.origNames = JSON.stringify(this.geneList.map(t => t.gene).sort())

		this.holder.selectAll('*').remove()
		const div = this.holder.append('div').style('padding', '5px')

		if (this.titleText) {
			div.append('div').style('margin-bottom', '10px').html(this.titleText)
		}

		const headerDiv = div.append('div')
		//.style('white-space','nowrap')
		const label = headerDiv.append('label')
		label.append('span').html('Search')
		const row = label.append('span')

		// a holder to render optional buttons
		const controlDiv = headerDiv
			.append('div')
			.style('display', 'inline-flex')
			.style('align-items', 'center')
			.style('float', 'right')
			.style('gap', '5px')

		this.geneSearch = addGeneSearchbox({
			tip: this.tip2,
			genome: this.genome,
			row,
			geneOnly: true,
			callback: this.addGene,
			hideHelp: true,
			focusOff: true
		})

		this.menuList = []

		this.api = {
			dom: {
				holder: div,
				tdbBtns: {},
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
	}

	getParams() {
		// if (this.mode == 'mutation' && this.vocabApi.termdbConfig?.queries?.topMutatedGenes) {
		//for testing
		if (this.vocabApi.termdbConfig?.queries?.topMutatedGenes) {
			if (this.vocabApi.termdbConfig.queries.topMutatedGenes.arguments) {
				for (const param of this.vocabApi.termdbConfig.queries.topMutatedGenes.arguments)
					this.api.topMutatedGenesParams.push({ param })
			}
		}
		if (this.mode == 'expression' && this.vocabApi.termdbConfig?.queries?.topVariablyExpressedGenes) {
			if (this.vocabApi.termdbConfig.queries.topVariablyExpressedGenes.arguments) {
				for (const param of this.vocabApi.termdbConfig.queries.topVariablyExpressedGenes.arguments)
					this.api.topVariablyExpressedGenesParams.push({ param })
			}
		}
	}

	createMenuList() {
		if (this.api?.topMutatedGenesParams.length > 0) {
			this.menuList.push({
				label: 'Top mutated genes &#9660;',
				callback: async () => {
					this.tip2.clear().showunder(this.api.dom.textControlDiv.node())
					new GenesMenu({
						tip: this.tip2,
						params: this.api.topMutatedGenesParams,
						api: this.api,
						callback: async () => {
							const args = {
								filter0: this.vocabApi.state.termfilter.filter0
							}
							for (const { param, input } of this.api.topMutatedGenesParams) {
								const id = input.attr('id')
								args[id] = this.getInputValue({ param, input })
							}
							const result = await this.vocabApi.getTopMutatedGenes(args)

							this.geneList = []
							this.geneList.push(...result.genes)
							this.renderGenes()
						}
					})
				}
			})
		}
		if (this.api?.topVariablyExpressedGenesParams.length > 0) {
			this.menuList.push({
				label: 'Top variably expressed genes &#9660;',
				callback: () => {
					this.tip2.clear().showunder(this.api.dom.textControlDiv.node())
					new GenesMenu({
						tip: this.tip2,
						params: this.api.topVariablyExpressedGenesParams,
						api: this.api,
						callback: async () => {
							const args: any = {
								genome: this.vocabApi.state.vocab.genome,
								dslabel: this.vocabApi.state.vocab.dslabel,
								maxGenes: 50
							}
							// supply filters from app state
							if (this.vocabApi.state.termfilter) {
								if (this.vocabApi.state.termfilter.filter) args.filter = this.vocabApi.state.termfilter.filter // pp filter
								if (this.vocabApi.state.termfilter.filter0) args.filter0 = this.vocabApi.state.termfilter.filter0 // gdc filter
							}
							const result = await this.vocabApi.getTopVariablyExpressedGenes(args)

							this.geneList = []
							if (result.genes) {
								for (const gene of result.genes) this.geneList.push({ gene })
							}
							this.renderGenes()
						}
					})
				}
			})
		}
		//Placeholder code for future PR
		// if (your.genesets) {
		// 	this.menuList.push({
		// 		label: `Your gene sets`,
		// 		callback: async () => {}
		// 	})
		// }
		if (this.genome?.termdbs?.msigdb) {
			for (const key in this.genome.termdbs) {
				const tdb = this.genome.termdbs[key]
				this.menuList.push({
					label: `${tdb.label} gene set &#9660;`,
					callback: async () => {
						this.tip2.clear().showunder(this.api.dom.textControlDiv.node())
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
	}

	renderTextControls(div: Div) {
		for (const menu of this.menuList) {
			div
				.append('a')
				.style('text-decoration', 'underline')
				.style('padding', '0px 10px')
				.style('color', 'black')
				.html(menu.label)
				.on('click', async () => {
					await menu.callback()
				})
		}
	}

	// addParameter(param, div: Div, apiParam: string) {
	// 	let input
	// 	if (param.type == 'boolean') {
	// 		input = div.append('input').attr('type', 'checkbox').attr('id', param.id)
	// 		if (param.value) input.property('checked', param.value)
	// 		div.append('label').html(param.label).attr('for', param.id)
	// 	}
	// 	//The parameter value will be used as the input value if the option is checked
	// 	else if (param.type == 'string' && param.value) {
	// 		input = div.append('input').attr('type', 'checkbox').attr('id', param.id)
	// 		input.property('checked', true)
	// 		div.append('label').html(param.label).attr('for', param.id)
	// 	} else if (param.type == 'number') {
	// 		input = div.append('input').attr('type', 'number').style('width', '40px').attr('id', param.id)
	// 		if (param.value) input.attr('value', param.value)
	// 		div.append('span').html(param.label)
	// 	}

	// }

	getInputValue({ param, input }) {
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
		if (!hasStat)
			this.geneList.sort((a, b) => {
				if (a.gene < b.gene) return -1
				if (a.gene > b.gene) return 1
				return 0
			})
		this.api.dom.geneHoldingDiv.selectAll('*').remove()

		// this.api.statColor2label = new Map()

		this.api.dom.geneHoldingDiv
			.selectAll('div')
			.data(this.geneList || [])
			.enter()
			.append('div')
			.attr('title', 'click to delete')
			.attr('class', 'sja_menuoption')
			.attr('tabindex', 0)
			.style('position', 'relative')
			.style('display', 'inline-block')
			.style('padding', '5px 16px 5px 9px')
			.style('margin-left', '5px')
			.each(this.renderGene)
			.on('click', this.deleteGene)
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
		const minNum = this.minNumGenes || 0
		this.api.dom.submitBtn.property('disabled', !hasChanged || this.geneList?.length < minNum)
		if (hasChanged) this.api.dom.submitBtn!.node()!.focus()
	}

	renderGene(this: any, gene) {
		const div = select(this).style('border-radius', '5px')

		if (gene.mutationStat) {
			div.html(`${gene.gene}&nbsp;&nbsp;`)
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
					if (!dt2color[m.dt]) throw 'invalid stat dt'
					bgcolor = dt2color[m.dt]
					textcolor = 'white' // hardcode it for now
					this.api.statColor2label.set(bgcolor, dt2label[m.dt])
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
			div.insert('div').style('display', 'inline-block').html(gene.gene)
		}
	}

	deleteGene(d) {
		const i = this.geneList.findIndex(g => g.gene === d.gene)
		if (i != -1) {
			this.geneList.splice(i, 1)
			this.renderGenes()
		}
	}
}
