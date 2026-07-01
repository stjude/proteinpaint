import { Menu, addGeneSearchbox, sayerror } from '#dom'
import { DNA_METHYLATION } from '#shared/terms.js'
import { getDNAMethUnit } from '#tw/dnaMethylation'
import { first_genetrack_tolist } from '#common/1stGenetk'

/** Coordinate note: both the genome browser and the HDF5 beta file use 0-based
 coordinates. Verified by cross-referencing 5 probes from the test H5 file
 (dnaMeth.h5) against UCSC hg38 using the search API:
   https://api.genome.ucsc.edu/search?search=<probeId>&genome=hg38

 H5 positions were read with:
   python3 -c "import h5py; h5=h5py.File('proteinpaint/server/test/tp/files/hg38/TermdbTest/dnaMeth.h5','r'); \
     print(list(zip(h5['/meta/probe/probeID'].asstr()[:5], h5['/meta/start'][:5])))"

 All matched the 0-based half-open (BED) position returned by UCSC:
   cg22949073: H5=7669073, UCSC=chr17:7669073-7669074
   cg16397722: H5=7673772, UCSC=chr17:7673772-7673773
   cg04405586: H5=7675143, UCSC=chr17:7675143-7675144
   cg15110538: H5=7675305, UCSC=chr17:7675305-7675306
   cg10792831: H5=7675371, UCSC=chr17:7675371-7675372
No conversion is needed. Single-position inputs (e.g. chr17:7661778) are
recovered from actualposition to avoid the 400bp expansion that string2pos()
applies for the genome browser. */

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
		this.dom.blockDiv = holder.append('div').style('display', 'none').style('margin', '15px 4px')
		const geneSearch = addGeneSearchbox({
			tip: new Menu({ padding: '0px' }),
			genome: opts.genomeObj,
			row: this.dom.geneSearchDiv,
			callback: async () => {
				try {
					this.dom.errDiv.style('display', 'none')
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

			this.dom.blockDiv.selectAll('*').remove()
			this.dom.blockDiv.style('display', 'block')
			this.dom.blockDiv.append('div').style('opacity', 0.6).text('Navigate genome browser to desired region')

			const arg: any = {
				holder: this.dom.blockDiv,
				genome: this.opts.genomeObj, // genome obj
				chr,
				start,
				stop,
				tklst: [],
				nobox: true,
				width: 500,
				hidegenelegend: true,
				debugmode: this.opts.debug
			}
			first_genetrack_tolist(this.opts.genomeObj, arg.tklst)
			const _ = await import('#src/block')
			this.blockInstance = new _.Block(arg)

			this.dom.submitBtn = this.dom.blockDiv
				.append('div')
				.attr('data-testid', 'sjpp-dnaMethylation-submitDiv')
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
			// string2pos() expands single positions to a 400bp window for the
			// genome browser, but we need the exact position for CpG queries.
			// Use actualposition when it indicates a single-position input.
			const { chr } = geneSearch
			let { start, stop } = geneSearch
			if (geneSearch.actualposition?.len <= 1) {
				start = geneSearch.actualposition.position
				stop = start + 1
			}
			const term = this.makeTerm({ chr, start, stop })
			await this.callback(term)
		} else {
			throw new Error('invalid gene search input')
		}
	}

	makeTerm(opts) {
		const { chr, start, stop } = opts
		if (!chr || !Number.isInteger(start) || !Number.isInteger(stop)) throw new Error('invalid coordinate')
		const unit = getDNAMethUnit('region', this.app.vocabApi)

		const term = {
			chr,
			start,
			stop,
			type: DNA_METHYLATION,
			unit,
			genomicFeatureType: 'region'
		}
		return term
	}
}
