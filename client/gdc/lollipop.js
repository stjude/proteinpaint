import { addGeneSearchbox, Menu } from '#dom'
import { first_genetrack_tolist } from '../common/1stGenetk'
import { dofetch3 } from '#common/dofetch'
import blockinit from '#src/block.init'

/*
************* GDC view ********************
designed to work for lollipop & cnv apps in GDC Analysis Tools Framework
https://github.com/NCI-GDC/gdc-frontend-framework/blob/develop/packages/portal-proto/src/features/proteinpaint/ProteinPaintWrapper.tsx

test with:
	http://localhost:3000/example.gdc.html
	http://localhost:3000/example.mds3.numeric.html

to launch gdc lollipop:
	runpp({ geneSearch4GDCmds3:true })
to launch gdc cnv tool:
	runpp({
		geneSearch4GDCmds3:{
			hardcodeCnvOnly:1
		}
	})


************* Non-GDC view ********************
launch as:
	runpp({ geneSearch4GDCmds3:true, genome:'xx', dslabel:'yy' })


*************  parameters  ********************
arg = {}
	// this is the runpp() argument object
	geneSearch4GDCmds3:{}
		.postRender()
		.onloadalltk_always() }
			// optional callbacks for testing
		.hardcodeCnvOnly:1
			// if true, launches cnv tool (gene search box allows searching both gene/coord and yields coord)
	.allow2selectSamples:{}
		// pass to mds3 tk object to enable sample selection
	.filter0
		// hidden gdc cohort filter, passed to tk obj
	.geneSymbol:str
		// default gene to fill into search box
	.state{}
		// for auto updating app on GFF cohort change
	.tracks[]
		// for future use, allows to add extra annotation tracks in addition to mds3

	.genome:str
	.dslabel:str
		// allow to work for non-gdc ds

holder
genomes = { hg38 : {} }


*************  returns  ********************
api object. required to work with react wrapper
*/

const tip = new Menu({ padding: '' })

