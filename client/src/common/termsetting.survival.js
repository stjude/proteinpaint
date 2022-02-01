import { getPillNameDefault } from './termsetting'

export function getHandler(self) {
	return {
		showEditMenu() {},
		getPillStatus() {},
		getPillName(d) {
			return getPillNameDefault(self, d)
		}
	}
}

export function fillTW(tw, vocabApi) {}
