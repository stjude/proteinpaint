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
	}

	renderGeneSearch() {
		const gbRestrictMode = this.opts.vocabApi.termdbConfig.queries.gbRestrictMode
		const row = this.holder.append('div').style('margin-top', '20px')
		row.append('span').html('Search')
		const arg: any = {
			tip: new Menu({ padding: '0px' }),
			genome: this.opts.genome,
			row,
			callback: async () => {
				// found a hit {chr,start,stop,geneSymbol}
				if (result.geneSymbol && !gbRestrictMode) {
					// user found a gene and no restricted mode from ds, ask user if to use either protein/genomic mode

					// on repeated gene search, detect if btndiv is present, and remove, avoiding showing duplicate buttons
					this.holder.select('.sjpp_gbmodebtndiv').remove()
					// create new div and buttons
					const btndiv = this.holder.append('div').attr('class', 'sjpp_gbmodebtndiv').style('margin-top', '10px')
					btndiv
						.append('button')
						.style('margin-right', '10px')
						.text('Protein view of ' + result.geneSymbol)
						.on('click', async () => {
							await this.interactions.onGeneSearch(result, true)
						})
					btndiv
						.append('button')
						.text('Genomic view of ' + result.geneSymbol)
						.on('click', async () => {
							await this.interactions.onGeneSearch(result, false)
						})
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
}
