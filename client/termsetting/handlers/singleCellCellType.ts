import { set_hiddenvalues } from '../utils.ts'
import type { SingleCellCellTypeQ, SingleCellCellTypeTW, VocabApi } from '#types'
import { getHandler as getCategoricalHandler } from './categorical.ts'
import { copyMerge } from '#rx'

export async function getHandler(self) {
	return getCategoricalHandler(self)
}

export function fillTW(tw: SingleCellCellTypeTW, vocabApi: VocabApi, defaultQ: SingleCellCellTypeQ | null = null) {
	if (!tw.term?.sample) throw 'missing term.sample'
	if (!tw.term?.plot) throw 'missing term.plot'

	if (!Object.keys(tw.q).includes('type')) tw.q.type = 'values' // must fill default q.type if missing
	if (!tw.term.groupsetting) tw.term.groupsetting = { disabled: false }
	if (tw.q.type == 'predefined-groupset') {
		if (!Number.isInteger(tw.q.predefined_groupset_idx)) throw 'predefined_groupset_idx is not an integer'
	}
	if (tw.q.type == 'custom-groupset') {
		if (!tw.q.customset) throw 'invalid customset'
	}

	if (defaultQ) {
		defaultQ.isAtomic = true
		// merge defaultQ into tw.q
		copyMerge(tw.q, defaultQ)
	}

	set_hiddenvalues(tw.q, tw.term)
}
