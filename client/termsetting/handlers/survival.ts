import { getPillNameDefault } from '#termsetting'
import { TermWrapper, VocabApi, TermSettingInstance, PillData } from '#shared/types/index'

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
	if (tw) {
		//ignore: statement to prevent eslint warning
	}
	if (vocabApi) {
		//ignore: statement to prevent eslint warning
	}
	//ignore
}
