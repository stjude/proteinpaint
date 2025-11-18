import type { ClientGenome } from '../types/clientGenome'
import type { AppApi } from 'rx/src/AppApi'
import { addGeneSearchbox, GeneSetEditUI, make_radios, Menu } from '#dom'
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
	holder: any
	tip: Menu
	unit: string
	message?: string

	constructor(app: AppApi, tip: Menu, message?: string) {
		this.app = app
		this.genome = app.opts.genome
		this.tip = tip
		//Append a div to prevent styling applying to later tip contents
		this.holder = this.tip.d.append('div').attr('class', 'sjpp-gene-exp-chart-menu').style('padding', '10px')
		this.unit = this.app.vocabApi.termdbConfig.queries.geneExpression?.unit || 'Gene Expression'
		if (message) this.message = message

		this.renderMenu()
	}

	renderMenu() {
		const radioWrapper = this.holder.append('div')
		radioWrapper.append('span').style('font-weight', 'bold').text('Choose gene expression option:')

		make_radios({
			holder: radioWrapper.append('div').style('padding-top', '5px'),
			options: [
				{ value: 1, label: '1 gene for expression' /** title: 'Show expression chart for 1 gene'*/ },
				{ value: 2, label: '2 genes for summary' /** title: 'Show summary chart for 2 genes'*/ },
				{
					value: 3,
					label:
						'Multiple genes for hierarchical clustering' /** title: 'Show hierarchical clustering for multiple genes'*/
				}
			],
			styles: { margin: '5px' },
			inputName: 'gene-exp-chart-type',
			callback: (value: number) => {
				radioWrapper.remove()
				if (value === 1) this.renderGeneSelect()
				else if (value === 2) this.renderTwoGeneSelect()
				else this.renderGeneMultiSelect()
			}
		})

		if (this.message) {
			radioWrapper.append('div').style('padding-top', '10px').style('opacity', '0.7').html(this.message)
		}
	}

	/** Delete all contents and return to the radio
	 *  buttons for option selection. */
	renderBackBtn() {
		this.holder
			.append('span')
			.classed('sja_clbtext', true)
			.style('padding-bottom', '5px')
			.html('&laquo; Back')
			.on('click', () => {
				this.holder.selectAll('*').remove()
				this.renderMenu()
			})
	}

	/** Launch summary plot for gene expression data
	 * for one gene. */
	renderGeneSelect() {
		this.renderBackBtn()
		const tip = this.holder
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
				this.tip.hide()
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
	renderTwoGeneSelect() {
		this.renderBackBtn()
		const term: { [index: string]: string } = { type: TermTypes.GENE_EXPRESSION }
		const term2: { [index: string]: string } = { type: TermTypes.GENE_EXPRESSION }

		const gene1row = this.holder.append('div').style('padding', '5px')
		const gene2row = this.holder.append('div').style('padding', '5px').style('display', 'none')

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
		this.holder
			.append('button')
			.text('Submit')
			.style('margin', '5px')
			.on('click', () => {
				if (!term.name || !term.gene) return alert('Missing first gene. Please provide a valid gene.')
				if (!term2.name || !term2.gene) return alert('Missing second gene. Please provide a valid gene.')

				this.tip.hide()
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
	renderGeneMultiSelect() {
		this.renderBackBtn()
		const grpWrapper = this.holder.append('div').style('padding', '5px')
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
			holder: this.holder.append('div'),
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
				this.tip.hide()

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
