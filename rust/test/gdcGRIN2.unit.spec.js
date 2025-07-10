/********************************************
Test script for 'rust/src/gdcGRIN2.rs'
This script must be run from the sjpp directory

cd ~/sjpp && node proteinpaint/rust/test/gdcGRIN2.unit.spec.js

*********************************************/

// Import necessary modules
import tape from 'tape'
import fs from 'fs'
import path from 'path'
import serverconfig from '@sjcrh/proteinpaint-server/src/serverconfig.js'
import { run_rust } from '@sjcrh/proteinpaint-rust'

// Helper function to load expected output JSON
function loadExpectedOutput(filename) {
	try {
		const filePath = path.join(serverconfig.binpath, 'test/tp/files/Grin2Test', filename)
		console.log('Loading expected output from:', filePath)
		const content = fs.readFileSync(filePath, { encoding: 'utf8' })
		let parsed
		try {
			parsed = JSON.parse(content.trim())
		} catch (e) {
			throw new Error(`Invalid JSONL in ${filename} at line ${index + 1}: ${line}, error: ${e.message}`)
		}

		// convert grin2lesion to array
		parsed.grin2lesion = JSON.parse(parsed.grin2lesion)
		// console.log('Expected output parsed:', JSON.stringify(parsed, null, 2))
		return parsed
	} catch (error) {
		throw new Error(`Failed to load expected output file: ${error.message}`)
	}
}

//Helper function for deep equlity comparison of two objects
function deepEqual(a, b) {
	if (a === b) return true
	if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false

	// Handle arrays
	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) return false
		// Sort arrays of objects by a unique key or stringified content
		const sortKey = item => (typeof item === 'object' ? JSON.stringify(item) : item)
		const sortedA = [...a].sort((x, y) => sortKey(x).localeCompare(sortKey(y)))
		const sortedB = [...b].sort((x, y) => sortKey(x).localeCompare(sortKey(y)))
		return sortedA.every((item, i) => deepEqual(item, sortedB[i]))
	}

	// Handle objects
	const keysA = Object.keys(a).sort()
	const keysB = Object.keys(b).sort()
	if (keysA.length !== keysB.length || !keysA.every((k, i) => k === keysB[i])) return false
	for (const key of keysA) {
		if (!deepEqual(a[key], b[key])) return false
	}
	return true
}

// Helper function to compare actual and expected outputs
function compareOutputs(actual, expected) {
	const actualParsed = { ...actual }
	if (typeof actualParsed.grin2lesion === 'string') {
		try {
			actualParsed.grin2lesion = JSON.parse(actualParsed.grin2lesion)
		} catch (e) {
			return {
				isEqual: false,
				message: `Failed to parse actual grin2lesion: ${e.message}`
			}
		}
	}

	const expectedParsed = { ...expected }
	if (typeof expectedParsed.grin2lesion === 'string') {
		try {
			expectedParsed.grin2lesion = JSON.parse(expectedParsed.grin2lesion)
		} catch (e) {
			return {
				isEqual: false,
				message: `Failed to parse expected grin2lesion: ${e.message}`
			}
		}
	}
	if (!deepEqual(actualParsed, expectedParsed)) {
		return {
			isEqual: false,
			message: `Output mismatch: ${JSON.stringify(actual, null, 2)} != ${JSON.stringify(expected, null, 2)}`
		}
	}
	return { isEqual: true, message: 'Outputs match' }
}

// gdcGRIN2 test
tape('gdcGRIN2 unit test', async function (test) {
	// Test 1: Successful MAF and CNV file download and processing
	test.test('Successful MAF and CNV processing', async function (t) {
		const inputJson = {
			caseFiles: {
				'MP2PRT-PATFJE': { maf: path.join(serverconfig.binpath, 'test/tp/files/Grin2Test', 'MP2PRT-PATFJE.maf.txt') },
				'TCGA-CG-4300': {
					cnv: path.join(serverconfig.binpath, 'test/tp/files/Grin2Test', 'TCGA-CG-4300.cnv.seg.txt'),
					maf: path.join(serverconfig.binpath, 'test/tp/files/Grin2Test', 'TCGA-CG-4300.maf.txt')
				}
			},
			mafOptions: {
				minTotalDepth: 10,
				minAltAlleleCount: 2,
				hyperMutator: 8000,
				consequences: ['missense_variant', 'frameshift_variant']
			},
			cnvOptions: {
				lossThreshold: -0.4,
				gainThreshold: 0.3,
				segLength: 2000000,
				hyperMutator: 500
			},
			chromosomes: ['chr1', 'chr2', 'chr3'],
			max_record: 100000
		}
		try {
			const output = await run_rust('gdcGRIN2', JSON.stringify(inputJson), ['--from-file'])
			console.log('Raw stream result:', JSON.parse(output.trim()))

			// Parse the output
			let parsedOutput
			try {
				parsedOutput = JSON.parse(output.trim())
			} catch (e) {
				t.fail(`Failed to parse output as JSON: ${e.message}`)
				t.end()
				return
			}

			// convert grin2lesion to array
			parsedOutput.grin2lesion = JSON.parse(parsedOutput.grin2lesion)

			// Load expected output
			let expectedOutput
			try {
				expectedOutput = loadExpectedOutput('Test_GRIN2_output.json')
			} catch (error) {
				t.fail(`Failed to load expected output: ${error.message}`)
				t.end()
				return
			}

			// Verify summary output
			t.ok(parsedOutput.summary, 'Should have a summary object')
			t.equal(parsedOutput.summary.total_files, 3, 'Total files should be 3')
			t.equal(parsedOutput.summary.successful_files, 3, 'All files should be successful')
			t.equal(parsedOutput.summary.failed_files, 0, 'No files should fail')
			t.equal(parsedOutput.summary.errors.length, 0, 'No errors should be reported')

			// Verify grinelesion data
			t.ok(parsedOutput.grin2lesion, 'Should have grin2lesion data')
			t.equal(parsedOutput.grin2lesion.length, 38, 'Should have 38 lesion records')

			// Compare actual and expected outputs
			const comparison = compareOutputs(parsedOutput, expectedOutput)
			if (comparison.isEqual) {
				t.pass('Output matches expected JSON')
			} else {
				t.fail(`Output mismatch: ${comparison.message}`)
				console.error('Expected vs Actual Output:', {
					expected: expectedOutput,
					actual: parsedOutput
				})
			}
		} catch (error) {
			t.fail(`Test failed: ${error.message}`)
		} finally {
			t.end()
		}
	})
})
