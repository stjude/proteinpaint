import { getPillNameDefault } from '#termsetting'
import { TermWrapper, VocabApi, TermSettingInstance, PillData } from '#types'
import { getHandler as getHandlerNumericToggle } from './numeric.toggle'

export function getHandler(self: TermSettingInstance) {
	return {
		async showEditMenu(div: any) {
			// survival uses the showEditMenu method from numeric.toggle
			const NumericToggleHandler = await getHandlerNumericToggle(self)
			await NumericToggleHandler.showEditMenu(div)
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
