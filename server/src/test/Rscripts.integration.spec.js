const tape = require('tape')
const fetch = require('node-fetch').default

// Note: these integration tests are dependant on clinical datasets that are subject to change.

tape('\n', test => {
	test.pass('-***- R scripts integration specs -***-')
	test.end()
})

// Test the integration of fisher.R
tape('fisher.R integration', test => {
	fetch('http://localhost:3000/mds2', {
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
			dslabel: 'SJLife',
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
									tvs: { term: { id: 'subcohort', type: 'categorical' }, values: [{ key: 'CCSS', label: 'CCSS' }] }
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
					1.8817443524792397,
					0.9035330365204425,
					0.9849078300420343,
					0.9523705066963577,
					0.8548112961035059,
					2.478794670463805,
					2.846352579551519,
					0.1549824581545291,
					0.23053832970445318,
					3.313257831421107,
					2.9414285546123646,
					3.370063840047983,
					2.9354413180208287,
					2.801575825255521,
					2.8421068112137795,
					3.286146093332917,
					3.1779166025613144,
					3.9553614966109127,
					0.32843589573831544,
					0.24045241311560614,
					1.5852028932479911,
					1.8828066388526647,
					1.5618157065409919,
					1.5928481549669289,
					1.627355967657384,
					1.307801917776898,
					1.314032517292687,
					1.5749209604430299,
					0.05589778299983046,
					1.700840707255109,
					1.5376062718583596,
					1.2461358761461159
				],
				'should match expected output'
			)
			test.end()
		})
})

// Test the integration of fisher.2x3.R
tape('fisher.2x3.R integration', test => {
	fetch(
		'http://localhost:3000/termdb?genome=hg38&dslabel=SJLife&ssid=0.5501243236998616&phewas=1&intendwidth=800&axisheight=300&groupnamefontsize=16&dotradius=2&groupxspace=3&leftpad=2&rightpad=2&toppad=20&bottompad=10&devicePixelRatio=2&filter=' +
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
							tvs: { term: { id: 'subcohort', type: 'categorical' }, values: [{ key: 'CCSS', label: 'CCSS' }] }
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
					0.0389446388067233,
					0.0417744929533588,
					0.0447707467100442,
					0.0299697075533679,
					0.0290961584979116,
					0.0247112465873679,
					0.028812533964953
				],
				'should match expected output'
			)
			test.end()
		})
})
