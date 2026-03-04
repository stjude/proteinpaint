import { Menu, addGeneSearchbox, sayerror } from '#dom'
import { TermTypes } from '#shared/terms.js'
import { first_genetrack_tolist } from '#common/1stGenetk'

// TODO: currently, when inputting a single position (e.g. chr17:7661778 or chr17:7661778-7661778), the output is a region 400bp long. Need to support single position input.
// TODO: verify whether coordiante is 0-based or 1-based (need to do the same for other search handlers e.g. geneVariant.ts, snp.ts, etc.)

export class SearchHandler {
	opts: any
	callback: any
	app: any
	dom: any
	blockInstance: any
	init(opts) {
		this.opts = opts
		this.callback = opts.callback
		this.app = opts.app
		const holder = opts.holder.append('div').style('margin', '10px 0px')
		this.dom = {}
		this.dom.errDiv = holder.append('div').style('margin', '5px 0px').style('display', 'none')
		this.dom.geneSearchDiv = holder.append('div')
		this.dom.blockDiv = holder.append('div').style('display', 'none').style('margin', '20px 3px')
		const geneSearch = addGeneSearchbox({
			tip: new Menu({ padding: '0px' }),
			genome: opts.genomeObj,
			row: this.dom.geneSearchDiv,
			callback: async () => {
				try {
					await this.handleGeneSearch(geneSearch)
				} catch (e: any) {
					this.dom.errDiv.style('display', 'block')
					sayerror(this.dom.errDiv, 'Error: ' + (e.message || e))
					if (e.stack) console.log(e.stack)
				}
			}
		})
	}

	async handleGeneSearch(geneSearch) {
		if (geneSearch.geneSymbol) {
			// gene input
			// embed block of gene locus to allow navigation to region of interest
			const { chr, start, stop } = geneSearch
			if (!chr || !Number.isInteger(start) || !Number.isInteger(stop))
				throw new Error('unable to retrieve gene coordinate')

			this.dom.blockDiv.style('display', 'block')
			this.dom.blockDiv.append('div').style('opacity', 0.6).text('Navigate within browser to desired region')

			const arg: any = {
				holder: this.dom.blockDiv,
				genome: this.opts.genomeObj, // genome obj
				chr,
				start,
				stop,
				tklst: [],
				nobox: true,
				hidegenelegend: true,
				debugmode: this.opts.debug
			}
			first_genetrack_tolist(this.opts.genomeObj, arg.tklst)
			const _ = await import('#src/block')
			this.blockInstance = new _.Block(arg)

			this.dom.submitBtn = this.dom.blockDiv
				.append('div')
				.style('margin', '10px 0px')
				.append('button')
				.style('border', 'none')
				.style('border-radius', '20px')
				.style('padding', '10px 15px')
				.text('Submit Region')
				.on('click', async () => {
					const { chr, start, stop } = this.blockInstance.rglst[0]
					const term = this.makeTerm({ chr, start, stop })
					await this.callback(term)
				})
		} else if (geneSearch.chr && Number.isInteger(geneSearch.start) && Number.isInteger(geneSearch.stop)) {
			// coordinate input
			// directly use coordinate to make term
			const { chr, start, stop } = geneSearch
			const term = this.makeTerm({ chr, start, stop })
			await this.callback(term)
		} else {
			throw new Error('invalid gene search input')
		}
	}

	makeTerm(opts) {
		const { chr, start, stop } = opts
		if (!chr || !Number.isInteger(start) || !Number.isInteger(stop)) throw new Error('invalid coordinate')
		const coord = `${chr}:${start}-${stop}`
		const unit = this.app.vocabApi.termdbConfig.queries.dnaMethylation?.unit || 'Average Beta Value'
		const term = {
			id: coord,
			chr,
			start,
			stop,
			name: `${coord} ${unit}`, // will also allow to be user-assigned
			type: TermTypes.DNA_METHYLATION
		}
		return term
	}
}
