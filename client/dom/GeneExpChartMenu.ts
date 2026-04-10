import type { ClientGenome } from '../types/clientGenome'
import type { AppApi } from 'rx/src/AppApi'
import { addGeneSearchbox, FlyoutMenu, type FlyoutMenuOption, GeneSetEditUI, Menu, sayerror } from '#dom'
import { GENE_EXPRESSION, SINGLECELL_GENE_EXPRESSION } from '#shared/terms.js'
import { getGEunit } from '../tw/geneExpression'
import { getSCGEunit } from '../tw/singleCellGeneExpression'

/****** For mass plots only *******
 * Reuseable menu for gene expression chart buttons
 * Shows the use options before launching the appropriate
 * selection menu.
 *
 * Used in charts.js and SC app
 *
 * Should clear and show tip before calling this menu instance.
 * See .clickTo() implementation in charts.js */

type ScopedGeneExpTerm = {
	gene?: string
	name?: string
	type: string // see enabledTermTypes set for valid values
}

type GeneExpChartMenuOpts = {
	/** see enabledTermTypes set for valid values */
	termType?: string
	/** Add more menu options for special use cases. For example may want to add
	 * more clickable options under new headers. */
	additionalOptions?: FlyoutMenuOption[]
	/** Add needed properties to the resulting terms as needed (e.g. for scct terms, the sample) */
	termProperties?: { [key: string]: any }
	/** Pass needed properties to the spawning plot (e.g. .parentID, hidePlotFilter, etc.) */
	spawnConfig?: { [key: string]: any }
}

const enabledTermTypes = new Set([GENE_EXPRESSION, SINGLECELL_GENE_EXPRESSION])

export class GeneExpChartMenu {
	app: AppApi
	genome: ClientGenome
	tip: Menu
	unit: string
	message?: string
	flyout?: FlyoutMenu
	//Supports adding menu options for special use cases
	additionalOptions: FlyoutMenuOption[]
	termType: string
	/** Helper function to create term with any additional properties */
	makeTerm: (term: any) => object
	/** Helper function to create config or the spawning plot with
	 * any additional properties. Used in the violin, scatter, and heirCluster */
	makeConfig: (config: any) => object

	constructor(app: AppApi, tip: Menu, opts: GeneExpChartMenuOpts = {}) {
		this.termType = opts?.termType || GENE_EXPRESSION
		if (!enabledTermTypes.has(this.termType)) {
			throw new Error(`Invalid termType: ${this.termType}`)
		}
		this.app = app
		this.genome = app.opts.genome
		this.tip = tip
		this.unit = this.termType === GENE_EXPRESSION ? getGEunit(this.app.vocabApi) : getSCGEunit(this.app.vocabApi)
		this.additionalOptions = opts?.additionalOptions || []

		const termProperties = opts?.termProperties || {}
		this.makeTerm = term => ({ ...term, ...termProperties, type: this.termType, unit: this.unit })

		const spawnConfig = opts?.spawnConfig || {}
		this.makeConfig = config => ({ ...config, ...spawnConfig })

		this.renderMenu()
	}

	renderMenu() {
		const _options: FlyoutMenuOption[] = [
			{
				label: 'Single gene summary',
				isSubmenu: true,
				callback: (holder, closeMenus) => {
					this.renderGeneSelect(holder, closeMenus)
				}
			},
			{
				label: 'Two gene comparison',
				isSubmenu: true,
				callback: (holder, closeMenus) => {
					this.renderTwoGeneSelect(holder, closeMenus)
				}
			},
			{
				label: 'Multiple genes for hierarchical clustering ',
				isSubmenu: true,
				callback: (holder, closeMenus) => {
					this.renderGeneMultiSelect(holder, closeMenus)
				}
			}
		]

		this.flyout = new FlyoutMenu({
			tip: this.tip,
			header: `Choose ${this.unit != 'Gene Expression' ? this.unit : ''} gene expression:`,
			options: [..._options, ...this.additionalOptions]
		})

		if (this.message) {
			this.tip.d.append('div').style('padding-top', '10px').style('opacity', '0.7').html(this.message)
		}
	}

	/** Launch summary plot for gene expression data
	 * for one gene. */
	renderGeneSelect(holder, closeMenus) {
		const tip = holder
		const row = tip.append('div').style('padding', '5px')
		row.append('span').style('font-weight', 'bold').text('Select a gene:')

		const geneSearch = addGeneSearchbox({
			row,
			genome: this.genome,
			tip: new Menu({ padding: '0px' }),
			searchOnly: 'gene',
			callback: async () => {
				const tw = {
					term: this.makeTerm({
						gene: geneSearch.geneSymbol,
						name: `${geneSearch.geneSymbol} ${this.unit}`
					})
				}
				closeMenus()
				this.app.dispatch({
					type: 'plot_create',
					config: this.makeConfig({
						chartType: 'summary',
						term: tw
					})
				})
			}
		})
	}

