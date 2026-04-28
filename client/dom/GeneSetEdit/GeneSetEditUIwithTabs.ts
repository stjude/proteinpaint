import { addGeneSearchbox } from '../genesearch.ts'
import { Menu } from '#dom'
import { select } from 'd3-selection'
import { mclass, dt2color, dt2label } from '#shared/common.js'
import { TermTypes } from '#shared/terms.js'
import type { Div, Elem } from '../../types/d3'
import type { ClientGenome } from '../../types/clientGenome'
import { GenesMenu } from './GenesMenu'
import { addButton } from './addButton.ts'
import { dofetch3 } from '#common/dofetch'
import { getNormalRoot } from '#filter/filter'
import type { API, Gene, CallbackArg, CustomInputs, GeneSetEditArg, MenuListEntry } from './GeneSetEditUI.ts'

const tabRadioSuffix = Math.random().toString().slice(-5)
let tabRadioIndex = 0

export class GeneSetEditUIwithTabs {
	holder: Elem
	genome: ClientGenome
	callback: (arg: CallbackArg) => void
	/** termdb */
	vocabApi: any
	tip2: Menu
	origLst: Gene[]
	origNames: string
	api: API
	geneSearch: any //cheating
	/** Objects detailing the menus to create above the api.dom.geneHoldingDiv as clickable links  */
	menuList: MenuListEntry[] = []
	mode?: 'geneVariant' | 'geneExpression'
	minNumGenes?: number
	maxNumGenes?: number
	updateName: boolean // whether to update gene set name upon user input
	nameInput?: any
	geneList: Gene[]
	titleText?: string
	customInputs?: CustomInputs
	limitedGenesList?: string[]
	termsAsListed?: boolean
	tabRadioName: string
	msigClickTerm?: (term: any) => void

	constructor(opts: GeneSetEditArg) {
		this.holder = opts.holder
		this.genome = opts.genome
		this.callback = opts.callback
		this.vocabApi = opts.vocabApi
		this.termsAsListed = opts.termsAsListed
		this.customInputs = opts.customInputs
		this.geneList = structuredClone(opts.geneList || [])
		const parent_menu = opts.holder?.node()?.closest('.sja_menu_div') || opts.holder.node()
		this.tip2 = new Menu({ padding: '0px', parent_menu, test: 'test' })
		this.updateName = true
		this.minNumGenes = opts.minNumGenes || 0
		if ('maxNumGenes' in opts) this.maxNumGenes = opts.maxNumGenes
		if ('mode' in opts) this.mode = opts.mode
		if ('titleText' in opts) this.titleText = opts.titleText
		this.origLst = structuredClone(this.geneList)
		this.origNames = opts.termsAsListed
			? JSON.stringify(this.geneList.map(t => t.gene))
			: JSON.stringify(this.geneList.map(t => t.gene).sort())

		this.tabRadioName = `sjpp-geneset-tab-radio-${tabRadioIndex++}-${tabRadioSuffix}`
		this.setDom(opts)
	}

