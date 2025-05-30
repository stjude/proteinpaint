import { isNumeric } from './helpers.js'
const reserved = ['false', 'true', 'null', 'undefined']
const delimiters = ['"', '{', '[']
function encode(rawObject) {
	const params = []
	for (const [key, value] of Object.entries(rawObject)) {
		if (typeof value == 'string' && !isNumeric(value) && !reserved.includes(value) && !delimiters.includes(value[0])) {
			params.push(`${key}=${encodeURIComponent(value)}`)
		} else if (value !== void 0) {
			params.push(`${key}=${encodeURIComponent(JSON.stringify(value))}`)
		}
	}
	return params.join('&')
}
function decode(query) {
	const encoding = query.encoding
	for (const [key, value] of Object.entries(query)) {
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
	}
	return query
}
export { decode, encode }