export async function init(arg, holder, genomes) {
	const useGenome = arg.genome || 'hg38'
	const useDslabel = arg.dslabel || 'GDC'
	const genome = genomes[useGenome]
	if (!genome) throw useGenome + ' missing'
	if (arg.geneSearch4GDCmds3.onloadalltk_always && typeof arg.geneSearch4GDCmds3.onloadalltk_always != 'function')
		throw 'arg.geneSearch4GDCmds3.onloadalltk_always not function'
	if (arg.geneSearch4GDCmds3.postRender && typeof arg.geneSearch4GDCmds3.postRender != 'function')
		throw 'arg.geneSearch4GDCmds3.postRender not function'

	// assume that there will only be one main div within a given holder
	holder.selectAll('.sja_lollipop_holder').remove()
	const mainDiv = holder.append('div').attr('class', 'sja_lollipop_holder')

	// first row, gene search
	const geneInputDiv = mainDiv.append('div').style('margin-left', '20px')
	geneInputDiv
		.append('div')
		.text(
			arg.geneSearch4GDCmds3.hardcodeCnvOnly
				? `To view ${useDslabel} CNV segments over a gene or region, enter genomic position (chr11:108195437-108267444), dbSNP accesion, or gene name (MYC).`
				: `To view ${useDslabel} mutations on a gene, enter one of gene symbol (MYC), alias (c-Myc), GENCODE accession (ENSG00000136997, ENST00000621592), or RefSeq accession (NM_002467).`
		)

	// second row, display graph
	const graphDiv = mainDiv.append('div').attr('class', 'sja_geneSearch4GDCmds3_blockdiv')

	const searchOpt = {
		genome,
		tip,
		row: geneInputDiv,
		callback: launchView,
		geneSymbol: arg.geneSymbol,
		triggerSearch: arg.geneSymbol && arg.geneSearch4GDCmds3?.hardcodeCnvOnly == true,
		hideInputBeforeCallback: arg.geneSearch4GDCmds3?.hardcodeCnvOnly == true
	}
	if (!arg.geneSearch4GDCmds3.hardcodeCnvOnly) {
		// not in cnv mode; is in lollipop mode to show coding ssm over gene coding exons, apply this flag
		searchOpt.searchOnly = 'gene'
	}
	const coordInput = addGeneSearchbox(searchOpt)

	/**********************
	must declare this variable first then call postRender(), other wise it can crash for accessing variable before initialization...
	saves user-selected isoform (string) or region ({chr/start/stop}) from <input>;
	on cohort change, this value will be used so the lollipop of the same gene can be auto updated
	**********************/
	let userSelection

	await arg.geneSearch4GDCmds3.postRender?.({ tip }) // supports testing

	if (arg.state) {
		// this is only present when the app auto updates from GFF cohort change
		if (arg.state.userSelection) launchView(false, arg.state.userSelection)
		delete arg.state
	}

	/**************
	parameters:
		triggeredByInput
			if true, func is called on user selecting something from <input>
			if false, is from api.update()
		userSelection
			when user selects from <input>, this is undefined
			otherwise is from api.update()
	***************/
	async function launchView(triggeredByInput = true, userSelection) {
		const pa = {
			// param for instantiating block
			genome,
			holder: graphDiv,
			gmmode: 'exon only',
			nobox: 1,
			hide_dsHandles: arg.hide_dsHandles,
			onloadalltk_always: arg.geneSearch4GDCmds3.onloadalltk_always
		}
		if (arg.tracks) {
			pa.tklst = arg.tracks
		} else {
			// generate mds3 tk
			const tk = {
				type: 'mds3',
				dslabel: useDslabel,
				allow2selectSamples: arg.allow2selectSamples,
				filter0: arg.filter0
			}
			pa.tklst = [tk]
			if (arg.geneSearch4GDCmds3.hardcodeCnvOnly) {
				tk.hardcodeCnvOnly = 1
				// also block is in genome browser mode
				delete pa.gmmode
				first_genetrack_tolist(pa.genome, pa.tklst)
			}
		}

		if (userSelection) {
			// recovering from gff cohort change
			if (arg.geneSearch4GDCmds3.hardcodeCnvOnly) {
				if (typeof userSelection != 'object') throw 'userSelection not object when pa.block is true'
				pa.chr = userSelection.chr
				pa.start = userSelection.start
				pa.stop = userSelection.stop
				if (!pa.chr || !Number.isInteger(pa.start) || !Number.isInteger(pa.stop))
					throw 'userSelection not {chr,start,stop}'
			} else {
				if (typeof userSelection != 'string') throw 'userSelection should be string when pa.block is not true'
				pa.query = userSelection
			}
		} else {
			// user selected gene/region from <input>
			if (arg.geneSearch4GDCmds3.hardcodeCnvOnly) {
				if (!coordInput.chr || !Number.isInteger(coordInput.start) || !Number.isInteger(coordInput.stop)) {
					if (triggeredByInput) throw 'coordInput.chr/start/stop missing' // ??
				}
				pa.chr = coordInput.chr
				pa.start = coordInput.start
				pa.stop = coordInput.stop
			} else {
				if (!coordInput.geneSymbol) {
					if (triggeredByInput) throw 'coordInput.geneSymbol missing' // ??
					// updates of arg.filter0 should still render
				}
				// a bit inefficient but must retrieve all gene models to find out if any is coding or all are noncoding
				const gmlst = (await dofetch3(`genelookup?deep=1&input=${coordInput.geneSymbol}&genome=${useGenome}`)).gmlst
				if (!Array.isArray(gmlst) || gmlst.length == 0) throw 'gmlst is not non-empty array'
				pa.query = getSelectedIsoform(coordInput, gmlst)
				if (gmlst.some(i => i.coding)) pa.gmmode = 'protein'
			}
		}

		graphDiv.selectAll('*').remove()

		// launch protein view
		if (!arg.geneSearch4GDCmds3.hardcodeCnvOnly) return await blockinit(pa) // does it need to return?
		// launch genome browser view
		const _ = await import('../src/block')
		return new _.Block(pa)
	}

	const api = {
		update: _arg => {
			Object.assign(arg, _arg)
			launchView(false)
		},
		getState: () => ({ userSelection })
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