	setDom(opts) {
		this.holder.selectAll('*').remove()
		const div = this.holder.append('div').attr('class', 'sja_genesetinput').style('padding', '5px')

		if (this.titleText) {
			div.append('div').style('margin-bottom', '10px').html(this.titleText)
		}
		if (opts.limitedGenesList) {
			this.limitedGenesList = opts.limitedGenesList
		}

		const headerDiv = div.append('div')
		const tabsDiv = headerDiv.append('div')

		const quickDiv = tabsDiv.append('div').style('min-height', '24px')
		const topGenesLabel = quickDiv.append('label')
		const rankingType = this.mode == 'geneVariant' ? 'mutated' : 'variably expressed'
		topGenesLabel
			.append('input')
			.attr('type', 'radio')
			.attr('name', this.tabRadioName)
			.property('checked', true)
			.property('value', 'topGenes')
			.on('change', () => {
				customMenu.style('display', 'none')
				this.api.dom.geneHoldingDiv.style('display', 'none')
				presetMenu.style('display', 'none')
				delete this.msigClickTerm
				quickApplyBtn.style('display', '')
			})
		topGenesLabel.append('span').text(`Top `)
		const numGenesInput = topGenesLabel
			.append('input')
			.attr('type', 'number')
			.style('width', '60px')
			.property('value', this.maxNumGenes)
		topGenesLabel.append('span').text(`${rankingType} genes`)
		const quickApplyBtn = quickDiv
			.append('button')
			.style('margin-left', '10px')
			.html('Submit')
			.on('click', () => {
				this.setTopGenes(Number(numGenesInput.property('value')))
			})

		const presetDiv = tabsDiv.append('div').style('min-height', '24px')
		const presetGenesLabel = presetDiv.append('label')
		presetGenesLabel
			.append('input')
			.attr('type', 'radio')
			.attr('name', this.tabRadioName)
			//.property('checked', true)
			.property('value', 'presetGenes')
			.on('change', () => {
				quickApplyBtn.style('display', 'none')
				this.api.dom.geneHoldingDiv.style('display', 'none')
				customMenu.style('display', 'none')
				presetMenu.selectAll('*').remove()
				this.msigClickTerm = term => {
					this.geneList = []
					const result: CallbackArg = { geneList: this.geneList }
					if (this.nameInput) result.name = this.nameInput.property('value')
					for (const gene of term._geneset) this.geneList.push({ gene: gene.symbol })
					console.log(228, this.geneList)
					this.callback(result)
					this.tip2.hide()
				}
				this.renderTextControls(presetMenu, m => !m.isPreset)
				console.log(131, presetMenu)
				presetMenu.style('display', 'inline-block')
				presetMenu.node()?.firstChild?.dispatchEvent(new PointerEvent('click', { bubbles: true })) //click?.()
			})
		presetGenesLabel.append('span').text(`Preset gene set`)
		const presetMenu = presetDiv.append('div').style('display', 'inline-block')

		const customDiv = tabsDiv.append('div').style('min-height', '24px')
		const customGenesLabel = customDiv.append('label')
		customGenesLabel
			.append('input')
			.attr('type', 'radio')
			.attr('name', this.tabRadioName)
			//.property('checked', true)
			.property('value', 'customGenes')
			.on('change', () => {
				quickApplyBtn.style('display', 'none')
				presetMenu.style('display', 'none')
				delete this.msigClickTerm
				this.api.dom.geneHoldingDiv.style('display', '')
				customMenu.style('display', '')
			})
		customGenesLabel.append('span').text(`Custom gene set`)

		const customMenu = customDiv.append('div').style('display', 'none')
		customMenu.append('p').text(`Search for genes, edit a computed top genes list, or edit an MSigDb gene set.`)

		const label = customMenu.append('label')
		label.append('span').html('Search')
		const row = label
			.append('div')
			.style('display', 'inline-flex')
			.style('align-items', 'center')
			.style('margin', '8px 0px -5px 0px')

		// a holder to render optional buttons
		const controlDiv = customMenu
			.append('div')
			.style('display', 'inline-flex')
			.style('align-items', 'center')
			.style('float', 'right')
			.style('gap', '5px')

		const addGene = this.addGene.bind(this)
		this.geneSearch = addGeneSearchbox({
			testid: 'sjpp-geneSetEditUi-geneSearchInput',
			tip: this.tip2,
			genome: this.genome,
			row,
			searchOnly: 'genes',
			callback: addGene,
			hideHelp: true,
			focusOff: true
		})

		if (opts.nameInput) {
			// display input for geneset name
			const nameDiv = row.append('div').style('margin-left', '10px')
			nameDiv.append('span').text('Name')
			this.nameInput = nameDiv
				.append('input')
				.attr('data-testid', 'sja_genesetinput_name')
				.attr('type', 'text')
				.style('width', '150px')
		}

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
						this.updateName = true
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
				geneHoldingDiv: this.renderGeneHoldingDiv(customMenu.append('div')),
				statLegendDiv: div.append('div'),
				submitBtn: addButton({
					div: customMenu.append('div').style('margin-top', '10px'),
					testid: 'sjpp-genesetedit-submitbtn',
					text: 'Submit',
					disabled: !this.geneList?.length,
					callback: () => {
						if (this.maxNumGenes && this.geneList.length > this.maxNumGenes) {
							window.alert(
								`Gene set size (${this.geneList.length} genes) exceeds the allowed limit (${this.maxNumGenes} genes).`
							)
							return
						}
						console.log(335, this.geneList)
						this.api.dom.submitBtn.property('disabled', true).text('Loading...') // to prevent repeated clicking and triggering callback. when this ui is used in geneVariant tw edit, it can keep showing a while after user clicks btn thus this fix is needed
						const result: CallbackArg = { geneList: this.geneList }
						if (this.nameInput) result.name = this.nameInput.property('value')
						this.callback(result)
					}
				})
			},
			topMutatedGenesParams: [],
			topVariablyExpressedGenesParams: [],
			statColor2label: new Map(),
			destroy: () => {
				this.tip2.destroy()
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
					/** Create a copy to avoid mutating the args in the state */
					const copy = structuredClone(this.api.topVariablyExpressedGenesParams)
					copy
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
							if (this.vocabApi.state.termfilter.filter)
								args.filter = getNormalRoot(this.vocabApi.state.termfilter.filter) // pp filter
							if (this.vocabApi.state.termfilter.filter0) args.filter0 = this.vocabApi.state.termfilter.filter0 // gdc filter
						}

						this.getInputs(copy, args)
						const result = await dofetch3('termdb/topVariablyExpressedGenes', { method: 'GET', body: args })

