import type { ViolinBoxRequest, ViolinBoxResponse } from '../src/routes/termdb.violinBox.ts'
import { createValidate } from '../validators.ts'

export const validViolinBoxRequest = createValidate<ViolinBoxRequest>()
export const validViolinBoxResponse = createValidate<ViolinBoxResponse>()

export const violinBoxPayload = {
	request: {
		typeId: 'ViolinBoxRequest'
	},
	response: {
		typeId: 'ViolinBoxResponse'
	}
}
