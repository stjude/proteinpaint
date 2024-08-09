import { VocabApi } from '../../shared/types/index'
import { SnpTW, SnpQ, SnpTerm } from '../../shared/types/terms/snp'
import { copyMerge } from '../../rx'
import { GroupSettingMethods } from './groupsetting.ts'

/*
******** EXPORTED ********
getHandler()
fillTW()
*/

export async function getHandler(self) {
	return {
		getPillName() {
			return self.term.name
		},

		getPillStatus() {
			let text = ''
			if (self.q.groupsetting.inuse) {
				if (self.q.groupsetting.customset) {
					const n = self.q.groupsetting.customset.groups.length
					text = `Divided into ${n} groups`
				} else {
					throw 'unknown setting for groupsetting'
				}
			}
			return { text }
		},

		async showEditMenu() {
			await new GroupSettingMethods(self).main()
		},

		async postMain() {
			// for rendering groupsetting menu
			const body = self.opts.getBodyParams?.() || {}
			const data = await self.vocabApi.getCategories(self.term, self.filter!, body)
			self.category2samplecount = data.lst
		}
	}
}

export async function fillTW(tw: SnpTW, vocabApi: VocabApi, defaultQ: SnpQ | null = null) {
	if (typeof tw.term !== 'object') throw 'tw.term is not an object'
	if (!tw.term.id || !tw.term.name) throw 'missing snp id/name'
	if (!tw.term.chr || !tw.term.start || !tw.term.stop) throw 'incomplete position information'
	if (!tw.term.ref || !tw.term.alt) 'missing allele information'
	if (!('type' in tw.q)) tw.q.type = 'values'

	if (defaultQ) {
		// merge defaultQ into tw.q
		copyMerge(tw.q, defaultQ)
	}

	// groupsetting
	// fill term.groupsetting
	if (!tw.term.groupsetting) (tw.term as SnpTerm).groupsetting = { disabled: false, lst: [] }
	// fill q.groupsetting
	if (!tw.q.groupsetting) (tw.q.groupsetting as any) = {}

	if (!('inuse' in tw.q.groupsetting)) (tw.q as SnpQ).groupsetting.inuse = false

	return tw
}
