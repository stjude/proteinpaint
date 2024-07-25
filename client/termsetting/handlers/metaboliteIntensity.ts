import { NumericQ } from '../../shared/types/terms/numeric'
import { VocabApi } from '../../shared/types/index'
import { MetaboliteIntensityTW } from '../../shared/types/terms/metaboliteIntensity'
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

export async function fillTW(tw: MetaboliteIntensityTW, vocabApi: VocabApi, defaultQ: NumericQ | null = null) {
	if (!tw.q?.mode) tw.q = { mode: 'continuous' }
	if (defaultQ) copyMerge(tw.q, defaultQ) // override if default is given

	if (tw.q.mode != 'continuous' && !tw.term.bins) {
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
