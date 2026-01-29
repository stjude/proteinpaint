// test.grin2.concurrency.ts
// Run with: node test.grin2.concurrency.ts
import { formatElapsedTime } from '@sjcrh/proteinpaint-shared'

const BASE_URL = 'http://localhost:3000/grin2'

// Different filter values to create varied requests
const diagnoses = ['AML', 'CLL', 'MDS', 'BCP-ALL', 'T-ALL']

function buildUrl(diagnosis) {
	const filter = {
		type: 'tvslst',
		in: true,
		join: '',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: {
						id: 'Diagnosis',
						name: 'Clinical Diagnosis',
						type: 'categorical',
						values: {
							AML: { label: 'AML', color: '#D95F02', order: 3 },
							CLL: { label: 'CLL', color: '#CED902', order: 5 },
							MDS: { label: 'MDS', color: '#E7298A', order: 4 },
							'BCP-ALL': { label: 'BCP-ALL', color: '#1B9E77', order: 1 },
							'T-ALL': { label: 'T-ALL', color: '#7570B3', order: 2 }
						},
						groupsetting: { disabled: false },
						unit: '',
						isleaf: true,
						hashtmldetail: true
					},
					values: [{ key: diagnosis }]
				}
			}
		]
	}

	const params = new URLSearchParams({
		genome: 'hg38',
		dslabel: 'ASH',
		filter: JSON.stringify(filter),
		width: '1000',
		height: '400',
		pngDotRadius: '2',
		devicePixelRatio: '2',
		maxGenesToShow: '500',
		lesionTypeColors: JSON.stringify({
			mutation: '#44AA44',
			loss: '#4444FF',
			gain: '#FF4444',
			fusion: '#FFA500',
			sv: '#9932CC'
		}),
		qValueThreshold: '0.05',
		maxCappedPoints: '5',
		hardCap: '200',
		binSize: '10',
		snvindelOptions: JSON.stringify({
			minTotalDepth: 10,
			minAltAlleleCount: 2,
			consequences: ['M', 'F', 'N', 'D', 'I', 'ProteinAltering', 'P', 'L', 'StopLost', 'StartLost']
		}),
		cnvOptions: JSON.stringify({
			lossThreshold: -0.1,
			gainThreshold: 0.1,
			maxSegLength: 2000000
		})
	})

	return `${BASE_URL}?${params.toString()}`
}

async function makeRequest(id, url) {
	const startTime = Date.now()

	try {
		const response = await fetch(url)
		const elapsed = formatElapsedTime(Date.now() - startTime)
		const data = await response.json()

		if (response.ok && data.status === 'success') {
			console.log(`Request ${id}: SUCCESS in ${elapsed}`)
			return { id, success: true, elapsed }
		} else {
			console.log(`Request ${id}: FAILED (${response.status}) in ${elapsed} - ${data.error || 'Unknown error'}`)
			return { id, success: false, elapsed, error: data.error }
		}
	} catch (_e) {
		const elapsed = formatElapsedTime(Date.now() - startTime)
		return { id, success: false, elapsed }
	}
}

async function runLoadTest(numRequests) {
	console.log(`\n${'='.repeat(60)}`)
	console.log(`Starting load test with ${numRequests} concurrent requests...`)
	console.log(`${'='.repeat(60)}\n`)

	const startTime = Date.now()

	// Build requests with varied filters
	const requests = Array.from({ length: numRequests }, (_, i) => {
		const diagnosis = diagnoses[i % diagnoses.length]
		const url = buildUrl(diagnosis)
		return makeRequest(i + 1, url)
	})

	// Run all concurrently
	const results = await Promise.all(requests)

	const totalTime = formatElapsedTime(Date.now() - startTime)
	const successful = results.filter(r => r.success).length
	const failed = results.filter(r => !r.success).length
	const queueFull = results.filter(r => r.error?.includes('queue is full')).length

	console.log(`\n${'='.repeat(60)}`)
	console.log('RESULTS')
	console.log(`${'='.repeat(60)}`)
	console.log(`Total requests:     ${numRequests}`)
	console.log(`Successful:         ${successful}`)
	console.log(`Failed:             ${failed}`)
	console.log(`Queue full errors:  ${queueFull}`)
	console.log(`Total time:         ${totalTime}`)
	console.log(`${'='.repeat(60)}\n`)
}

// Run tests with different concurrency levels
async function main() {
	const testCounts = [10, 25, 30, 40, 50, 70, 100]

	for (const count of testCounts) {
		await runLoadTest(count)
		// Wait between tests to let server settle
		await new Promise(r => setTimeout(r, 2000))
	}
}

main()
