import { getPillNameDefault } from '#termsetting'
import type { TermWrapper, VocabApi, TermSettingInstance, PillData } from '#types'
//import { getHandler as getHandlerNumericToggle } from './numeric.toggle'

// TODO: create a dedicated handler, do not sneak into numeric term
export function getHandler(self: TermSettingInstance) {
	return {
		async showEditMenu(div: any) {
			if (!div) return
			// survival uses the showEditMenu method from numeric.toggle
			// const NumericToggleHandler = await getHandlerNumericToggle(self)
			// await NumericToggleHandler.showEditMenu(div)
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
