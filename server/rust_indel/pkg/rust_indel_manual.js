let imports = {}
imports['__wbindgen_placeholder__'] = module.exports
let wasm
//const { TextDecoder, TextEncoder } = require(String.raw`util`);
const TextEncoder = require('util').TextEncoder //Changed manually
const TextDecoder = require('util').TextDecoder //Changed manually

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true })

cachedTextDecoder.decode()

let cachegetUint8Memory0 = null
function getUint8Memory0() {
	if (cachegetUint8Memory0 === null || cachegetUint8Memory0.buffer !== wasm.memory.buffer) {
		cachegetUint8Memory0 = new Uint8Array(wasm.memory.buffer)
	}
	return cachegetUint8Memory0
}

function getStringFromWasm0(ptr, len) {
	return cachedTextDecoder.decode(getUint8Memory0().subarray(ptr, ptr + len))
}

const heap = new Array(32).fill(undefined)

heap.push(undefined, null, true, false)

let heap_next = heap.length

function addHeapObject(obj) {
	if (heap_next === heap.length) heap.push(heap.length + 1)
	const idx = heap_next
	heap_next = heap[idx]

	heap[idx] = obj
	return idx
}

function getObject(idx) {
	return heap[idx]
}

function dropObject(idx) {
	if (idx < 36) return
	heap[idx] = heap_next
	heap_next = idx
}

function takeObject(idx) {
	const ret = getObject(idx)
	dropObject(idx)
	return ret
}

let WASM_VECTOR_LEN = 0

let cachedTextEncoder = new TextEncoder('utf-8')

const encodeString =
	typeof cachedTextEncoder.encodeInto === 'function'
		? function(arg, view) {
				return cachedTextEncoder.encodeInto(arg, view)
		  }
		: function(arg, view) {
				const buf = cachedTextEncoder.encode(arg)
				view.set(buf)
				return {
					read: arg.length,
					written: buf.length
				}
		  }

function passStringToWasm0(arg, malloc, realloc) {
	if (realloc === undefined) {
		const buf = cachedTextEncoder.encode(arg)
		const ptr = malloc(buf.length)
		getUint8Memory0()
			.subarray(ptr, ptr + buf.length)
			.set(buf)
		WASM_VECTOR_LEN = buf.length
		return ptr
	}

	let len = arg.length
	let ptr = malloc(len)

	const mem = getUint8Memory0()

	let offset = 0

	for (; offset < len; offset++) {
		const code = arg.charCodeAt(offset)
		if (code > 0x7f) break
		mem[ptr + offset] = code
	}

	if (offset !== len) {
		if (offset !== 0) {
			arg = arg.slice(offset)
		}
		ptr = realloc(ptr, len, (len = offset + arg.length * 3))
		const view = getUint8Memory0().subarray(ptr + offset, ptr + len)
		const ret = encodeString(arg, view)

		offset += ret.written
	}

	WASM_VECTOR_LEN = offset
	return ptr
}

const u32CvtShim = new Uint32Array(2)

const int64CvtShim = new BigInt64Array(u32CvtShim.buffer)
/**
 * @param {string} sequences
 * @param {string} start_positions
 * @param {BigInt} variant_pos
 * @param {BigInt} segbplen
 * @param {string} refallele
 * @param {string} altallele
 * @param {BigInt} kmer_length
 * @param {number} weight_no_indel
 * @param {number} weight_indel
 * @param {number} threshold_slope
 * @returns {any}
 */
module.exports.match_complex_variant_rust = function(
	sequences,
	start_positions,
	variant_pos,
	segbplen,
	refallele,
	altallele,
	kmer_length,
	weight_no_indel,
	weight_indel,
	threshold_slope
) {
	var ptr0 = passStringToWasm0(sequences, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc)
	var len0 = WASM_VECTOR_LEN
	var ptr1 = passStringToWasm0(start_positions, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc)
	var len1 = WASM_VECTOR_LEN
	int64CvtShim[0] = variant_pos
	const low2 = u32CvtShim[0]
	const high2 = u32CvtShim[1]
	int64CvtShim[0] = segbplen
	const low3 = u32CvtShim[0]
	const high3 = u32CvtShim[1]
	var ptr4 = passStringToWasm0(refallele, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc)
	var len4 = WASM_VECTOR_LEN
	var ptr5 = passStringToWasm0(altallele, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc)
	var len5 = WASM_VECTOR_LEN
	int64CvtShim[0] = kmer_length
	const low6 = u32CvtShim[0]
	const high6 = u32CvtShim[1]
	var ret = wasm.match_complex_variant_rust(
		ptr0,
		len0,
		ptr1,
		len1,
		low2,
		high2,
		low3,
		high3,
		ptr4,
		len4,
		ptr5,
		len5,
		low6,
		high6,
		weight_no_indel,
		weight_indel,
		threshold_slope
	)
	return takeObject(ret)
}

module.exports.__wbindgen_string_new = function(arg0, arg1) {
	var ret = getStringFromWasm0(arg0, arg1)
	return addHeapObject(ret)
}

module.exports.__wbindgen_object_drop_ref = function(arg0) {
	takeObject(arg0)
}

module.exports.__wbindgen_json_parse = function(arg0, arg1) {
	var ret = JSON.parse(getStringFromWasm0(arg0, arg1))
	return addHeapObject(ret)
}

module.exports.__wbg_log_2e875b1d2f6f87ac = function(arg0) {
	console.log(getObject(arg0))
}

module.exports.__wbg_log_13fd5f3b2bfccacd = function(arg0, arg1) {
	console.log(getObject(arg0), getObject(arg1))
}

module.exports.__wbindgen_throw = function(arg0, arg1) {
	throw new Error(getStringFromWasm0(arg0, arg1))
}

const path = require('path').join('server/rust_indel/pkg', 'rust_indel_bg.wasm')
const bytes = require('fs').readFileSync(path)

const wasmModule = new WebAssembly.Module(bytes)
const wasmInstance = new WebAssembly.Instance(wasmModule, imports)
wasm = wasmInstance.exports
module.exports.__wasm = wasm
