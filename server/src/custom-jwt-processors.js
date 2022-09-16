const crypto = require('crypto')

exports.AESRollingExp = function(embedder, payload, _time) {
	const time = _time || Math.floor(Date.now() / 1000)
	const expIncrement = embedder.expIncrement || 300
	const exp = Math.ceil(time / expIncrement) * expIncrement
	//console.log(208, [payload.iat, expIncrement, payload.iat + expIncrement, exp, payload.iat + expIncrement > exp, time > exp, ])

	const subSecret = crypto
		.createHash('sha256')
		.update(exp.toString())
		.digest('hex')
		.toString()
		.substring(0, 32)

	const decryptedSub = AESDecrypt(payload.sub, subSecret)
	//console.log('decryptedSub', decryptedSub)
	const sub = JSON.parse(decryptedSub)
	//console.log('sub', sub)
	payload.exp = exp
	payload.datasets = sub.datasets
}

function AESDecrypt(text, password) {
	const textParts = text.split(':')
	const iv = Buffer.from(textParts.shift(), 'hex')
	const encryptedText = Buffer.from(textParts.join(':'), 'hex')
	const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(password), iv)
	let decrypted = decipher.update(encryptedText)
	decrypted = Buffer.concat([decrypted, decipher.final()])
	return decrypted.toString()
}
