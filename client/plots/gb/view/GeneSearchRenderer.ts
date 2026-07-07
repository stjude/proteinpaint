import { addGeneSearchbox, Menu } from '#dom'

export class GeneSearchRenderer {
	state: any
	holder: any
	opts: any
	interactions: any
	constructor(state, holder, opts, interactions) {
		this.state = state
		this.holder = holder
		this.opts = opts
		this.interactions = interactions
	}

	main() {
		this.renderGeneSearch()
		// A preset gene (e.g. from the mass omnisearch "Genome Browser" launch) opens this plot window
		// already showing the protein/genomic view buttons for that gene, without the user re-searching.
		// Picking a view transforms the window into the browser via interactions.onGeneSearch (the same
		// path as the interactive gene search below). Only reached when the ds allows both modes; a
		// mode-restricted ds is launched directly into its one allowed view by the caller.
		const preset = this.state.config.gbModeChooserGene
		if (preset?.geneSymbol && !this.state.config.geneSearchResult) {
			this.renderModeButtons(preset)
		}
	}

	renderGeneSearch() {
		const gbRestrictMode = this.opts.vocabApi.termdbConfig.queries.gbRestrictMode
		this.holder.selectAll('*').remove()
		const row = this.holder.append('div')
		row.append('span').html('Search')
		const arg: any = {
			tip: new Menu({ padding: '0px' }),
			genome: this.opts.genome,
			row,
			callback: async () => {
				// found a hit {chr,start,stop,geneSymbol}
				if (result.geneSymbol && !gbRestrictMode) {
					// user found a gene and no restricted mode from ds, ask user if to use either protein/genomic mode
					this.renderModeButtons(result)
					return
				}
				// only one possibility of gb mode and it can be auto determined
				await this.interactions.onGeneSearch(result, gbRestrictMode == 'protein')
			}
		}

		switch (gbRestrictMode) {
			case undefined:
				// not set. allowed
				break
			case 'genomic':
				// gb can only be block mode, add default coord to arg
				arg.defaultCoord = this.opts.vocabApi.termdbConfig.queries.defaultCoord
				break
			case 'protein':
				// gb can only be protein mode, only allow searching gene
				arg.searchOnly = 'gene'
				break
			default:
				throw 'unknown gbRestrictMode'
		}

		const result = addGeneSearchbox(arg)
	}

	/** Render the two view-choice buttons for a resolved gene hit {geneSymbol, chr, start, stop}.
	 * Clicking transforms the plot window into that view via interactions.onGeneSearch. Shared by the
	 * interactive gene search and the preset (omnisearch) launch. */
	renderModeButtons(result) {
		// on repeated gene search, detect if btndiv is present, and remove, avoiding showing duplicate buttons
		this.holder.select('.sjpp_gbmodebtndiv').remove()
		// create new div and buttons
		const btndiv = this.holder.append('div').attr('class', 'sjpp_gbmodebtndiv').style('margin-top', '10px')
		btndiv
			.append('button')
			.attr('data-testid', 'sjpp-gb-protein-view-btn')
			.style('margin-right', '10px')
			.text('Protein view of ' + result.geneSymbol)
			.on('click', async () => {
				await this.interactions.onGeneSearch(result, true)
			})
		// genomic view needs a coordinate; omit the button if the preset gene could not be resolved to one
		if (result.chr) {
			btndiv
				.append('button')
				.attr('data-testid', 'sjpp-gb-genomic-view-btn')
				.text('Genomic view of ' + result.geneSymbol)
				.on('click', async () => {
					await this.interactions.onGeneSearch(result, false)
				})
		}
	}
}
