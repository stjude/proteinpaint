const tape = require('tape')
const spawn = require('child_process').spawn
const Readable = require('stream').Readable

/**************
 Code to test
***************/
const rust_indel_bin = '../rust_indel_cargo/target/release/rust_indel_cargo'

/**************
 Test sections
***************/
tape('\n', function(test) {
	test.pass('-***- rust indel specs -***-')
	test.end()
})

let output

//TODO: add useful test for invalid input
tape('rust indel binary', async function(test) {
	//Test valid input
	const validInput =
		'GTACCCTAGGTGGAACGGCCGCCTTCTCCATTCTCCATGGCCCCACAAGCTTCCCTTCCCCCGGTGCCACCACGACTTGACCTTCTGCCGCAGCGAGTATGTGTTCCCTCAAGTGCTTCTGCTCTTGGAACTGCTTCTAAGGTAAAGCATTTT-GTACCCTAGGTGGAACGGCCGCCTTCTCCATTCTCCATGGCCCCACAAGCTTCCCTTCCCCCGGTGCCACCACGACTTGACCTGGTGACCTTCTGCCGCAGCGAGTATGTGTTCCCTCAAGTGCTTCTGCTCTTGGAACTGCTTCTAAGGTAAAGCATTTT-CACGACTTGACCTGGCGACCTTCTGCCGCAGCGAGTATGTGTTCCCTCAAGTGCTTCTGCTCTTGGAACTGCTTC-TGCCGCAGCGAGTATGTGTTCCCTCAAGTGCTTCTGCTCTTGGAACTGCTTCTAAGGTAAAGCATTTTCCATTAC-GTAATCTCAGCTACTTGGGAGGCTGAGGCAGGAGAATTGCTTCAACACAAGAGGCGGAGGTTGCAGTCAGTCGAG-CCTGGTGACCTTCTGCCGCAGCGAGTATGTGTTCCCTCAAGTGCTTCTGCTCTTGGAACTGCTTCTAAGGCTGCT-CCACGACTTGACCTGGTGACCTTCTGCCGCAGCGAGTATGTGTTCCCTCAAGTGCTTCTGCTCTTGGAACTGCTT-CTTGACCTGGTGACCTTCTGCCGCAGCGAGTATGTGTTCCCTCAAGTGCTTCTGCTCTTGGAACTGCTTCTAAGG:119155749-119155755-119146842-119155742-119155747-119155747:62M88N13M-75M-3M8834N72M-69M88N6M-16S59M-10S65M:119155745:75:T:TTGACCTGG:6:0.1:10:0.1:1:GTACCCTAGGTGGAACGGCCGCCTTCTCCATTCTCCATGGCCCCACAAGCTTCCCTTCCCCCGGTGCCACCACGAC:TGACCTTCTGCCGCAGCGAGTATGTGTTCCCTCAAGTGCTTCTGCTCTTGGAACTGCTTCTAAGGTAAAGCATTTT'
	const ps = spawn(rust_indel_bin)
	Readable.from(validInput).pipe(ps.stdin)
	const stdout = []
	ps.stdout.on('data', data => stdout.push(data))
	ps.on('close', code => {
		const output = stdout.join('').split('\n')
		let output_cat = ''
		let output_gID = ''
		for (i of output) {
			if (i.includes('output_cat'))
				output_cat = i
					.replace(/"/g, '')
					.replace(/,/g, '')
					.replace('output_cat:', '')
			if (i.includes('output_gID'))
				output_gID = i
					.replace(/"/g, '')
					.replace(/,/g, '')
					.replace('output_gID:', '')
		}
		test.equal(output_cat, 'none:ref:none:none:alt:alt', 'should match expected output categories')
		test.equal(output_gID, '2:1:3:0:4:5', 'should match expected output gIDs')
	})
	test.end()
})
