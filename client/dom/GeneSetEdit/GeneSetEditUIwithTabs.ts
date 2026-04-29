import type { Div, Button } from '../../types/d3'
import { GeneSetEditUI, type GeneSetEditArg, type CallbackArg } from './GeneSetEditUI.ts'

const tabRadioSuffix = Math.random().toString().slice(-5)
let tabRadioIndex = 0

export class GeneSetEditUIwithTabs extends GeneSetEditUI {
	// holder: Elem
	// genome: ClientGenome
	// callback: (arg: CallbackArg) => void
	// /** termdb */
	// vocabApi: any
	// tip2: Menu
	// origLst: Gene[]
	// origNames: string
	// api: API
	// geneSearch: any //cheating
	// /** Objects detailing the menus to create above the api.dom.geneHoldingDiv as clickable links  */
	// menuList: MenuListEntry[] = []
	// mode?: 'geneVariant' | 'geneExpression'
	// minNumGenes?: number
	// maxNumGenes?: number
	// updateName: boolean // whether to update gene set name upon user input
	// nameInput?: any
	// geneList: Gene[]
	// titleText?: string
	// customInputs?: CustomInputs
	// limitedGenesList?: string[]
	// termsAsListed?: boolean
	opts: GeneSetEditArg
	tabRadioName!: string
	controlDiv!: Div
	quickApplyBtn!: Button
	presetMenu!: Div
	/** this corresponds to GeneSetEditUI.api.dom.defaultMenu */
	customMenu!: Div

	msigClickTerm?: (term: any) => void

	constructor(opts: GeneSetEditArg) {
		super(opts)
		this.opts = opts
		this.api.dom.defaultMenu.style('display', 'none')
		this.tabRadioName = `sjpp-geneset-tab-radio-${tabRadioIndex++}-${tabRadioSuffix}`
		const tabsDiv = this.api.dom.holder.insert('div', '.sja_genesetinput')
		this.setQuickMenu(tabsDiv)
		this.setPresetMenu(tabsDiv)
		this.setCustomMenu(tabsDiv)
	}

	setQuickMenu(tabsDiv: Div) {
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
				this.customMenu.style('display', 'none')
				this.api.dom.geneHoldingDiv.style('display', 'none')
				this.presetMenu.style('display', 'none')
				delete this.msigClickTerm
				this.quickApplyBtn.style('display', '')
			})
		topGenesLabel.append('span').text(`Top `)
		const numGenesInput = topGenesLabel
			.append('input')
			.attr('type', 'number')
			.style('width', '60px')
			.property('value', this.maxNumGenes)
		topGenesLabel.append('span').text(`${rankingType} genes`)
		this.quickApplyBtn = quickDiv
			.append('button')
			.style('margin-left', '10px')
			.html('Submit')
			.on('click', async () => {
				const numGenes = Number(numGenesInput.property('value'))
				this.quickApplyBtn.property('disabled', true)
				try {
					await this.setTopGenes(numGenes)
				} catch (error) {
					console.error(error)
				} finally {
					this.quickApplyBtn.property('disabled', false)
				}
			})
	}

	setPresetMenu(tabsDiv: Div) {
		const presetDiv = tabsDiv.append('div').style('min-height', '24px')
		const presetGenesLabel = presetDiv.append('label')
		presetGenesLabel
			.append('input')
			.attr('type', 'radio')
			.attr('name', this.tabRadioName)
			//.property('checked', true)
			.property('value', 'presetGenes')
			.on('change', () => {
				this.quickApplyBtn.style('display', 'none')
				this.api.dom.geneHoldingDiv.style('display', 'none')
				this.customMenu.style('display', 'none')
				this.presetMenu.selectAll('*').remove()
				this.msigClickTerm = term => {
					this.geneList = []
					const result: CallbackArg = { geneList: this.geneList }
					if (this.nameInput) result.name = this.nameInput.property('value')
					for (const gene of term._geneset) this.geneList.push({ gene: gene.symbol })
					this.callback(result)
					this.tip2.hide()
				}
				this.renderTextControls(this.presetMenu, m => m.isPreset === true)
				this.presetMenu.style('display', 'inline-block')
				this.presetMenu.node()?.firstChild?.dispatchEvent(new PointerEvent('click', { bubbles: true })) //click?.()
			})
		presetGenesLabel.append('span').text(`Prebuilt gene set`)
		this.presetMenu = presetDiv.append('div').style('display', 'inline-block')
	}

	setCustomMenu(tabsDiv) {
		const customDiv = tabsDiv.append('div').style('min-height', '24px')
		const customGenesLabel = customDiv.append('label')
		customGenesLabel
			.append('input')
			.attr('type', 'radio')
			.attr('name', this.tabRadioName)
			//.property('checked', true)
			.property('value', 'customGenes')
			.on('change', () => {
				this.quickApplyBtn.style('display', 'none')
				this.presetMenu.style('display', 'none')
				delete this.msigClickTerm
				this.api.dom.geneHoldingDiv.style('display', '')
				this.customMenu.style('display', '')
			})
		customGenesLabel.append('span').text(`Custom gene set`)

		this.customMenu = this.api.dom.defaultMenu // customDiv.append('div').style('display', 'none')
		//this.customMenu.append('p').text(`Search for genes, edit a computed top genes list, or edit an MSigDb gene set.`)
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
				maxGenes: numGenes || this.maxNumGenes
			}
			// XXX this is optional query!! if ds is missing then should show input ui instead
			// TODO why cannot use vocab method?
			// TODO purpose of 2nd and 3rd arguments?
			//const result = await dofetch3('termdb/topMutatedGenes', { method: 'GET', body })
			data = await this.vocabApi.getTopMutatedGenes(body)
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
		this.callback({ geneList: data.genes.map(gene => ({ gene })) })
	}
}
