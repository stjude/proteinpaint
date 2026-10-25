import tape from 'tape'
import fs from 'fs'
import os from 'os'
import path from 'path'
import serverconfig from '#src/serverconfig.js'
import { computeTypes, getJunctionData, validate_junction_cluster } from '../validate.js'

tape('\n', test => {
	test.comment('-***- junction/validate specs -***-')
	test.end()
})

tape('computeTypes: canonical and event types', test => {
	const junction = {
		canonical: true,
		events: [{ type: 'exon_skip' }, { type: 'alt_donor' }, { type: 'exon_skip' }]
	}

	const types = computeTypes(junction, new Set())

	test.deepEqual(types, ['canonical', 'exon_skip', 'alt_donor'], 'returns canonical and unique event types')
	test.equal(junction.canonical, undefined, 'removes canonical from the junction info object')
	test.end()
})

tape('computeTypes: hidden types are excluded', test => {
	const junction = {
		canonical: true,
		events: [{ type: 'exon_skip' }, { type: 'alt_acceptor' }]
	}

	const types = computeTypes(junction, new Set(['canonical', 'alt_acceptor']))

	test.deepEqual(types, ['exon_skip'], 'omits hidden canonical and event types')
	test.equal(junction.canonical, undefined, 'removes canonical even when hidden')
	test.end()
})

tape('computeTypes: no events and non-canonical junction', test => {
	{
		const junction = {}
		const types = computeTypes(junction, new Set())
		test.deepEqual(types, ['na'], 'returns na when the junction is not canonical and has no events')
	}
	{
		const junction = {}
		const types = computeTypes(junction, new Set(['na']))
		test.deepEqual(types, [], 'returns no visible types when na is hidden')
	}
	test.end()
})

tape('computeTypes: event type must be a string', test => {
	const junction = {
		events: [{ type: 'exon_skip' }, {}]
	}

	test.throws(() => computeTypes(junction, new Set()), /event\.type missing/, 'throws when an event type is missing')
	test.end()
})

tape('getJunctionData: reformats sn2rc for termdb.matrix', async test => {
	const tw = {
		$id: 'junction-1',
		term: { type: 'junction', chr: 'chr1', start: 100, stop: 200, strand: '+' },
		q: { readcountCutoff: 3 }
	}
	const result = await getJunctionData(
		{ terms: [tw], filter: { type: 'tvslst', lst: [] } },
		async (query, keepList) => {
			test.deepEqual(query.rglst, [{ chr: 'chr1', start: 100, stop: 200 }], 'queries the junction region')
			test.equal(query.readcountCutoff, 3, 'passes the term read-count cutoff')
			test.deepEqual(keepList, [{ start: 100, stop: 200, strand: '+' }], 'limits results to the selected junction')
			return {
				junctions: [{ start: 100, stop: 200, strand: '+', sn2rc: new Map([['sample-1', 12]]) }]
			}
		}
	)
	test.deepEqual(result.term2sample2value.get('junction-1'), { 'sample-1': 12 }, 'returns sample-to-count values')
	test.end()
})

// the permission model of a server that cannot start a child process
const noChildProcess: any = { has: (scope: string) => scope != 'child' }

tape(
	'validate_junction_cluster: a cluster whose samples cannot be read without a child process is removed',
	async test => {
		const tpmasterdir = serverconfig.tpmasterdir
		const tmpdir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pp-junction-'))
		await fs.promises.writeFile(path.join(tmpdir, 'cluster.h5'), '')
		serverconfig.tpmasterdir = tmpdir
		const { log, warn } = console
		console.log = console.warn = () => {}
		const ds = { label: 'test' }
		const denied = async () => {
			throw 'this server build does not support this data computation request'
		}
		try {
			const junctionQ: any = { file: 'junction.gz', cluster: { file: 'cluster.h5' } }
			await validate_junction_cluster(ds, junctionQ, noChildProcess, denied)
			test.notOk(junctionQ.cluster, 'should remove the cluster when its samples cannot be read without a child process')
			test.equal(junctionQ.file, 'junction.gz', 'should keep the junction query')

			const kept: any = { cluster: { file: 'cluster.h5' } }
			await validate_junction_cluster(ds, kept, noChildProcess, async () => ['s1', 's2'])
			test.deepEqual([...kept.cluster.allSampleSet], ['s1', 's2'], 'should keep a cluster whose samples are read')

			for (const [label, junction, permission, getSamples, pattern] of [
				[
					'an unrelated sample read error',
					{ cluster: { file: 'cluster.h5' } },
					noChildProcess,
					async () => {
						throw new Error('No samples found')
					},
					/No samples found/
				],
				[
					'a missing cluster file',
					{ cluster: { file: 'missing.h5' } },
					noChildProcess,
					denied,
					/No such file or directory/
				],
				[
					'a denied tool when a child process is allowed',
					{ cluster: { file: 'cluster.h5' } },
					{ has: () => true },
					denied,
					/does not support/
				]
			] as any[]) {
				let message = ''
				try {
					await validate_junction_cluster(ds, junction, permission, getSamples)
				} catch (e: any) {
					message = `${e?.message || e}`
				}
				test.match(message, pattern, `should fail the init for ${label}`)
				test.ok(junction.cluster, `should not remove the cluster for ${label}`)
			}
		} finally {
			Object.assign(console, { log, warn })
			serverconfig.tpmasterdir = tpmasterdir
			await fs.promises.rm(tmpdir, { recursive: true, force: true })
		}
		test.end()
	}
)
