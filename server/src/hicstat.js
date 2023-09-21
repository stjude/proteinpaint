const fs = require('fs')
const util = require('util')
const got = require('got')
/**
 * 
 * @param {*} file 
 * @param {*} isurl 
 * @returns {*} string
 * 
 * For details about the hic format v9 see https://github.com/aidenlab/hic-format/blob/master/HiCFormatV9.md
 * For v8 see https://github.com/aidenlab/hic-format/blob/master/HiCFormatV8.md

 */
export async function do_hicstat(file, isurl) {
	const out_data = {}
	const data = isurl ? await readHicUrl(file, 0, 32000) : await readHicFile(file, 0, 32000)
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
	if (version == 9) {
		const normVectorIndexPosition = Number(getLong())
		const normVectorIndexLength = Number(getLong())
		const vectorData = isurl
			? await readHicUrl(file, normVectorIndexPosition, normVectorIndexLength)
			: await readHicFile(file, normVectorIndexPosition, normVectorIndexLength)
		const vectorView = new DataView(vectorData)
		const nvectors = vectorView.getInt32(0, true)
		let pos = 4,
			result
		for (let i = 1; i <= nvectors; i++) {
			result = getViewString(vectorView, pos)
			console.log(result.str)

			//skip chromosome index
			result = getViewString(vectorView, result.pos + 4)
			pos = result.pos + 20 //skip other attributes
		}
	} else position += 16

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

	async function readHicFile(file, position, length) {
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

	async function readHicUrl(url, position, length) {
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

	function getViewString(view, position) {
		let str = ''
		let chr
		while ((chr = view.getUint8(position++)) != 0) {
			const charStr = String.fromCharCode(chr)
			str += charStr
		}
		return { str, pos: position }
	}

	function getString() {
		let str = ''
		let chr
		while ((chr = view.getUint8(position++)) != 0) {
			const charStr = String.fromCharCode(chr)
			str += charStr
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
