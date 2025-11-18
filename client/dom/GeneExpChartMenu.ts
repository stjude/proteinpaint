import type { ClientGenome } from '../types/clientGenome'
import type { AppApi } from 'rx/src/AppApi'
import { addGeneSearchbox, FlyoutMenu, GeneSetEditUI, Menu } from '#dom'
import { TermTypes } from '#shared/terms.js'

/****** For mass plots only *******
 * Reuseable menu for gene expression chart buttons
 * Shows the use options before launching the appropriate
 * selection menu.
 *
 * Used in charts.js and SC app
 *
 * Should clear and show tip before calling this menu instance.
 * See .clickTo() implementation in charts.js */
export class GeneExpChartMenu {
	app: AppApi
	genome: ClientGenome
	tip: Menu
	unit: string
	message?: string
	flyout?: FlyoutMenu

	constructor(app: AppApi, tip: Menu, message?: string) {
		this.app = app
		this.genome = app.opts.genome
		this.tip = tip
		this.unit = this.app.vocabApi.termdbConfig.queries.geneExpression?.unit || 'Gene Expression'
		if (message) this.message = message

		this.renderMenu()
	}

	renderMenu() {
		const options = [
			{
				id: 'single',
				label: 'Single gene summary',
				isSubmenu: true,
				callback: holder => {
					this.renderGeneSelect(holder)
				}
			},
			{
				id: 'two',
				label: 'Two gene comparison',
				isSubmenu: true,
				callback: holder => {
					this.renderTwoGeneSelect(holder)
				}
			},
			{
				id: 'multi',
				label: 'Multiple genes for hierarchical clustering ',
				isSubmenu: true,
				callback: holder => {
					this.renderGeneMultiSelect(holder)
				}
			}
		]

		this.flyout = new FlyoutMenu({
			tip: this.tip,
			header: `Choose ${this.unit != 'Gene Expression' ? this.unit : ''} gene expression:`,
			options
		})

		if (this.message) {
			this.tip.d.append('div').style('padding-top', '10px').style('opacity', '0.7').html(this.message)
		}
	}

	/** Launch summary plot for gene expression data
	 * for one gene. */
	renderGeneSelect(holder) {
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
					term: {
						gene: geneSearch.geneSymbol,
						name: `${geneSearch.geneSymbol} ${this.unit}`,
						type: TermTypes.GENE_EXPRESSION
					}
				}
				this.flyout?.closeMenus()
				this.app.dispatch({
					type: 'plot_create',
					config: {
						chartType: 'summary',
						term: tw
					}
				})
			}
		})
	}

	/** Guide the user to select the first gene then
	 * a second to launch the summary plot on submit.*/
	renderTwoGeneSelect(holder) {
		const term: { [index: string]: string } = { type: TermTypes.GENE_EXPRESSION }
		const term2: { [index: string]: string } = { type: TermTypes.GENE_EXPRESSION }

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
				if (!term.name || !term.gene) return alert('Missing first gene. Please provide a valid gene.')
				if (!term2.name || !term2.gene) return alert('Missing second gene. Please provide a valid gene.')

				this.flyout?.closeMenus()
				this.app.dispatch({
					type: 'plot_create',
					config: {
						chartType: 'summary',
						term: { term: term },
						term2: { term: term2 }
					}
				})
			})
	}

	/** Render the GeneSetEdit UI for selection and then
	 * launch the hierarchical clustering on submit.*/
	renderGeneMultiSelect(holder) {
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
				if (geneList.length === 0) {
					return alert('No genes selected. Please select at least one gene.')
				}
				if (geneList.length <= 2) {
					return alert('At least three genes are required for hierarchical clustering. Please select more genes.')
				}

				const group: { name: string; lst: { [index: string]: any }[]; type: string } = {
					name: name || customName,
					lst: [],
					type: 'hierCluster'
				}
				const lst = group.lst.filter((tw: { [index: string]: any }) => tw.term.type != 'geneVariant')
				const tws = await Promise.all(
					geneList.map(async (d: any) => {
						const gene: string = d.symbol || d.gene
						const name = `${gene} ${this.unit}`
						const term = { gene, name, type: TermTypes.GENE_EXPRESSION }
						//if it was present use the previous term, genomic range terms require chr, start and stop fields, found in the original term
						const tw: { [index: string]: any } = group.lst.find((tw: any) => tw.term.name == name) || { term, q: {} }
						return tw
					})
				)
				group.lst = [...lst, ...tws]
				if (!group.lst.length) {
					const selectedGroup = {
						index: 0,
						name,
						label: name,
						lst: [],
						status: 'new'
					}
					tws.splice(selectedGroup.index, 1)
				}

				this.flyout?.closeMenus()
				this.app.dispatch({
					type: 'plot_create',
					config: {
						chartType: 'hierCluster',
						termgroups: [group],
						dataType: TermTypes.GENE_EXPRESSION
					}
				})
			}
		})
	}
}
