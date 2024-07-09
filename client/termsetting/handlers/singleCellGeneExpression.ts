import { NumericQ } from '../../shared/types/terms/numeric'
import { VocabApi } from '../../shared/types/index'
import { SingleCellGeneExpressionTW } from '../../shared/types/terms/singleCellGeneExpression.js'
import { copyMerge } from '../../rx'

/*
Routes numeric terms to their respective subhandlers. Functions follow the same naming convention as the other handler files and returns the results. 

TODO: maybe merge these scripts with numeric.toggle

******** EXPORTED ********
getHandler()
fillTW()

******** INTERNAL ********
importSubtype()
    - subtype: str - should match the end of one numeric subhandler file (e.g. toggle, discrete, etc.)
    resuable try/catch block for import statement
*/

export async function getHandler(self) {
	const numEditVers = self.opts.numericEditMenuVersion as string[]
	const subtype = numEditVers.length > 1 ? 'toggle' : numEditVers[0] // defaults to 'discrete'
	const _ = await importSubtype(subtype)
	return await _.getHandler(self)
}

export async function fillTW(tw: SingleCellGeneExpressionTW, vocabApi: VocabApi, defaultQ: NumericQ | null = null) {
	if (!tw.term?.sample) throw 'singleCellGeneExpression tw.term.sample must be provided'
	if (typeof tw.term.gene != 'string' || !tw.term.gene)
		throw 'singleCellGeneExpression tw.term.gene must be non-empty string'
	if (!tw.term.name) tw.term.name = tw.term.gene // auto fill if .name is missing

	if (!tw.q?.mode) tw.q = { mode: 'continuous' } // supply default q if missing
	if (defaultQ) copyMerge(tw.q, defaultQ) // override if default is given

	if (!tw.term.bins) {
		/* gene term is missing bin definition, this is expected as it's not valid to apply same bin to genes with vastly different exp range, and not worth it to precompute each gene's default bin with its actual exp data
		here make a request to determine default bin for this term based on its data
		(in gdc this adds significant pause when adding gene exp term to oncomatrix)
		*/
		await vocabApi.setTermBins(tw)
	}
	return tw
}

async function importSubtype(subtype: string | undefined) {
	try {
		/* Note: @rollup/plugin-dynamic-import-vars cannot use a import variable name in the same dir. Adding str, in this case 'numeric.', in front of the template literal allows this to work. */
		return await import(`./numeric.${subtype}.ts`)
	} catch (e: any) {
		if (e.stack) console.log(e.stack)
		throw `Type numeric.${subtype} does not exist [handlers/numeric.ts importSubtype()]`
	}
}
