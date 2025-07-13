import tape from 'tape'
import fetch from 'node-fetch'
import path from 'path'
import fs from 'fs'
import serverconfig from '../serverconfig.js'

// Note: these integration tests are dependant on clinical datasets that are subject to change.

const ssid = 'fisher2x3-test.txt'
const src = path.join(import.meta.dirname, '/testdata/R', ssid)
const dest = path.join(serverconfig.cachedir, 'ssid', ssid)
try {
	fs.copyFileSync(src, dest)
} catch (e) {
	throw e
}

tape('\n', test => {
	test.comment('-***- R scripts integration specs -***-')
	test.end()
})

// Test the integration of fisher.R
tape.skip('fisher.R integration', test => {
	fetch(`http://localhost:${serverconfig.port}/mds2`, {
		method: 'POST',
		body: JSON.stringify({
			genome: 'hg38',
			info_fields: [
				{ key: 'QC_sjlife', iscategorical: true, hiddenvalues: { Bad: 1 } },
				{ key: 'QC_ccss', iscategorical: true, hiddenvalues: { Bad: 1 } },
				{ key: 'CR', isnumerical: true, range: { start: 0.95, startinclusive: true, stopunbounded: true } },
				{ key: 'CR_sjlife', isnumerical: true, range: { start: 0.95, startinclusive: true, stopunbounded: true } },
				{ key: 'CR_ccss', isnumerical: true, range: { start: 0.95, startinclusive: true, stopunbounded: true } },
				{ key: 'gnomAD_CR', isnumerical: true, range: { start: 0.95, startinclusive: true, stopunbounded: true } },
				{
					key: 'gnomAD_AF',
					isnumerical: true,
					missing_value: 0,
					range: { start: 0.1, startinclusive: true, stop: 1, stopinclusive: true }
				},
				{ key: 'PG', iscategorical: true, hiddenvalues: {} },
				{ key: 'BadBLAT', isflag: true, remove_yes: true },
				{ key: 'Polymer_region', isflag: true, remove_yes: true }
			],
			dslabel: 'TermdbTest',
			trigger_vcfbyrange: 1,
			AFtest: {
				groups: [
					{
						is_termdb: true,
						filter: {
							type: 'tvslst',
							join: 'and',
							in: true,
							lst: [
								{
									type: 'tvs',
									tag: 'cohortFilter',
									renderAs: 'htmlSelect',
									selectOptionsFrom: 'selectCohort',
									tvs: { term: { id: 'subcohort', type: 'multivalue' }, values: [{ key: 'XYZ', label: 'XYZ' }] }
								},
								{
									type: 'tvs',
									tvs: {
										term: { id: 'genetic_race', name: 'Genetically defined race', type: 'categorical' },
										values: [{ key: 'European Ancestry', label: 'European Ancestry' }]
									}
								},
								{
									type: 'tvs',
									tvs: {
										term: { name: 'wgs', id: 'wgs_curated', type: 'categorical' },
										values: [{ key: '1', label: 'Yes' }]
									}
								}
							]
						}
					},
					{ is_population: true, key: 'gnomAD', adjust_race: true }
				],
				testby_AFdiff: false,
				testby_fisher: true,
				termfilter: [
					{
						term: { id: 'genetic_race', name: 'Genetically defined race', type: 'categorical' },
						values: [{ key: 'European Ancestry', label: 'European Ancestry' }]
					}
				]
			},
			rglst: [{ chr: 'chr17', start: 7666657, stop: 7688274, width: 1060, xoff: 0 }]
		})
	})
		.then(res => res.json())
		.then(obj => {
			test.deepEqual(
				obj.vcf.rglst[0].variants.map(v => v.nm_axis_value),
				[
					1.4242032382171663, 14.347630932233224, 2.5423778840310414, 0.36530719729188244, 0.16526936577441664,
					0.9682595405170482, 2.0556742102656207, 12.584815056549552, 5.732218697937837, 2.2400027809882324,
					4.361855972827262, 4.708988890052095, 0.6379692834134763, 0.6676341551734228, 0.6382767265201461,
					4.153737440292865, 3.476891341505346, 4.340635210425329, 10.79961012873397, 4.940117906043664,
					3.8358862800882, 4.367259550183515, 4.733933800258545, 4.8892715539503255, 4.735469454648908,
					35.42399158266384, 37.1150359439827, 4.047139919299597, 43.11900330805673, 4.601249811463866,
					4.677021741496268, 41.43412233963457
				],
				'should match expected output'
			)
			test.end()
		})
})

// Test the integration of fisher.2x3.R
tape.skip('fisher.2x3.R integration', test => {
	fetch(
		`http://localhost:${serverconfig.port}/termdb?genome=hg38&dslabel=SJLife&ssid=${ssid}&phewas=1&intendwidth=800&axisheight=300&groupnamefontsize=16&dotradius=2&groupxspace=3&leftpad=2&rightpad=2&toppad=20&bottompad=10&devicePixelRatio=2&filter=` +
			encodeURIComponent(
				JSON.stringify({
					type: 'tvslst',
					join: 'and',
					in: true,
					lst: [
						{
							type: 'tvs',
							tag: 'cohortFilter',
							renderAs: 'htmlSelect',
							selectOptionsFrom: 'selectCohort',
							tvs: { term: { id: 'subcohort', type: 'multivalue' }, values: [{ key: 'XYZ', label: 'XYZ' }] }
						},
						{
							type: 'tvs',
							tvs: {
								term: { id: 'genetic_race', name: 'Genetically defined race', type: 'categorical' },
								values: [{ key: 'European Ancestry', label: 'European Ancestry' }]
							}
						},
						{
							type: 'tvs',
							tvs: {
								term: { name: 'wgs', id: 'wgs_curated', type: 'categorical' },
								values: [{ key: '1', label: 'Yes' }]
							}
						}
					]
				})
			),
		{ method: 'GET' }
	)
		.then(res => res.json())
		.then(obj => {
			test.deepEqual(
				obj.hoverdots.map(dot => dot.pvalue),
				[
					0.0389446388067233, 0.0417744929533588, 0.0447707467100442, 0.0299697075533679, 0.0290961584979116,
					0.0247112465873679, 0.028812533964953
				],
				'should match expected output'
			)
			test.end()
		})
})

// Test the integration of km.R
tape('km.R integration', test => {
	fetch(`http://localhost:${serverconfig.port}/mdssurvivalplot`, {
		method: 'POST',
		body: JSON.stringify({
			genome: 'hg19',
			dslabel: 'Pediatric2',
			type: 'efs',
			samplerule: {
				full: { byattr: 1, key: 'diagnosis_short', value: 'AML' },
				set: {
					geneexpression: 1,
					byquartile: 1,
					against1st: 1,
					gene: 'MDM2',
					chr: 'chr12',
					start: 69201951,
					stop: 69244466
				}
			}
		})
	})
		.then(res => res.json())
		.then(obj => {
			test.deepEqual(
				obj.samplesets.slice(1).map(i => i.pvalue),
				[0.5, 0.007, 0.2],
				'should match expected output'
			)
			test.end()
		})
})
