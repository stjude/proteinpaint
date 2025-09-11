import type { SnpTW, SnpQ, VocabApi } from '#types'
import { getHandler as getCategoricalHandler } from './categorical.ts'
import { copyMerge } from '#rx'
import { set_hiddenvalues } from '../utils.ts'

export async function getHandler(self) {
	return getCategoricalHandler(self)
}

export async function fillTW(tw: SnpTW, vocabApi: VocabApi, defaultQ: SnpQ | null = null) {
	if (typeof tw.term !== 'object') throw 'tw.term is not an object'
	if (!tw.term.id || !tw.term.name) throw 'missing snp id/name'
	if (!tw.term.chr || !Number.isInteger(tw.term.start) || !Number.isInteger(tw.term.stop))
		throw 'incomplete position information'
	if (!tw.term.ref || !tw.term.alt) throw 'missing allele information'

	if (!Object.keys(tw.q).includes('type')) tw.q.type = 'values'
	if (!tw.term.groupsetting) tw.term.groupsetting = { disabled: false }
	if (tw.q.type == 'predefined-groupset') {
		if (!Number.isInteger(tw.q.predefined_groupset_idx)) throw 'predefined_groupset_idx is not an integer'
	}
	if (tw.q.type == 'custom-groupset') {
		if (!tw.q.customset) throw 'invalid customset'
	}

	if (defaultQ) {
		// merge defaultQ into tw.q
		copyMerge(tw.q, defaultQ)
	}

	set_hiddenvalues(tw.q, tw.term)
}
