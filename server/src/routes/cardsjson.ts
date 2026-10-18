import type { RouteApi, RoutePayload } from '#types'
import { handle_cards, setGenomes } from '#src/cardsjson.js'

/*
The route of the cards of the app drawer, which was set up by app.unorg.js. The handler is in cardsjson.js.
*/

const payload: RoutePayload = {
	init,
	request: { typeId: 'any' },
	response: { typeId: 'any' }
}

export const api: RouteApi = {
	endpoint: 'cardsjson',
	methods: {
		get: payload
	}
}

function init({ genomes }) {
	setGenomes(genomes)
	return handle_cards
}