						this.geneList = []
						if (result.genes) {
							for (const gene of result.genes) this.geneList.push({ gene })
						}
						this.renderGenes()
					}

					const menuArgs = Object.assign(this.baseGeneMenuArgs(copy), { callback })
					new GenesMenu(menuArgs)
				}
			})
		}
		if (this.genome?.termdbs?.msigdb) {
			for (const key of Object.keys(this.genome.termdbs)) {
				console.log(462, key)
				const tdb = this.genome.termdbs[key]
				this.menuList.push({
					isPreset: true,
					label: `${tdb.label} gene set`,
					callback: event => this.showMSigDbTree(event, key)
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

	async showMSigDbTree(event, key) {
		this.tip2.clear().showunder(event.target) //this.api.dom.textControlDiv.node()!)
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
				click_term:
					this.msigClickTerm ||
					(term => {
						this.geneList = []
						const geneset = term._geneset
						if (geneset) {
							for (const gene of geneset) this.geneList.push({ gene: gene.symbol })
							this.renderGenes(term.name)
							// disable name update to retain msigdb gene set name
							// when user modifies gene set
							this.updateName = false
						}
						this.tip2.hide()
						this.api.dom.submitBtn.node()!.focus()
					})
			}
		})
	}

	renderTextControls(div: Div, excludeFilter?: (m: MenuListEntry) => boolean) {
		for (const menu of this.menuList) {
			if (excludeFilter?.(menu)) continue
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

	/** Get the input value for the entire menu */
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

	/** Get value for single input based on type */
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
		if (this.geneSearch.geneSymbol) {
			const gene = this.geneSearch.geneSymbol
			for (const item of this.geneList) {
				if (item.gene == gene) {
					window.alert(`The gene ${gene} has already been added`)
					return
				}
			}
			if (gene) this.geneList.push({ gene })
		} else if (this.geneSearch.genes) {
			const newGenes: Gene[] = []
			const duplicates: string[] = []

			for (const geneObj of this.geneSearch.genes) {
				const geneName = geneObj.geneSymbol
				const isDuplicate = this.geneList.some(item => item.gene === geneName)
				if (isDuplicate) {
					duplicates.push(geneName)
				} else {
					newGenes.push({ gene: geneName })
				}
			}

			if (newGenes.length > 0) {
				this.geneList.push(...newGenes)
			}

			if (duplicates.length > 0) {
				window.alert(`The following genes were already added and skipped: ${duplicates.join(', ')}`)
			}
		}
		this.renderGenes()
	}

	renderGenes(geneSetName?: string) {
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
			.attr('data-testid', `sjpp-delete-gene-option`)
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

		if (this.nameInput && this.updateName) {
			this.nameInput.property('value', geneSetName || this.geneList.map(g => g.gene).join(', '))
		}

		this.api.dom.clearBtn.property('disabled', !this.geneList?.length)
		const hasChanged =
			this.origNames !==
			(this.termsAsListed
				? JSON.stringify(this.geneList.map(t => t.gene))
				: JSON.stringify(this.geneList.map(t => t.gene).sort()))
		this.api.dom.restoreBtn?.property('disabled', !hasChanged)
		// disable submit button when gene list not changed or is empty in expression mode
		this.api.dom.submitBtn.property(
			'disabled',
			!hasChanged || (this.minNumGenes && this.geneList?.length < this.minNumGenes) || !this.geneList?.length
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

	async setTopGenes(numGenes = 0) {
		// let waitDiv
		// if (this.opts.showWaitMessage) {
		// 	waitDiv = this.dom.body.append('div').style('margin', '20px')
		// 	this.opts.showWaitMessage(waitDiv)
		// }

		// genes are not predefined. query to get top genes using the current cohort
		let data
		if (this.mode == 'geneVariant') {
			const body = {
				maxGenes: this.maxNumGenes,
				geneFilter: this.geneFilter
			}
			// XXX this is optional query!! if ds is missing then should show input ui instead
			// TODO why cannot use vocab method?
			// TODO purpose of 2nd and 3rd arguments?
			data = await this.vocabApi.getTopVariablyExpressedGenes(body)
		} else if (this.mode == 'geneExpression') {
			const body = {
				//genome: this.vocabApi.state.vocab.genome,
				//dslabel: this.vocabApi.state.vocab.dslabel,
				maxGenes: numGenes || this.maxNumGenes
			}
			// XXX this is optional query!! if ds is missing then should show input ui instead
			data = await this.vocabApi.getTopVariablyExpressedGenes(body)
		} else {
			throw 'unknown opts.mode [geneset.js]'
		}

		if (!data) throw 'invalid server response'
		if (data.error) throw data.error

		if (!data.genes) return [] // do not throw and halt. downstream will detect no genes and handle it by showing edit ui
		//waitDiv.remove()
		//this.dom.loadingOverlay?.style('display', 'none')
		this.callback({ geneList: data.genes })
	}

	async getTwLst(genes) {
		return await Promise.all(
			// do tempfix of "data.genes.slice(0,3).map" for faster testing
			genes.map(async i =>
				typeof i == 'string'
					? await fillTermWrapper({ term: { gene: i, type: this.opts.mode } }, this.app.vocabApi)
					: await fillTermWrapper({ term: { gene: i.gene || i.name, type: this.opts.mode } }, this.app.vocabApi)
			)
		)
	}
}
