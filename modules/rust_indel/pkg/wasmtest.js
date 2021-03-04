const fs = require('fs')
const rust_match_complexvariant_indel = require('./rust_indel').match_complex_variant_rust
//const rust_fibonacci = require('./trial1/pkg/wasm_example_bindgen').fibonacci
//const return_string = require('./trial1/pkg/wasm_example_bindgen').will_return_string
//----------------------------------------------------------------------------
// IMPORTANT PARAMETERS
const kmer_length = 6 // length of kmer
const weight_no_indel = 0.1 // Weight when base not inside the indel
const weight_indel = 10 // Weight when base is inside the indel
const threshold_slope = 0.1 // Maximum curvature allowed to recognize perfectly aligned alt/ref sequences
//----------------------------------------------------------------------------

const sequences = fs.readFileSync('/Users/rpaul1/proteinpaint/chr1.241661226.A.ATTT.txt').toString()

const refallele = 'A'
const altallele = 'ATTT'
const variant_pos = 241661227
const segbplen = 142
//console.log("sequences:",sequences)
//console.log("segbplen:",segbplen)
//console.log("refallele:",refallele)
const rust_output = rust_match_complexvariant_indel(
	sequences,
	BigInt(variant_pos),
	BigInt(segbplen),
	refallele,
	altallele,
	BigInt(kmer_length),
	weight_no_indel,
	weight_indel,
	threshold_slope
) // Invoking wasm function
console.log('rust_output:', rust_output)
