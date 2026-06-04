import type { RouteApi, AIProjectAdminRequest, AIProjectAdminForValues, AIProjectAdminProject } from '#types'
import { validGenomeDs, validString, validNumber, validStringArr } from './common.ts'
import { init } from '../../routes/aiProjectAdmin.ts'

export const api: RouteApi = {
	endpoint: 'aiProjectAdmin',
	methods: {
		get: {
			// read-only requests
			init,
			// TODO: the init, request/response typeId and checker should all be specific to the get method
			request: {
				typeId: 'AIProjectAdminRequest',
				checker: validAIProjectAdminRequest
			},
			response: { typeId: 'AIProjectAdminResponse' }
		},
		post: {
			//'admin' -> edit
			init,
			// TODO: the init, request/response typeId and checker should all be specific to the post method
			request: {
				typeId: 'AIProjectAdminRequest',
				checker: validAIProjectAdminRequest
			},
			response: { typeId: 'AIProjectAdminResponse' }
		},
		put: {
			//'admin' -> add
			init,
			// TODO: the init, request/response typeId and checker should all be specific to the put method
			request: {
				typeId: 'AIProjectAdminRequest',
				checker: validAIProjectAdminRequest
			},
			response: { typeId: 'AIProjectAdminResponse' }
		},
		delete: {
			//'admin' -> delete
			init,
			// TODO: the init, request/response typeId and checker should all be specific to the delete method
			request: {
				typeId: 'AIProjectAdminRequest',
				checker: validAIProjectAdminRequest
			},
			response: { typeId: 'AIProjectAdminResponse' }
		}
	}
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

const allowedAIProjectForStrings: Set<AIProjectAdminForValues> = new Set([
	'list',
	'admin',
	'filterImages',
	'images',
	'logout',
	'role',
	'auth'
])

function validAIProjectFor(val) {
	if (!allowedAIProjectForStrings.has(val)) throw `invalid aiProjectAdminPayload request payload.for='${val}'`
	return val
}

function getValidAIAdminProject(input): AIProjectAdminProject {
	const id = input?.id == null ? undefined : validNumber(input.id, 'invalid ai project.id')
	// TODO fixed validation for delete requests, which only require id.
	//  Separate init functions for each route method to allow for different required fields
	// If payload contains only id (delete), return minimal valid shape
	if (input && Object.keys(input).length === 1 && 'id' in input) {
		return {
			id,
			// `name` is required by the type; use empty string as a safe placeholder for delete
			name: '',
			filter: undefined,
			classes: undefined,
			images: undefined,
			type: undefined,
			users: undefined
		}
	}

	const filter = typeof input?.filter === 'string' && input.filter !== '' ? input.filter : undefined
	const images =
		input?.images == null
			? undefined
			: validStringArr(input.images, `AIProjectAdminRequest must be an array of strings`)
	const users =
		input?.users == null || (Array.isArray(input.users) && input.users.length === 0)
			? undefined
			: validStringArr(input.users, 'invalid ai project.users')

	return {
		name: validString(input.name),
		id,
		filter,
		classes: input.classes as any, // TODO: convert to a validator function call
		images,
		type: input?.type == null ? undefined : validString(input.type, 'invalid ai project.type'),
		users
	}
}
