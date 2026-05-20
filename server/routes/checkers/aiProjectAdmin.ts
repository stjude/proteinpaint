import type { RoutePayload, AIProjectAdminRequest, AIProjectAdminForValues, AIProjectAdminProject } from '#types'
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
		/* TODO: create separate init functions for each route method, so project will be either optional or required */
		project: !input.project ? undefined : getValidAIAdminProject(input.project)
	}
}

const allowedAIProjectForStrings: Set<AIProjectAdminForValues> = new Set(['list', 'admin', 'filterImages', 'images'])

function validAIProjectFor(val) {
	if (!allowedAIProjectForStrings.has(val)) throw `invalid aiProjectAdminPayload request payload.for='${val}'`
	return val
}

function getValidAIAdminProject(input): AIProjectAdminProject {
	return {
		name: validString(input.name),
		id: input.project === undefined ? undefined : validNumber(input.id),
		filter: input.project === undefined ? undefined : validString(input.filter),
		classes: input.classes as any, // TODO: convert to a validator function call
		images:
			input.project === undefined
				? undefined
				: validStringArr(input.images, `AIProjectAdminRequest must be an array of strings`),
		type: input.project === undefined ? undefined : validString(input.type),
		users: input.project === undefined ? undefined : validStringArr(input.type)
	}
}
