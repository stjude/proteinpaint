import type { NumericQ, VocabApi, SsGSEATW } from '#types'
import { copyMerge } from '#rx'

/*
 */

export async function getHandler(self) {
	const numEditVers = self.opts.numericEditMenuVersion as string[]
	const subtype = numEditVers.length > 1 ? 'toggle' : numEditVers[0] // defaults to 'discrete'
	const _ = await importSubtype(subtype)
	return await _.getHandler(self)
}

export async function fillTW(tw: SsGSEATW, vocabApi: VocabApi, defaultQ: NumericQ | null = null) {
	if (typeof tw.term !== 'object') throw 'tw.term is not an object'
	if (!tw.term.id) throw 'tw.term.id missing'
	if (!tw.term.name) tw.term.name = tw.term.id // only apply to native; lack way to auto retrieve
	if (!tw.q?.mode) tw.q = { mode: 'continuous' } // supply default q if missing
	if (defaultQ) copyMerge(tw.q, defaultQ) // override if default is given
	if (tw.q.mode !== 'continuous' && !tw.term.bins) await vocabApi.setTermBins(tw) // see notes in geneExpression.ts
	return tw
}

async function importSubtype(subtype: string | undefined) {
	try {
		return await import(`./numeric.${subtype}.ts`)
	} catch (e: any) {
		if (e.stack) console.log(e.stack)
		throw `Type numeric.${subtype} does not exist [handlers/numeric.ts importSubtype()]`
	}
}
