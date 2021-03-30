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

const file_contents = fs.readFileSync('chr4.55589771.ACGA.A.txt').toString()
const lines=file_contents.split("\n")
let sequences=""
let start_positions=""
let i=0
for (const line of lines) {
    if (i < 2) {
      sequences += line+"\n"
    }
    else {
	if (line.length > 0) {	
	const abc = line.split("\t")
        start_positions+=abc[0]+"\n"
	  sequences+=abc[1]+"\n"
      }	  
    }	
    i+=1
}    

const refallele = 'ACGA'
const altallele = 'A'
const variant_pos = 55589771
const segbplen = 100
//console.log("sequences:",sequences)
//console.log("start_positions:",start_positions)
//console.log("segbplen:",segbplen)
//console.log("refallele:",refallele)
const rust_output = rust_match_complexvariant_indel(
        sequences,
        start_positions,
	BigInt(variant_pos),
	BigInt(segbplen),
	refallele,
	altallele,
	BigInt(kmer_length),
	weight_no_indel,
	weight_indel,
	threshold_slope
) // Invoking wasm function
//console.log('rust_output:', rust_output)
