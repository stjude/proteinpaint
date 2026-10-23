import type { RouteApi, RoutePayload } from '#types'
import { handle_cards, setGenomes } from '#src/cardsjson.js'
import serverconfig from '#src/serverconfig.js'

/*
The route of the cards of the app drawer, which was set up by app.unorg.js. The handler is in cardsjson.js.
Not set up when disabled by serverconfig.features.disableFeature_cardsjson.
*/

const payload: RoutePayload = {
	get init() {
		return serverconfig.features.disableFeature_cardsjson ? null : init
	},
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
