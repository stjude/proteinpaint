import { getPillNameDefault } from '#termsetting'
import { TermWrapper, VocabApi, TermSettingInstance, PillData } from '#shared/types'

export function getHandler(self: TermSettingInstance) {
	return {
		showEditMenu() {
			//ignore
		},
		getPillStatus() {
			//ignore
		},
		getPillName(d: PillData) {
			return getPillNameDefault(self, d)
		}
	}
}

export function fillTW(tw: TermWrapper, vocabApi: VocabApi) {
	//ignore
}
