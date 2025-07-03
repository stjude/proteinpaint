const encoder = new TextEncoder()

export async function hash(message) {
	const msgUint8 = encoder.encode(message) // encode as (utf-8) Uint8Array
	const hashBuffer = await crypto.subtle.digest('SHA-1', msgUint8) // hash the message
	const hashArray = Array.from(new Uint8Array(hashBuffer)) // convert buffer to byte array
	const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('') // convert bytes to hex string
	return hexToBase64(hashHex).replace('=', '-') // shorten from 40 to 28 chars
}

function hexToBase64(hexStr) {
	return btoa(
		[...hexStr].reduce(
			(acc, _, i) => (acc += !((i - 1) & 1) ? String.fromCharCode(parseInt(hexStr.substring(i - 1, i + 1), 16)) : ''),
			''
		)
	)
}
