import { addGeneSearchbox } from '../dom/genesearch.ts'
import { Menu } from '#dom/menu'
import { dofetch3 } from '#common/dofetch'
import blockinit from '#src/block.init'

/* designed to work for lollipop & cnv apps in GDC Analysis Tools Framework

test with http://localhost:3000/example.gdc.html

to launch lollipop:
	runpp({ geneSearch4GDCmds3:true })
to launch cnv tool:
	runpp({ geneSearch4GDCmds3:{hardcodeCnvOnly:1} })


********* parameters

arg = {}
	// runpp() argument object
	geneSearch4GDCmds3:{}
		.postRender()
		.onloadalltk_always() }
			// optional callbacks for testing
		.hardcodeCnvOnly:1
			// if true, launches cnv tool (gene search box allows searching both gene/coord and yields coord)
	.allow2selectSamples:{}
		pass to mds3 tk object to enable sample selection
	.geneSymbol:str
		default gene to fill into search box
holder
genomes = { hg38 : {} }


********* returns

{ update() }

this may work with react wrapper?


TODO make it a generic mechanism to type in gene and launch any tk
the hardcoded "GDC mutations" phrase should be configurable as well...
*/

const gdcGenome = 'hg38'
const gdcDslabel = 'GDC' // label of this dataset on this pp instance
const tip = new Menu({ padding: '' })

export async function init(arg, holder, genomes) {
	const genome = genomes[gdcGenome]
	if (!genome) throw gdcGenome + ' missing'

	// assume that there will only be one main div within a given holder
	holder.selectAll('.sja_lollipop_holder').remove()
	const mainDiv = holder.append('div').attr('class', 'sja_lollipop_holder')

	// first row, gene search
	const geneInputDiv = mainDiv.append('div').style('margin-left', '20px')
	geneInputDiv
		.append('div')
		.text(
			'To view GDC mutations on a gene, enter one of gene symbol (MYC), alias (c-Myc), GENCODE accession (ENSG00000136997, ENST00000621592), or RefSeq accession (NM_002467).'
		)

	// second row, display graph
	const graphDiv = mainDiv.append('div').attr('class', 'sja_geneSearch4GDCmds3_blockdiv')

	const searchOpt = {
		genome,
		tip,
		row: geneInputDiv,
		searchOnly: 'gene',
		callback: launchView,
		geneSymbol: arg.geneSymbol
	}
	const coordInput = addGeneSearchbox(searchOpt)

	// must declare this variable first then call postRender(), other wise it can crash for accessing variable before initialization...
	// saves user-selected isoform from <input>; on cohort change, this value will be used so the lollipop of the same gene can be auto updated
	let selectedIsoform // str
	// saves user-selected region
	let selectedRegion // {chr,start,stop}

	if (typeof arg.geneSearch4GDCmds3.postRender == 'function') {
		// supports testing
		await arg.geneSearch4GDCmds3.postRender({ tip })
	}

	if (arg.state) {
		if (arg.state.isoform) launchView(false, arg.state.isoform)
		delete arg.state
	}

	async function launchView(triggeredByInput = true, isoform) {
		console.log(triggeredByInput, isoform)
		let gmmode = 'exon only'
		if (isoform) {
			selectedIsoform = isoform
		} else {
			if (!coordInput.geneSymbol) {
				if (triggeredByInput) throw 'geneSymbol missing'
				// updates of arg.filter0 should still render
				// return
			}

			// a bit inefficient but must retrieve all gene models to find out if any is coding or all are noncoding
			const gmlst = (await dofetch3(`genelookup?deep=1&input=${coordInput.geneSymbol}&genome=${gdcGenome}`)).gmlst
			if (!Array.isArray(gmlst) || gmlst.length == 0) throw 'gmlst is not non-empty array'
			selectedIsoform = isoform || getSelectedIsoform(coordInput, gmlst)
			if (gmlst.some(i => i.coding)) gmmode = 'protein'
		}

		graphDiv.selectAll('*').remove()

		const pa = {
			query: selectedIsoform,
			genome,
			holder: graphDiv,
			gmmode,
			hide_dsHandles: arg.hide_dsHandles,
			tklst: arg.tracks
				? arg.tracks
				: [{ type: 'mds3', dslabel: gdcDslabel, allow2selectSamples: arg.allow2selectSamples }]
		}

		if (typeof arg.geneSearch4GDCmds3.onloadalltk_always == 'function') {
			// supports testing
			pa.onloadalltk_always = arg.geneSearch4GDCmds3.onloadalltk_always
		}

		return await blockinit(pa)
	}

	const api = {
		update: _arg => {
			Object.assign(arg, _arg)
			launchView(false)
		},
		getState: () => ({ isoform: selectedIsoform })
	}
	return api
}

function getSelectedIsoform(coordInput, gmlst) {
	if (coordInput.fromWhat) {
		// .fromWhat=str is input string user typed into <input>, check if it is isoform
		if (gmlst.some(i => i.isoform.toUpperCase() == coordInput.fromWhat.toUpperCase())) {
			// user has input isoform accession, use it
			return coordInput.fromWhat
		}
		// user input does not match with isoform
		if (coordInput.fromWhat.toUpperCase().startsWith('ENSG')) {
			// user input looks like a gencode gene accession
			// find the ENST default isoform that matches with it
			for (const i of gmlst) {
				if (i.isdefault && i.isoform.startsWith('ENST')) return i.isoform
			}
		}
		// user input is not isoform or ENSG (should be symbol or alias) continue with below
	}

	const defaultIsoform = gmlst.find(i => i.isdefault)
	if (defaultIsoform) return defaultIsoform.isoform
	return gmlst[0].isoform
}
