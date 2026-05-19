// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import type { RoutePayload } from '../src/routes/routeApi.ts'
import type { AIProjectAdminRequest } from '../src/routes/aiProjectAdmin.ts'

export function validGenome(value) {
	if (typeof value != 'string') throw 'genome should be a non-empty string'
	if (/\s+/.test(value)) throw 'invalid genome character'
	return value
}

export function validString(input, err?: string) {
	if (typeof input != 'string' || !input) throw err || 'input must be a non-empty string'
	return input
}

export function validStringArr(input, err?: string): string[] {
	if (Array.isArray(input)) throw `input must be an array`
	for (const v of input) {
		if (typeof v != 'string' || !v) throw err || `array entry must be a non-empty string`
	}
	return input
}

export function validNumber(input) {
	if (typeof input != 'number') throw 'dslabel should be a non-empty string'
	return input
}

export const aiProjectAdminPayload: RoutePayload = {
	request: { typeId: 'AIProjectAdminRequest' },
	response: { typeId: 'AIProjectAdminResponse' }
}

const allowedAIProjectForStrings = new Set(['list', 'admin', 'filterImages', 'images'])
function validAIProjectFor(val) {
	if (!allowedAIProjectForStrings.has(val)) throw `invalid aiProjectAdminPayload request.for='${val}'`
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

export function isValidAIProjectAdminRequest(input) {
	return {
		genome: validGenome(input.genome),
		dslabel: validString(input.dslabel),
		for: validAIProjectFor(input.for),
		/** required for 'project' and 'selection' requests */
		project: getValidAIAdminProject(input.project)
	} satisfies AIProjectAdminRequest
}
