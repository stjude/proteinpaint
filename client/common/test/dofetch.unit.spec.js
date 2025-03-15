import tape from 'tape'
import { fetch2parts, processMultiPart } from '../dofetch.js'

/*************************
 reusable helper functions
**************************/

const text2buf = new TextEncoder()
const buf2text = new TextDecoder()
const boundary = '--XyzxYzxyZ'

async function getBinaryPart(numRepeats = 2) {
	// TODO: use a small image binary??
	const str = '(0123456789-abcdefghijklmnopqrstuvwxyz)'
	let data = str
	for (let i = 0; i < numRepeats; i++) {
		data += str
	}
	const uint8arr = text2buf.encode(data)

	// convert to blob to simulate binary
	const blob = new Blob([uint8arr], { type: 'application/octet-stream' })
	const headers = { 'content-type': `application/octet-stream` }

	// When using text to create fake binary blob,
	// blob.text() always results in readable text,
	// which is not a good simulated payload
	const part = boundary + `\n${getPartHeader(headers)}\n\n` + (await blob.text())
	return { part, uint8arr: text2buf.encode(part), orig: { headers, body: blob } }
}

function getJsonPart(numErrors = 0) {
	let body
	if (!numErrors) {
		body = { ok: true, status: 'ok', message: 'success' }
	} else {
		const errors = []
		for (let i = 0; i < numErrors; i++) {
			errors.push({ error: 'dgfdagdadggaadg', message: 'something failed' })
		}
		body = { errors }
	}
	const headers = { 'content-type': 'application/json' }
	const part = boundary + `\n${getPartHeader(headers)}\n\n` + JSON.stringify(body)
	const uint8arr = text2buf.encode(part)
	return { part, uint8arr, orig: { headers, body } }
}

function getPartHeader(headers) {
	const h = []
	for (const [k, v] of Object.entries(headers)) {
		h.push(`${k}: ${v}`)
	}
	return h.join('\n')
}

function getResponse(parts, chunkSize = 4) {
	const ending = text2buf.encode(`\n--${boundary}--`)
	parts.push(ending)
	const totalLength = parts.reduce((total, p) => total + p.length, 0)
	const buffer = new Uint8Array(totalLength)
	let arrLen = 0
	for (const part of parts) {
		buffer.set(part, arrLen)
		arrLen += part.length
	}

	async function* reader() {
		let i = 0
		while (i < arrLen) {
			const beforePos = Math.min(arrLen - i, chunkSize)
			const chunk = buffer.slice(i, i + beforePos) //console.log(50, i, beforePos, chunk.length)
			yield chunk
			i += chunkSize
		}
	}

	const body = iteratorToStream(reader())
	return { body }
}

function iteratorToStream(iterator) {
	return new ReadableStream({
		async pull(controller) {
			const { value, done } = await iterator.next()
			if (value) {
				controller.enqueue(value)
			}
			if (done) {
				controller.close()
			}
		}
	})
}

/**************
 test sections
***************/

tape('simulated stream helpers', async test => {
	try {
		const bin0 = await getBinaryPart(12)
		const json0 = getJsonPart()
		const res = getResponse([bin0.uint8arr, text2buf.encode(`\n`), json0.uint8arr], 24)
		const chunks = []
		let totalLen = 0
		for await (const chunk of res.body) {
			//console.log(63, chunk.length)
			//console.log(61, chunk)
			chunks.push(chunk)
			totalLen += chunk.length
		}
		// console.log('chunks.length', chunks.length, totalLen)

		const arr = new Uint8Array(totalLen)
		let arrLen = 0
		for (const chunk of chunks) {
			arr.set(chunk, arrLen) //; console.log(arrLen, chunk.byteLength)
			arrLen += chunk.length
		}
		//console.log(73, arrLen, buf2text.decode(arr).split('\n'))
		const part = bin0.part + '\n' + json0.part + `\n--${boundary}--`
		const decoded = buf2text.decode(arr)
		test.equal(decoded, part, 'should correctly encode and decode multipart stream')
	} catch (e) {
		console.log(e)
	}
	test.end()
})

tape('fetch2parts', async test => {
	try {
		const bin0 = await getBinaryPart(12)
		const json0 = getJsonPart()
		const res = getResponse([bin0.uint8arr, json0.uint8arr], 24)
		const parts = await fetch2parts(res, boundary.slice(2))
		// console.log(115, parts, bin0.orig)
		test.deepEqual(parts, [bin0.orig, json0.orig], 'should correctly encode and decode the original headers and body')
		test.deepEqual(parts[0].body.text(), bin0.orig.body.text(), 'should correctly encode and decode original blobs')
		//test.fail('TODO: compare blobs correctly')
	} catch (e) {
		console.log(e)
	}
	test.end()
})
