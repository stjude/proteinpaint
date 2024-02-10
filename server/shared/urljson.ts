/*
	A custom encoder-decoder for URL query parameter values

	All values are strings except for the following, which
	will are assumed to be json-encoded:

	- those that correspond to JSON reserved keywords: true, false, null
	- numeric values using the isNumeric() function below
	- values that are wrapped by "", {}, []

	In addition, a URL-payload that includes an `encoding=urljson` parameter
	will cause all query parameter values to be processed by the decode()
	function below. 
*/

// a URL query parameters object with values to be encoded
export type UrlJsonRaw = {
	[key: string]: string | number | { [key: string]: any } | any[] | null
}

// a URL query parameters object with values to be decoded
export type UrlJsonEncoded = {
	[key: string]: string
}

const reserved = ['false', 'true', 'null', 'undefined']
const delimiters = ['"', '{', '[']

export function encode(rawObject: UrlJsonRaw) {
	const params = []
	for (const [key, value] of Object.entries(rawObject)) {
		if (typeof value == 'string' && !isNumeric(value) && !reserved.includes(value) && !delimiters.includes(value[0])) {
			// no need to json-encode a string before percent encoding
			// if it doesn't contain reserved JSON wrapper/delimiters
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
		if (value == 'undefined') {
			// maybe better to also detect this common error
			console.warn(`${key}="undefined" value as a string URL query parameter`)
			query[key] = undefined
			continue
		}
		if (
			encoding == 'json' ||
			value == 'null' || // not new, always been
			value == 'true' || // NEED TO FIND-REPLACE CODE THAT USES value == 'true'
			value == 'false' || // NEED TO FIND-REPLACE CODE THAT USES value == 'false'
			isNumeric(value) || // NEED TO check
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith('{') && value.endsWith('}')) ||
			(value.startsWith('[') && value.endsWith(']'))
		)
			query[key] = JSON.parse(value)
		// else the value is already a string
	}
	return query
}

function isNumeric(d) {
	return !isNaN(parseFloat(d)) && isFinite(d) && d !== ''
}
