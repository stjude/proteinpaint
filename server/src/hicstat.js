import fs from 'fs'
import util from 'util'
import got from 'got'

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
	if (version !== 7 && version !== 8 && version != 9) {
		throw Error('Unsupported hic version: ' + version)
	}
	out_data.version = version
	const footerPosition = Number(getLong())
	let normalization = []
	if (version == 8 || version == 7) {
		const fileSize = isurl ? await getUrlSize(file) : getFileSize(file)
		console.log(fileSize - footerPosition)
		const vectorView = await getVectorView(file, footerPosition, fileSize - footerPosition)
		const nbytesV5 = vectorView.getInt32(0, true)
		console.log(nbytesV5)
		normalization = getNormalization(vectorView, nbytesV5 + 4)
	}
	const genomeId = getString()
	out_data['Genome ID'] = genomeId
	if (version == 9) {
		const normVectorIndexPosition = Number(getLong())
		const normVectorIndexLength = Number(getLong())
		const vectorView = await getVectorView(file, normVectorIndexPosition, normVectorIndexLength)
		normalization = getNormalization(vectorView, 0)
	}

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
		out_data.Chromosomes[chr] = version == 7 || version == 8 ? getInt() : getLong()
		Chr_i++
	}
	// basepair resolutions
	out_data['Base pair-delimited resolutions'] = []
	let bpRes_n = getInt()
	//console.log(`Reading ${bpRes_n} base pair resolutions...`)

	let bpRes_i = 0
	while (bpRes_i !== bpRes_n) {
		const resBP = getInt()
		out_data['Base pair-delimited resolutions'].push(resBP)
		bpRes_i++
	}
	// fragment resolutions
	out_data['Fragment-delimited resolutions'] = []
	let FragRes_n = getInt()
	//console.log(`Reading ${FragRes_n} fragment resolutions...`)

	let FragRes_i = 0
	while (FragRes_i !== FragRes_n) {
		const resFrag = getInt()
		out_data['Fragment-delimited resolutions'].push(resFrag)
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
	out_data.normalization = normalization
	return out_data

	async function getVectorView(file, position, length) {
		const vectorData = isurl ? await readHicUrl(file, position, length) : await readHicFile(file, position, length)
		const view = new DataView(vectorData)
		return view
	}

	function getNormalization(vectorView, position) {
		let normalization = []

		const nvectors = vectorView.getInt32(position, true)
		let pos = position + 4,
			result
		for (let i = 1; i <= nvectors; i++) {
			result = getViewString(vectorView, pos)
			normalization.push(result.str)
			//skip chromosome index
			let shift
			//Reading block https://github.com/aidenlab/hic-format/blob/master/HiCFormatV8.md#normalized-expected-value-vectors
			if (version == 8) {
				result = getViewString(vectorView, result.pos)

				//skip bin size (int), read nvalues
				const nvalues = vectorView.getInt32(result.pos + 4, true)

				pos = result.pos + 8 + nvalues * 8
				const nChrScaleFactors = vectorView.getInt32(pos, true)
				pos = pos + 4 + nChrScaleFactors * 12
			}
			//Reading block https://github.com/aidenlab/hic-format/blob/master/HiCFormatV9.md#normalization-vector-index
			else if (version == 9) {
				result = getViewString(vectorView, result.pos + 4)
				pos = result.pos + 20
			}
		}
		normalization = [...new Set(normalization)]
		return normalization
	}

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

	function getFileSize(path) {
		const stats = fs.statSync(path)
		return stats.size
	}

	async function getUrlSize(path) {
		const response = await got(path, {
			method: 'head',
			followRedirect: true // Default is true anyway.
		})
		const headers = response.headers
		const fileSize = Number(headers['content-length'])
		return fileSize
	}

	async function readHicUrl(url, position, length) {
		try {
			const range = position + '-' + (position + length - 1)
			console.log(range)
			const response = await got(url, {
				headers: { Range: 'bytes=' + range }
			}).buffer()
			// convert buffer to arrayBuffer
			const arrayBuffer = response.buffer //.slice(position, position + length)
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
