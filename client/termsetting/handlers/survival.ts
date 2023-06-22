import { getPillNameDefault } from '#termsetting'
import { TW, VocabApi, TermSettingInstance, PillData } from '#shared/types'

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
		},
	}
}

export function fillTW(tw: TW, vocabApi: VocabApi) {
	//ignore
}
