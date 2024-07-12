import { VocabApi } from '../../shared/types/index'
import { SnpTW, SnpQ } from '../../shared/types/terms/snp'
import { copyMerge } from '../../rx'

/*
******** EXPORTED ********
getHandler()
fillTW()
*/

export async function getHandler(self) {
	return {
		getPillName() {
			return self.term.name
		}
		//getPillStatus()
	}
}

export async function fillTW(tw: SnpTW, vocabApi: VocabApi, defaultQ: SnpQ | null = null) {
	if (typeof tw.term !== 'object') throw 'tw.term is not an object'
	if (!tw.term.id || !tw.term.name) throw 'missing snp id/name'
	if (!tw.term.chr || !tw.term.start || !tw.term.stop) throw 'incomplete position information'
	if (!tw.term.ref || !tw.term.alt) 'missing allele information'

	if (defaultQ) {
		// merge defaultQ into tw.q
		copyMerge(tw.q, defaultQ)
	}

	return tw
}
