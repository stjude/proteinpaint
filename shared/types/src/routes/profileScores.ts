import type { RoutePayload } from './routeApi.js'

export type ProfileScoresRequest = {
	file: string
}

export type ProfileScoresResponse = {
	src: string
	size: string
}

export const ProfileScoresPayload: RoutePayload = {
	request: {
		typeId: 'ProfileScoresRequest'
	},
	response: {
		typeId: 'ProfileScoresResponse'
	}
}
