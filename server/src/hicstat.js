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
	if (version !== 8 && version != 9) {
		throw Error('Unsupported hic version: ' + version)
	}
	out_data['Hic Version'] = version
	position += 8 // skip unwatnted part
	const genomeId = getString()
	out_data['Genome ID'] = genomeId
	if (version == 9) position += 16 //skip header values normVectorIndexPosition and normVectorIndexLength

	// skip unwatnted attributes
	let attributes = {}
	const attr_n = getInt()
	let attr_i = 0

	while (attr_i !== attr_n) {
		const str = getString()
		attributes[str] = getString()
		attr_i++
	}

	// Chromosomes
	out_data.Chromosomes = {}
	out_data.chrorder = [] // order of chromosomes in this hic file, for assigning chr to 1st/2nd column of straw output
	let nChrs = getInt()
	let Chr_i = 0
	while (Chr_i !== nChrs) {
		const chr = getString()
		out_data.chrorder.push(chr)
		out_data.Chromosomes[chr] = version == 8 ? getInt() : getLong()
		Chr_i++
	}
	// basepair resolutions
	out_data['Base pair-delimited resolutions'] = []
	let bpRes_n = getInt()
	//console.log(`Reading ${bpRes_n} base pair resolutions...`)

	let bpRes_i = 0
	while (bpRes_i !== bpRes_n) {
		out_data['Base pair-delimited resolutions'].push(getInt())
		bpRes_i++
	}
	// fragment resolutions
	out_data['Fragment-delimited resolutions'] = []
	let FragRes_n = getInt()
	//console.log(`Reading ${FragRes_n} fragment resolutions...`)

	let FragRes_i = 0
	while (FragRes_i !== FragRes_n) {
		out_data['Fragment-delimited resolutions'].push(getInt())
		FragRes_i++
	}
	//This is needed to support the conversion of a BigInt to json
	if (!BigInt.prototype.toJSON)
		Object.defineProperty(BigInt.prototype, 'toJSON', {
			get() {
				'use strict'
				return () => String(this)
			}
		})
	//console.log('Reading matrix ...')
	const output = JSON.stringify(out_data)
	return output

	async function readHicFileHeader(file, position, length) {
		const fsOpen = util.promisify(fs.open)
		const fsRead = util.promisify(fs.read)

		const buffer = Buffer.alloc(length)
		const fd = await fsOpen(file, 'r')
		const result = await fsRead(fd, buffer, 0, length, position)

		fs.close(fd, function (error) {
			return error
		})

		const buf = result.buffer
		const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)

		return arrayBuffer
	}

	async function readHicUrlHeader(url, position, length) {
		try {
			const response = await got(url, {
				headers: { Range: 'bytes=' + position + '-' + (length - 1) }
			}).buffer()
			// convert buffer to arrayBuffer
			const arrayBuffer = response.buffer.slice(position, position + length)
			return arrayBuffer
		} catch (error) {
			console.log(error.response)
			throw 'error reading file, check file details'
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

	function getLong() {
		const val = view.getBigInt64(position, true)
		position += 8
		return val
	}
}
