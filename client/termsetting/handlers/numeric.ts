import type { NumericQ, NumericTW, VocabApi } from '#types'

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

export async function fillTW(tw: NumericTW, vocabApi: VocabApi, defaultQ: NumericQ | null = null) {
	if (!tw.q.mode) {
		if (!(defaultQ as null) || (defaultQ as NumericQ).mode) (tw.q as NumericQ).mode = 'discrete'
	}
	const subtype = tw.term.type == 'float' || tw.term.type == 'integer' ? 'toggle' : tw.q.mode
	const _ = await importSubtype(subtype)
	return await _.fillTW(tw, vocabApi, defaultQ)
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
