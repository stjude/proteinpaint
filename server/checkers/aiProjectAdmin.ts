import type { RoutePayload, AIProjectAdminRequest, AIProjectAdminForValues } from '#types'
import { validGenomeDs, validString, validNumber, validStringArr } from './common.ts'

// this payload object helps with documentation
export const aiProjectAdminPayload: RoutePayload = {
	request: {
		typeId: 'AIProjectAdminRequest',
		checker: validAIProjectAdminRequest
	},
	response: { typeId: 'AIProjectAdminResponse' }
}

//
export function validAIProjectAdminRequest(input): AIProjectAdminRequest {
	return {
		...validGenomeDs(input),
		for: validAIProjectFor(input.for),
		/** required for 'project' and 'selection' requests */
		project: getValidAIAdminProject(input.project)
	}
}

const allowedAIProjectForStrings: Set<AIProjectAdminForValues> = new Set(['list', 'admin', 'filterImages', 'images'])

function validAIProjectFor(val) {
	if (!allowedAIProjectForStrings.has(val)) throw `invalid aiProjectAdminPayload request payload.for='${val}'`
	return val
}

function getValidAIAdminProject(input) {
	return {
		name: validString(input.name),
		id: validNumber(input.id),
		filter: validString(input.filter),
		classes: input.classes as any, // TODO: convert to a validator function call
		images: validStringArr(input.images, `AIProjectAdminRequest must be an array of strings`)
	}
}
