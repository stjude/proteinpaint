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
import { stream_rust } from '@sjcrh/proteinpaint-rust'

// Helper function to collect stream output and return as a Promise
function collectStreamOutput(rustStream) {
	return new Promise((resolve, reject) => {
		let output = ''
		rustStream.on('data', chunk => {
			output += chunk.toString()
		})
		rustStream.on('end', () => {
			console.log('Stream ended')
			resolve(output)
		})
		rustStream.on('error', err => {
			console.error('Stream error:', err)
			reject(err)
		})
	})
}

// Helper function to load expected output JSON
function loadExpectedOutput(filename) {
	try {
		const filePath = path.join(serverconfig.binpath, 'test/tp/files/hg38/TermdbTest', filename)
		console.log('Loading expected output from:', filePath)
		const content = fs.readFileSync(filePath, { encoding: 'utf8' })
		const lines = content.trim().split('\n')
		const parsed = lines.map((line, index) => {
			try {
				return JSON.parse(line)
			} catch (e) {
				throw new Error(`Invalid JSONL in ${filename} at line ${index + 1}: ${line}, error: ${e.message}`)
			}
		})
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
	const keysA = Object.keys(a)
	const keysB = Object.keys(b)
	if (keysA.length !== keysB.length) return false
	for (const key of keysA) {
		if (!keysB.includes(key) || !deepEqual(a[key], b[key])) return false
	}
	return true
}

// Helper function to compare actual and expected outputs
function compareOutputs(actual, expected) {
	if (actual.length !== expected.length) {
		return {
			isEqual: false,
			message: `Output length mismatch: actual has ${actual.length} entries, expected ${expected.length}`
		}
	}
	const unmatchedActual = [...actual]
	const unmatchedExpected = [...expected]
	const matched = []

	// Match each actual entry to an expected entry
	for (let i = unmatchedActual.length - 1; i >= 0; i--) {
		const actualEntry = unmatchedActual[i]
		const expectedIndex = unmatchedExpected.findIndex(expectedEntry => {
			if (actualEntry.type !== expectedEntry.type) return false
			if (actualEntry.type === 'summary') {
				return deepEqual(actualEntry, expectedEntry)
			}
			if (actualEntry.case_id !== expectedEntry.case_id || actualEntry.data_type !== expectedEntry.data_type) {
				return false
			}
			return deepEqual(actualEntry.data, expectedEntry.data)
		})
		if (expectedIndex === -1) {
			return {
				isEqual: false,
				message: `No matching expected entry for actual entry: ${JSON.stringify(actualEntry, null, 2)}`
			}
		}
		matched.push(unmatchedActual[i])
		unmatchedActual.splice(i, 1)
		unmatchedExpected.splice(expectedIndex, 1)
	}
	if (unmatchedActual.length > 0 || unmatchedExpected.length > 0) {
		return {
			isEqual: false,
			message: `Unmatched entries: ${unmatchedActual.length} actual, ${unmatchedExpected.length} expected`
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
				'MP2PRT-PATFJE': { maf: '26ea7b6f-8bc4-4e83-ace1-2125b493a361' },
				'TCGA-CG-4300': {
					cnv: '46372ec2-ff79-4d07-b375-9ba8a12c11f3',
					maf: 'c09b208d-2e7b-4116-9580-27f20f4c7e67'
				}
			},
			mafOptions: {
				minTotalDepth: 100,
				minAltAlleleCount: 20,
				hyperMutator: 8000,
				consequences: ['missense_variant', 'frameshift_variant']
			},
			cnvOptions: {
				lossThreshold: -1,
				gainThreshold: 1.5,
				segLength: 2000000,
				hyperMutator: 8000
			}
		}
		try {
			const { rustStream, endStream } = stream_rust('gdcGRIN2', JSON.stringify(inputJson), errors => {
				if (errors) {
					throw new Error(`Rust process failed for gdcGRIN2.rs: ${errors}`)
				}
			})
			const streamResult = await collectStreamOutput(rustStream)
			endStream()
			console.log('Raw stream result:', streamResult)

			// Parse JSONL output (one JSON object per line)
			let output = []
			if (streamResult.trim()) {
				output = streamResult
					.trim()
					.split('\n')
					.map((line, index) => {
						try {
							return JSON.parse(line)
						} catch (e) {
							throw new Error(`Failed to parse JSONL line ${index + 1}: ${line}, error: ${e.message}`)
						}
					})
				// console.log('Parsed output:', JSON.stringify(output, null, 2))
			} else {
				console.log('Warning: Stream result is empty')
			}

			// Verify data output
			const dataOutputs = output.filter(o => o.type === 'data')
			t.equal(dataOutputs.length, 3, 'Should have 3 data outputs (2 MAF, 1 CNV)')

			// Verify summary output
			const summaryOutput = output.find(o => o.type === 'summary')
			t.ok(summaryOutput, 'Should have a summary output')
			t.equal(summaryOutput.total_files, 3, 'Total files should be 3')
			t.equal(summaryOutput.successful_files, 3, 'All files should be successful')
			t.equal(summaryOutput.failed_files, 0, 'No files should fail')
			t.equal(summaryOutput.errors.length, 0, 'No errors should be reported')

			try {
				const expectedOutput = loadExpectedOutput('TermdbTest_gdcGRIN2_exp_output.json')
				if (output.length === 0) {
					t.fail('No output received from stream; cannot compare with expected JSONL')
				} else {
					const comparison = compareOutputs(output, expectedOutput)
					if (comparison.isEqual) {
						t.pass('Output matches expected JSONL')
					} else {
						t.fail(`Output mismatch: ${comparison.message}`)
						console.error('Expected vs Actual Output (Test 1):', {
							expected: expectedOutput,
							actual: output
						})
					}
				}
			} catch (error) {
				t.fail(`Failed to compare with expected output: ${error.message}`)
				console.error('Expected vs Actual Output:', {
					expected: expectedOutput,
					actual: output
				})
			}
		} catch (error) {
			t.fail(`Test failed: ${error.message}`)
		} finally {
			t.end()
		}
	})
})
