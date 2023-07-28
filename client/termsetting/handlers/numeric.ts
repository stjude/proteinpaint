import { NumericQ, NumericTermSettingInstance, NumericTW, VocabApi } from '#shared/types'

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

export async function getHandler(self: NumericTermSettingInstance) {
	const numEditVers = self.opts.numericEditMenuVersion as string[]
	const subtype: string = numEditVers.length > 1 ? 'toggle' : numEditVers[0] // defaults to 'discrete'

	const _ = await importSubtype(subtype)
	return await _.getHandler(self)
}

export async function fillTW(tw: NumericTW, vocabApi: VocabApi, defaultQ?: NumericQ) {
	if (!tw.q.mode && !defaultQ?.mode) tw.q.mode = 'discrete'
	const subtype = tw.term.type == 'float' || tw.term.type == 'integer' ? 'toggle' : tw.q.mode

	const _ = await importSubtype(subtype)
	return await _.fillTW(tw, vocabApi, defaultQ || null)
}

async function importSubtype(subtype: string | undefined) {
	try {
		return await import(`./numeric.${subtype}.ts`)
	} catch (e: any) {
		if (e.stack) console.log(e.stack)
		throw `Type numeric.${subtype} does not exist [handlers/numeric.ts importSubtype()]`
	}
}