	/** Guide the user to select the first gene then
	 * a second to launch the summary plot on submit.*/
	renderTwoGeneSelect(holder, closeMenus) {
		const term: Partial<ScopedGeneExpTerm> = {}
		const term2: Partial<ScopedGeneExpTerm> = {}

		const gene1row = holder.append('div').style('padding', '5px')
		const gene2row = holder.append('div').style('padding', '5px').style('display', 'none')

		gene1row.append('span').style('font-weight', 'bold').text('Select 1st gene:')
		const geneSearch1 = addGeneSearchbox({
			row: gene1row,
			genome: this.genome,
			tip: new Menu({ padding: '0px' }),
			searchOnly: 'gene',
			callback: async () => {
				gene2row.style('display', 'block')
				if (!geneSearch1.geneSymbol) throw new Error('First gene result is required')
				term.gene = geneSearch1.geneSymbol
				term.name = `${geneSearch1.geneSymbol} ${this.unit}`
			}
		})

		gene2row.append('span').style('font-weight', 'bold').text('Select 2nd gene:')
		const geneSearch2 = addGeneSearchbox({
			row: gene2row,
			genome: this.genome,
			tip: new Menu({ padding: '0px' }),
			searchOnly: 'gene',
			callback: async () => {
				if (!geneSearch2.geneSymbol) throw new Error('Second gene result is required')
				term2.gene = geneSearch2.geneSymbol
				term2.name = `${geneSearch2.geneSymbol} ${this.unit}`
			}
		})

		//Submit button
		holder
			.append('button')
			.text('Submit')
			.style('margin', '5px')
			.on('click', () => {
				if (!term.name || !term.gene) {
					sayerror(holder, 'Missing first gene. Please provide a valid gene.')
					return
				}
				if (!term2.name || !term2.gene) {
					sayerror(holder, 'Missing second gene. Please provide a valid gene.')
					return
				}

				closeMenus()
				this.app.dispatch({
					type: 'plot_create',
					config: this.makeConfig({
						chartType: 'summary',
						term: { term: this.makeTerm(term) },
						term2: { term: this.makeTerm(term2) }
					})
				})
			})
	}
	/** Render the GeneSetEdit UI for selection and then
	 * launch the hierarchical clustering on submit.*/
	renderGeneMultiSelect(holder, closeMenus) {
		const grpWrapper = holder.append('div').style('padding', '5px')
		grpWrapper.append('span').style('font-weight', 'bold').text('Group name:')

		let customName: string = 'New custom group'
		const input = grpWrapper
			.append('input')
			.style('margin', '2px 5px')
			.style('width', '210px')
			.attr('placeholder', 'Group Name')
			.on('input', () => {
				customName = input.property('value')
			})

		new GeneSetEditUI({
			holder: holder.append('div'),
			/** running hier clustering and the editing group
			 * is the group used for clustering pass this mode
			 * value to inform ui to support the optional button
			 * "top variably exp gene" this is hardcoded for
			 * the purpose of gene expression and should be improved. */
			genome: this.genome,
			mode: 'geneExpression',
			vocabApi: this.app.vocabApi,
			callback: async ({ geneList, name }) => {
				if (geneList.length <= 2) {
					return alert('At least three genes are required for hierarchical clustering. Please select more genes.')
				}

				const group: { name: string; lst: { [index: string]: any }[]; type: string } = {
					name: name || customName,
					lst: [],
					type: 'hierCluster'
				}
				/** Unclear why group.lst logic from the initialized const
				 * above was originally implemented. Logic copied several
				 * times from matrix -> hierClust -> charts -> this file
				 * without changes.
				 * Leave for now until the reason becomes apparent or
				 * delete at a later date. */
				// const lst = group.lst.filter((tw: { [index: string]: any }) => tw.term.type != 'geneVariant')
				const tws = await Promise.all(
					geneList.map(async (d: any) => {
						const gene: string = d.symbol || d.gene
						const name = `${gene} ${this.unit}`
						const term = this.makeTerm({ gene, name })
						//if it was present use the previous term, genomic range terms require chr, start and stop fields, found in the original term
						// let tw: any = group.lst.find((tw: any) => tw.term.name == name)
						// if (!tw) tw = { term, q: {} }
						return { term, q: {} }
					})
				)
				group.lst = [...tws]
				/** Hold over code from previous implementation in charts.js
				 * If group.lst is empty, do not remove any genes from tws. */
				// group.lst = [...lst, ...tws]
				// if (!group.lst.length) {
				// 	const selectedGroup = {
				// 		index: 0,
				// 		name,
				// 		label: name,
				// 		lst: [],
				// 		status: 'new'
				// 	}
				// 	tg.splice(selectedGroup.index, 1)
				// }

				closeMenus()
				this.app.dispatch({
					type: 'plot_create',
					config: this.makeConfig({
						chartType: 'hierCluster',
						termgroups: [group],
						//TODO: Need to allow singleCellGeneExpression as well
						dataType: 'geneExpression'
					})
				})
			}
		})
	}
}
