import { isNumeric } from './helpers.js'

/*
	A custom encoder-decoder for URL query parameter values

	All values are strings except for the following, which
	will are assumed to be json-encoded:

	- those that correspond to JSON reserved keywords: true, false, null
	- numeric values using the isNumeric() function below
	- values that are wrapped by "", {}, []

	In addition, a URL-payload that includes an `encoding=urljson` parameter
	will cause all query parameter values to be processed by the decode()
	function below. This is not required, but may help remove ambiguity, especially
	to distinguish urljson-encoded params vs legacy URL params that have 
	been manually coded in a way that doesn't conform to the expectations here.

	Why not just encode every URL query parameter value as JSON?

	- That makes the URL harder to read, since more encoding characters have to
		be URI (percent) encoded. In contrast, since most values are strings or numbers,
	  the encoder below leaves those values alone for better readability of the URL. For
	  example, unambiguous strings would not have to be wrapped with double-quotes
	  that are then URI encoded.

	- The decoder will always accept and correctly process values that are JSON-encoded.
	  So the encoding exceptions above do not prevent harder-to-read JSON-encoded string
	  values. 
*/

// a URL query parameters object with values to be encoded
export type UrlJsonRaw = {
	[key: string]: any //boolean | string | number | any[] | null | undefined  //| { [key: string]: any }
}

// a URL query parameters object with values to be decoded
export type UrlJsonEncoded = {
	[key: string]: string
}

const reserved = ['false', 'true', 'null', 'undefined']
const delimiters = ['"', '{', '[']

export function encode(rawObject: UrlJsonRaw) {
	const params: any[] = []
	for (const [key, value] of Object.entries(rawObject)) {
		if (typeof value == 'string' && !isNumeric(value) && !reserved.includes(value) && !delimiters.includes(value[0])) {
			// no need to json-encode a string before percent encoding
			// if it doesn't contain reserved JSON keywords/wrapper characters
			params.push(`${key}=${encodeURIComponent(value)}`)
		} else if (value !== undefined) {
			params.push(`${key}=${encodeURIComponent(JSON.stringify(value))}`)
		}
	}
	return params.join('&')
}

export function decode(query: UrlJsonEncoded) {
	const encoding = query.encoding
	for (const [key, value] of Object.entries(query)) {
		//const value = query[key]
		// if (value == 'undefined') {
		// 	// maybe better to also detect this common error
		// 	console.warn(`${key}="undefined" value as a string URL query parameter`)
		// 	query[key] = undefined
		// 	continue
		// }
		if (
			encoding == 'json' ||
			value == 'null' || // not new, always been
			value == 'true' || // NEED TO FIND-REPLACE CODE THAT USES value == 'true'
			value == 'false' || // NEED TO FIND-REPLACE CODE THAT USES value == 'false'
			isNumeric(value) || // NEED TO check
			(typeof value == 'string' && value.startsWith('"') && value.endsWith('"')) ||
			(typeof value == 'string' && value.startsWith('{') && value.endsWith('}')) ||
			(value.startsWith('[') && value.endsWith(']'))
		)
			query[key] = JSON.parse(value)
		// else the value is already a string
	}
	return query
}
