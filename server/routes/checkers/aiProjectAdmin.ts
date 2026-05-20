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
		id: input.id === undefined ? undefined : validNumber(input.id, 'invalid ai project.id'),
		filter: input.filter === undefined ? undefined : validString(input.filter, 'invalid ai project.filter'),
		classes: input.classes as any, // TODO: convert to a validator function call
		images:
			input.images === undefined
				? undefined
				: validStringArr(input.images, `AIProjectAdminRequest must be an array of strings`),
		type: input.type === undefined ? undefined : validString(input.type, 'invalid ai project.type'),
		users: input.users === undefined ? undefined : validStringArr(input.users, 'invalid ai project.users')
	}
}
