const fs = require('fs')
const util = require('util')
const got = require('got')

export async function do_hicstat(file, isurl) {
	const out_data = {}
	const data = isurl ? await readHicUrlHeader(file, 0, 32000) : await readHicFileHeader(file, 0, 32000)
	const view = new DataView(data)
	let position = 0
	const magic = getString()
	if (magic !== 'HIC') {
		throw Error('Unsupported hic file')
	}
	const version = getInt()
	if (version !== 8) {
		throw Error('Unsupported hic version: ' + version)
	}
	out_data['Hic Version'] = version
	position += 8 // skip unwatnted part
	const genomeId = getString()
	out_data['Genome ID'] = genomeId

	// skip unwatnted attributes
	let attributes = {}
	const attr_n = getInt()
	let attr_i = 0

	while (attr_i !== attr_n) {
		attributes[getString()] = getString()
		attr_i++
	}

	// Chromosomes
	out_data['Chromosomes'] = {}
	let nChrs = getInt()
	let Chr_i = 0
	while (Chr_i !== nChrs) {
		out_data['Chromosomes'][getString()] = getInt()
		Chr_i++
	}

	// basepair resolutions
	out_data['Base pair-delimited resolutions'] = []
	let bpRes_n = getInt()
	let bpRes_i = 0
	while (bpRes_i !== bpRes_n) {
		out_data['Base pair-delimited resolutions'].push(getInt())
		bpRes_i++
	}

	// fragment resolutions
	out_data['Fragment-delimited resolutions'] = []
	let FragRes_n = getInt()
	let FragRes_i = 0
	while (FragRes_i !== FragRes_n) {
		out_data['Fragment-delimited resolutions'].push(getInt())
		FragRes_i++
	}

	const output = JSON.stringify(out_data)
	return output

	async function readHicFileHeader(file, position, length) {
		const fsOpen = util.promisify(fs.open)
		const fsRead = util.promisify(fs.read)

		const buffer = Buffer.alloc(length)
		const fd = await fsOpen(file, 'r')
		const result = await fsRead(fd, buffer, 0, length, position)

		fs.close(fd, function(error) {
			return error
		})

		const buf = result.buffer
		const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)

		return arrayBuffer
	}

	async function readHicUrlHeader(url, position, length) {
		try {
			const response = await got.get(url, {
				headers: { Range: 'bytes=' + position + '-' + (length - 1) },
				responseType: 'buffer'
			})
			const buf = response.body
			const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
			return arrayBuffer
		} catch (error) {
			console.log(error.response)
		}
	}

	function getString() {
		let str = ''
		let chr
		while ((chr = view.getUint8(position++)) != 0) {
			str += String.fromCharCode(chr)
		}
		return str
	}

	function getInt() {
		const IntVal = view.getInt32(position, true)
		position += 4
		return IntVal
	}
}
