import { first_genetrack_tolist } from '../common/1stGenetk'
import { contigNameNoChr2 } from '#shared/common'
import { addGeneSearchbox } from '../dom/genesearch.ts'
import { Menu } from '../dom/menu'

/*
only works for dnanexus FileViewer
test with http://localhost:3000/example.selectGenomeWithTklst.html
upon launching fileviewer from dnanexus,
allow user to select genome for those files, as well as default location
as there's no way to tell which genome these files are based on
*/

const tip = new Menu({ padding: '' })
const variantFlankingSize = 60 // bp

export async function init(arg, holder, genomes) {
	holder.style('margin', '40px 20px 20px 20px')

	const formdiv = holder.append('div')
	formdiv.append('p').text('To launch view, press ENTER at gene search.').style('opacity', 0.3)

	const blockholder = holder.append('div')

	const genomeselect = addGenomeSelect(formdiv, genomes).on('change', makeGeneSearch)

	// these are modified by makeGeneSearch(), each time when genome <select> is changed
	let coordInput, genome

	const geneInputSpan = formdiv.append('span').style('margin-left', '10px')

	const submitBtn = formdiv
		.append('button')
		.style('display', 'none')
		.style('margin-top', '20px')
		.style('padding', '10px 15px')
		.style('border-radius', '30px')
		.text('Launch ProteinPaint')
		.on('click', submit)

	// create gene <input> for default genome
	makeGeneSearch()

	/////////////////// helpers

	function makeGeneSearch() {
		// make a new <input> upon changing genome <select>, as each is bound with a genome
		// delete previous <input>
		geneInputSpan.selectAll('*').remove()
		const s = genomeselect.node()
		genome = genomes[s.options[s.selectedIndex].innerHTML]
		const opt = {
			genome,
			tip,
			row: geneInputSpan,
			allowVariant: true,
			/* only show submit button if valid coord is found
			this is deal with a defect with genesearch.js
			that pasting coordinate in <input> without hitting enter
			will not trigger coord parsing
			*/
			callback: () => submitBtn.style('display', 'block')
		}
		coordInput = addGeneSearchbox(opt)
	}

	async function submit() {
		try {
			formdiv.remove()
			// create arg for block
			const par = {
				nobox: 1,
				genome,
				holder: blockholder,
				tklst: arg.selectGenomeWithTklst
			}

			const ci = coordInput
			if (ci.chr) {
				// has user input
				const [nocount, hascount] = contigNameNoChr2(genome, [ci.chr])
				if (nocount + hascount == 0) throw 'Invalid chromosome name: ' + ci.chr
				const chr = nocount ? 'chr' + ci.chr : ci.chr
				if (Number.isInteger(ci.pos)) {
					// is variant
					if (!ci.ref) throw 'Reference allele missing from variant string'
					if (!ci.alt) throw 'Alternative allele missing from variant string'
					par.chr = chr
					par.start = ci.pos - variantFlankingSize
					par.stop = ci.pos + variantFlankingSize
					// attach this variant to bam tk
					for (const tk of par.tklst) {
						if (tk.type == 'bam') {
							tk.variants = [
								{
									chr,
									pos: ci.pos - 1, // convert 1-based to 0-based
									ref: ci.ref,
									alt: ci.alt
								}
							]
						}
					}
				} else {
					// is range
					if (!Number.isInteger(ci.start) || !Number.isInteger(ci.stop)) throw 'non-integer start/stop'
					par.chr = chr
					par.start = ci.start
					par.stop = ci.stop
				}
			} else {
				// no input, use default
				const d = genome.defaultcoord
				par.chr = d.chr
				par.start = d.start
				par.stop = d.stop
			}

			first_genetrack_tolist(genome, par.tklst)
			const _ = await import('./block')
			new _.Block(par)
		} catch (e) {
			window.alert(e.message || e)
		}
	}
}

function addGenomeSelect(div, genomes) {
	const select = div.append('select')
	for (const gn in genomes) {
		select.append('option').text(gn)
	}
	return select
}
