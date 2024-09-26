/*
	Arguments
	search: optional string, defaults to window.location.search
	log: optional function to handle warnings/errors, defaults to console.warn

	returns
	a Map() of URL parameter key-values 
*/
// keys are case insensitive and will be converted to lower case in the map
import { isNumeric } from '#shared/helpers.js'

export default function (search = '', log = console.warn) {
	const location = search ? { search } : window.location
	const urlp = new Map()
	for (const s of location.search.substr(1).split('&')) {
		if (!s) continue
		const l = s.split('=')
		if (l.length == 2 && l[0] != '' && l[1] != '') {
			let value = decodeURIComponent(l[1])
			if (
				// assume JSON encoding when the string is enclosed by matching characters below
				(value.startsWith('"') && value.endsWith('"')) ||
				(value.startsWith('{') && value.endsWith('}')) ||
				(value.startsWith('[') && value.endsWith(']'))
			) {
				try {
					value = JSON.parse(value)
				} catch (e) {
					log(e)
				}
			} else if (isNumeric(value)) {
				value = Number(value)
			}
			// keys are case insensitive and are converted to lower case in the map
			urlp.set(l[0].toLowerCase(), value)
		} else if (l.length > 2) {
			log(`unexpected '=' character in the URL parameter value for '${l[0]}'`)
		} else {
			log(`Invalid url parameter: '${s}'`)
		}
	}
	return urlp
}
