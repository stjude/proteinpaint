import fs from 'fs'
import util from 'util'
import got from 'got'
// import { exec } from 'child_process'
import { HicstatResponse } from '#routeTypes/hicstat.ts'

/**
 * 
 * @param {*} file 
 * @param {*} isurl 
 * @returns {*} HicstatResponse
 * 
 * For details about the hic format v9 see https://github.com/aidenlab/hic-format/blob/master/HiCFormatV9.md
 * For v8 see https://github.com/aidenlab/hic-format/blob/master/HiCFormatV8.md

 */
export async function do_hicstat(file: string, isurl: boolean): Promise<HicstatResponse> {
	const out_data: any = {}
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
	let normalization = [] as string[]

	const shunk = 100000

	if (version == 8 || version == 7) {
		let vectorView = await getVectorView(file, footerPosition, shunk)
		const nbytesV5 = vectorView.getInt32(0, true)
		if (nbytesV5 > 0) {
			vectorView = await getVectorView(file, footerPosition + nbytesV5 + 4, shunk)
			normalization = await getNormalization(vectorView, footerPosition + nbytesV5 + 4)
		}
	}
	const genomeId = getString()
	out_data['Genome ID'] = genomeId

	if (version == 9) {
		const normVectorIndexPosition = Number(getLong())
		const normVectorIndexLength = Number(getLong())
		if (normVectorIndexPosition > 0 && normVectorIndexLength > 0) {
			const vectorView = await getVectorView(file, normVectorIndexPosition, normVectorIndexLength)
			normalization = await getNormalization(vectorView, 0)
		}
	}

	// skip unwatnted attributes
	const attributes: any = {}
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
	const nChrs = getInt()
	let Chr_i = 0

	while (Chr_i !== nChrs) {
		const chr = getString()
		out_data.chrorder.push(chr)
		out_data.Chromosomes[chr] = version == 7 || version == 8 ? getInt() : getLong()
		Chr_i++
	}
	// basepair resolutions
	out_data['Base pair-delimited resolutions'] = []
	const bpRes_n = getInt()
	//console.log(`Reading ${bpRes_n} base pair resolutions...`)

	let bpRes_i = 0

	while (bpRes_i !== bpRes_n) {
		const resBP = getInt()
		out_data['Base pair-delimited resolutions'].push(resBP)
		bpRes_i++
	}
	// fragment resolutions
	out_data['Fragment-delimited resolutions'] = []
	const FragRes_n = getInt()
	//console.log(`Reading ${FragRes_n} fragment resolutions...`)

	let FragRes_i = 0
	while (FragRes_i !== FragRes_n) {
		const resFrag = getInt()
		out_data['Fragment-delimited resolutions'].push(resFrag)
		FragRes_i++
	}
	//This is needed to support the conversion of a BigInt to json
	if (!BigInt.prototype['toJSON'])
		//For typescript: if a property may not exist on a constructor, use bracket notation to check
		//Then add with either this method or with dot notation
		Object.defineProperty(BigInt.prototype, 'toJSON', {
			get() {
				'use strict'
				return () => String(this)
			}
		})
	//console.log('Reading matrix ...')
	out_data.normalization = normalization
	return out_data

	async function getVectorView(file: string, position: number, length: number) {
		const vectorData = isurl ? await readHicUrl(file, position, length) : await readHicFile(file, position, length)
		const view = new DataView(vectorData)
		return view
	}

	async function getNormalization(vectorView: DataView, position: number) {
		const start = Date.now()

		let normalization: string[] = []
		const nvectors = vectorView.getInt32(0, true)
		let pos = 4
		// result
		for (let i = 1; i <= nvectors; i++) {
			let str = await getViewValue('string') //type
			normalization.push(str as string)
			//Reading block https://github.com/aidenlab/hic-format/blob/master/HiCFormatV8.md#normalized-expected-value-vectors
			if (version == 8 || version == 7) {
				str = await getViewValue('string') //unit
				addToPos(4) //skip bin size (int)

				const nvalues = (await getViewValue('int32')) as number
				addToPos(nvalues * 8)

				const nChrScaleFactors = (await getViewValue('int32')) as number
				addToPos(nChrScaleFactors * 12)
			}
			//Reading block https://github.com/aidenlab/hic-format/blob/master/HiCFormatV9.md#normalization-vector-index
			else if (version == 9) {
				pos += 4
				str = await getViewValue('string')
				pos += 20
			}
		}
		normalization = [...new Set(normalization)]

		const timeTaken = Date.now() - start
		console.log(`Read normalization on ${file} on ${timeTaken / 1000} seconds`)
		return normalization

		async function addToPos(number: number) {
			if (pos + number > shunk) readShunk()
			pos += number
		}

		async function readShunk() {
			vectorView = await getVectorView(file, position + pos, shunk)
			position = position + pos
			pos = 0
		}

		async function getViewValue(type: string) {
			let value: string | number
			if (type == 'string') {
				let str = ''
				let chr: string | number
				//Fix for when pos is > than the byteLength and .getUint8() returns undefined
				while (pos < vectorView.byteLength && (chr = vectorView.getUint8(pos++)) != 0) {
					if (pos > shunk) await readShunk()
					const charStr = String.fromCharCode(chr)
					str += charStr
				}
				value = str
			} else if (type == 'int32') {
				if (pos < 0) return //Fix for when pos is negative
				if (pos + 4 > vectorView.byteLength) await readShunk()
				value = vectorView.getInt32(pos, true)
				pos += 4
			} else throw `No value assigned [server/src/hicstat.ts getViewValue()]`
			return value
		}
	}

	async function readHicFile(file: string, position: number, length: number) {
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
	//***Unused funcs. Commented out to circumvent ts linter warnings
	// async function getFileSize(path: string) {
	// 	const stats = await fs.promises.stat(path)
	// 	return stats.size
	// }

	// async function getUrlSize(path: string) {
	// 	const execPromise = util.promisify(exec)
	// 	const out = await execPromise(`curl -I -L ${path}`)
	// 	const match = out.stdout.match(/content-length: ([0-9]*)/)
	// 	const fileSize = Number(match[1])

	// 	return fileSize
	// }

	async function readHicUrl(url: string, position: number, length: number) {
		try {
			const range = position + '-' + (position + length - 1)
			const response = await got(url, {
				headers: { Range: 'bytes=' + range }
			}).buffer()
			// convert buffer to arrayBuffer
			const arrayBuffer = response.buffer //.slice(position, position + length)

			return arrayBuffer
		} catch (error: any) {
			console.log(error.response)
			throw 'error reading file, check file details'
		}
	}

	function getString(): string {
		let str = ''
		let chr: string | number

		while ((chr = view.getUint8(position++)) != 0) {
			const charStr = String.fromCharCode(chr)
			str += charStr
		}
		return str
	}

	function getInt(): number {
		const IntVal = view.getInt32(position, true)
		position += 4
		return IntVal
	}

	function getLong(): bigint {
		const val = view.getBigInt64(position, true)
		position += 8
		return val
	}
}
