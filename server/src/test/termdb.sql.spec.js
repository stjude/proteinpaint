/*
  Requires a running pp server, `npm run server`

  See the header comments in test/test.server.js 
  for help in troubleshooting a failing test if
  encountered below.
*/

const tape = require('tape')
const fs = require('fs')
const path = require('path')
const compareResponseData = require('./back.sql.helpers').compareResponseData
const serverconfig = require('../../serverconfig')
const termjson = require('./termjson').termjson

const ssid = 'genotype-test.txt'
const src = path.join(__dirname, '../../test/testdata', ssid)
const dest = path.join(serverconfig.cachedir, 'ssid', ssid)
console.log(src, dest)
try {
	fs.copyFileSync(src, dest)
} catch (e) {
	throw e
}

tape('\n', function(test) {
	test.pass('-***- termdb.sql specs -***-')
	test.end()
})

tape('filters applied to categorical term', function(test) {
	// plan will track the number of expected tests,
	// which helps with the async tests
	test.timeoutAfter(6000)
	test.plan(12)

	compareResponseData(
		test,
		{
			term1: 'diaggrp',
			filter: {
				type: 'tvslst',
				in: true,
				join: '',
				lst: [
					{
						type: 'tvs',
						tvs: {
							term: { id: 'sex', name: 'Sex', type: 'categorical' },
							values: [{ key: '1', label: '1' }]
						}
					}
				]
			}
		},
		'categorical filter'
	)

	compareResponseData(
		test,
		{
			term1: 'diaggrp',
			filter: {
				type: 'tvslst',
				in: true,
				join: '',
				lst: [
					{
						type: 'tvs',
						tvs: {
							term: { id: 'agedx', name: 'Age at diagnosis', type: 'float' },
							ranges: [{ start: 0, stop: 5 }]
						}
					}
				]
			}
		},
		'numerical filter, normal range of (start,stop)'
	)

	compareResponseData(
		test,
		{
			term1: 'diaggrp',
			filter: {
				type: 'tvslst',
				in: true,
				join: '',
				lst: [
					{
						type: 'tvs',
						tvs: {
							term: {
								id: 'hrtavg',
								name: 'Heart',
								type: 'float',
								// must add "values" so that test/termdb/back.barchart.js can access it (won't be able to query termjson)
								values: {
									'0': { label: 'not treated', uncomputable: true },
									'-8888': { label: 'Exposed but dose unknown', uncomputable: true },
									'-9999': { label: 'Unknown treatment record', uncomputable: true }
								}
							},
							ranges: [
								{
									startunbounded: true,
									stop: 1000,
									stopinclusive: true,
									label: '≤1000',
									name: '≤1000'
								}
							], // range includes special values and should be excluded
							isnot: false
						}
					}
				]
			}
		},
		'numerical filter, one-side-unbound range with excluded values'
	)

	compareResponseData(
		test,
		{
			term1: 'diaggrp',
			filter: {
				type: 'tvslst',
				in: true,
				join: '',
				lst: [
					{
						type: 'tvs',
						tvs: {
							term: {
								id: 'hrtavg',
								name: 'Heart',
								type: 'float',
								values: {
									// as above
									'-8888': { label: 'Exposed but dose unknown', uncomputable: true },
									'-9999': { label: 'Unknown treatment record', uncomputable: true }
								}
							},
							ranges: [{ value: 0 }, { start: 100, stop: 1000 }]
						}
					}
				]
			}
		},
		'numerical filter, combining {value} and normal range'
	)

	compareResponseData(
		test,
		{
			term1: 'diaggrp',
			filter: {
				type: 'tvslst',
				in: true,
				join: '',
				lst: [
					{
						type: 'tvs',
						tvs: {
							term: { id: 'hrtavg', name: 'Heart', type: 'float' }, // heart radiation
							ranges: [{ value: 0 }] // not radiated
						}
					}
				]
			}
		},
		'numerical filter, using a special category'
	)

	compareResponseData(
		test,
		{
			term1: 'diaggrp',
			filter: {
				type: 'tvslst',
				in: true,
				join: '',
				lst: [
					{
						type: 'tvs',
						tvs: {
							term: { id: 'Asthma', name: 'Asthma', type: 'condition' },
							bar_by_grade: true,
							values: [{ key: '3', label: '3' }],
							value_by_max_grade: true
						}
					}
				]
			}
		},
		'condition filter, leaf, by maximum grade'
	)

	compareResponseData(
		test,
		{
			term1: 'diaggrp',
			filter: {
				type: 'tvslst',
				in: true,
				join: '',
				lst: [
					{
						type: 'tvs',
						tvs: {
							term: { id: 'Asthma', name: 'Asthma', type: 'condition' },
							bar_by_grade: true,
							values: [{ key: 2, label: '2' }],
							value_by_most_recent: true
						}
					}
				]
			}
		},
		'condition filter, leaf, by most recent grade'
	)

	compareResponseData(
		test,
		{
			term1: 'diaggrp',
			filter: {
				type: 'tvslst',
				in: true,
				join: '',
				lst: [
					{
						type: 'tvs',
						tvs: {
							term: { id: 'Asthma', name: 'Asthma', type: 'condition' },
							bar_by_grade: true,
							values: [{ key: 2, label: '2' }],
							value_by_computable_grade: true
						}
					}
				]
			}
		},
		'condition filter, leaf, by computable grade'
	)

	compareResponseData(
		test,
		{
			term1: 'diaggrp',
			filter: {
				type: 'tvslst',
				in: true,
				join: '',
				lst: [
					{
						type: 'tvs',
						tvs: {
							term: { id: 'Arrhythmias', name: 'Arrhythmias', type: 'condition' },
							bar_by_grade: true,
							values: [{ key: 2, label: '2' }],
							value_by_max_grade: true
						}
					}
				]
			}
		},
		'condition filter, non-leaf, by maximum grade'
	)

	compareResponseData(
		test,
		{
			term1: 'diaggrp',
			filter: {
				type: 'tvslst',
				in: true,
				join: '',
				lst: [
					{
						type: 'tvs',
						tvs: {
							term: { id: 'Arrhythmias', name: 'Arrhythmias', type: 'condition' },
							bar_by_grade: true,
							values: [{ key: 2, label: '2' }],
							value_by_most_recent: true
						}
					}
				]
			}
		},
		'condition filter, non-leaf, by most-recent grade'
	)

	compareResponseData(
		test,
		{
			term1: 'diaggrp',
			filter: {
				type: 'tvslst',
				in: true,
				join: '',
				lst: [
					{
						type: 'tvs',
						tvs: {
							term: { id: 'Arrhythmias', name: 'Arrhythmias', type: 'condition' },
							bar_by_children: true,
							value_by_computable_grade: true,
							values: [{ key: 'Cardiac dysrhythmia', label: 'Cardiac dysrhythmia' }]
						}
					}
				]
			}
		},
		'condition filter, non-leaf, by sub-condition'
	)

	compareResponseData(
		test,
		{
			term1: 'diaggrp',
			filter: {
				type: 'tvslst',
				in: true,
				join: 'and',
				lst: [
					{
						type: 'tvs',
						tvs: {
							term: { id: 'sex', name: 'Sex', type: 'categorical' },
							values: [{ key: '2', label: 'Female' }]
						}
					},
					{
						type: 'tvs',
						tvs: {
							term: { id: 'agedx', name: 'Age at diagnosis', type: 'float' },
							ranges: [{ start: 0, stop: 8 }]
						}
					},
					{
						type: 'tvs',
						tvs: {
							term: { id: 'Asthma', name: 'Asthma', type: 'condition' },
							bar_by_grade: true,
							values: [{ key: 3, label: '3' }],
							value_by_max_grade: true
						}
					}
				]
			}
		},
		'combined filtered results'
	)
})

tape('categorical term1', function(test) {
	test.timeoutAfter(5000)
	test.plan(7)

	compareResponseData(test, { term1: 'diaggrp' }, 'sample counts by diagnosis groups, no overlay')

	compareResponseData(
		test,
		{
			term1: 'diaggrp',
			term2: 'sex'
		},
		'sample counts by diagnosis groups, categorical overlay'
	)

	compareResponseData(
		test,
		{
			term1: 'diaggrp',
			term2: 'agedx',
			term2_q: termjson['agedx'].bins.default
		},
		'sample counts by diagnosis groups, numerical overlay'
	)

	compareResponseData(
		test,
		{
			term1: 'diaggrp',
			term2: 'Asthma',
			conditionUnits: ['', '', 'max_grade_perperson'],
			term2_q: { value_by_max_grade: 1, bar_by_grade: 1 }
		},
		'sample counts by diagnosis groups, leaf condition overlay'
	)

	compareResponseData(
		test,
		{
			term1: 'diaggrp',
			term2: 'Asthma',
			term2_q: { value_by_most_recent: 1, bar_by_grade: 1 }
		},
		'sample counts by diagnosis groups, leaf condition overlay'
	)

	compareResponseData(
		test,
		{
			term1: 'diaggrp',
			term2: 'Asthma',
			term2_q: { value_by_most_recent: 1, bar_by_grade: 1 },
			filter: {
				type: 'tvslst',
				in: true,
				join: 'and',
				lst: [
					{
						type: 'tvs',
						tvs: {
							term: { id: 'sex', name: 'Sex', type: 'categorical' },
							values: [{ key: '2', label: 'Female' }]
						}
					}
				]
			}
		},
		'filtered sample counts by diagnosis groups, leaf condition overlay'
	)

	compareResponseData(
		test,
		{
			term1: 'diaggrp',
			term2_is_genotype: 1,
			ssid,
			mname: 'T>C',
			chr: 'chr17',
			pos: 7666870
		},
		'sample counts by diagnosis group, genotype overlay'
	)
})

tape('numerical term1', function(test) {
	test.timeoutAfter(5000)
	test.plan(9)

	compareResponseData(
		test,
		{ term1: 'agedx', term1_q: termjson['agedx'].bins.less },
		'sample counts by age of diagnosis, no overlay'
	)

	compareResponseData(
		test,
		{
			term1: 'agedx',
			term1_q: termjson['agedx'].bins.less,
			filter: {
				type: 'tvslst',
				in: true,
				join: 'and',
				lst: [
					{
						type: 'tvs',
						tvs: {
							term: { id: 'sex', name: 'sex', type: 'categorical' },
							values: [{ key: '2', label: 'Female' }]
						}
					}
				]
			}
		},
		'filtered sample counts by age of diagnosis, no overlay'
	)

	compareResponseData(
		test,
		{
			term1: 'agedx',
			term1_q: termjson['agedx'].bins.less,
			term2: 'diaggrp'
		},
		'sample counts by age of diagnosis, categorical overlay'
	)

	compareResponseData(
		test,
		{
			term1: 'agedx',
			term1_q: termjson['agedx'].bins.less,
			term2: 'aaclassic_5',
			term2_q: termjson['aaclassic_5'].bins.less
		},
		'sample counts by age of diagnosis, numerical overlay'
	)

	compareResponseData(
		test,
		{
			term1: 'agedx',
			term1_q: {
				type: 'regular',
				bin_size: 5,
				stopinclusive: true,
				first_bin: {
					startunbounded: true,
					stop: 5,
					stopinclusive: true
				},
				last_bin: {
					start: 15,
					stopunbounded: true
				}
			},
			term2: 'Asthma',
			term2_q: { value_by_max_grade: 1, bar_by_grade: 1 }
		},
		'sample counts by age of diagnosis, condition overlay by max grade'
	)

	compareResponseData(
		test,
		{
			term1: 'agedx',
			term1_q: termjson['agedx'].bins.less,
			term2: 'Asthma',
			term2_q: { value_by_most_recent: 1, bar_by_grade: 1 }
		},
		'sample counts by age of diagnosis, condition overlay by most recent grade'
	)

	compareResponseData(
		test,
		{
			term1: 'agedx',
			term1_q: termjson['agedx'].bins.less,
			term2: 'Asthma',
			term2_q: { value_by_most_recent: 1, bar_by_grade: 1 },
			filter: {
				type: 'tvslst',
				in: true,
				join: 'and',
				lst: [
					{
						type: 'tvs',
						tvs: {
							term: { id: 'sex', name: 'Sex', type: 'categorical' },
							values: [{ key: '1', label: 'Male' }]
						}
					}
				]
			}
		},
		'sample counts by age of diagnosis, filtered, condition overlay by most recent grade'
	)

	compareResponseData(
		test,
		{
			term1: 'agedx',
			term1_q: termjson['agedx'].bins.less,
			term2_is_genotype: 1,
			ssid,
			mname: 'T>C',
			chr: 'chr17',
			pos: 7666870
		},
		'sample counts by age of diagnosis, genotype overlay'
	)

	compareResponseData(
		test,
		{
			term1: 'agedx',
			term1_q: {
				type: 'regular',
				bin_size: 5,
				first_bin: {
					start: 0,
					stop_percentile: 20
				},
				last_bin: {
					start_percentile: 80,
					stopunbounded: 1
				},
				startinclusive: 1,
				stopinclusive: 0
			}
		},
		'sample counts by age of diagnosis, custom bins, no overlay'
	)
})

tape('leaf condition term1', function(test) {
	test.timeoutAfter(5000)
	test.plan(11)

	compareResponseData(
		test,
		{
			term1: 'Asthma',
			term1_q: { value_by_max_grade: 1, bar_by_grade: 1 }
		},
		'sample counts by Asthma condition max-grade, no overlay'
	)

	compareResponseData(
		test,
		{
			term1: 'Asthma',
			term1_q: { value_by_max_grade: 1, bar_by_grade: 1 },
			filter: {
				type: 'tvslst',
				in: true,
				join: 'and',
				lst: [
					{
						type: 'tvs',
						tvs: {
							term: { id: 'sex', name: 'sex', type: 'categorical' },
							values: [{ key: '1', label: 'Male' }]
						}
					}
				]
			}
		},
		'filtered sample counts by Asthma condition max-grade, no overlay'
	)

	compareResponseData(
		test,
		{
			term1: 'Asthma',
			term1_q: { value_by_most_recent: 1, bar_by_grade: 1 }
		},
		'sample counts by Asthma condition most recent grade, no overlay'
	)

	compareResponseData(
		test,
		{
			term1: 'Asthma',
			term1_q: { value_by_max_grade: 1, bar_by_grade: 1 },
			term2: 'sex'
		},
		'sample counts by Asthma condition max grade, categorical overlay'
	)

	compareResponseData(
		test,
		{
			term1: 'Asthma',
			term1_q: { value_by_most_recent: 1, bar_by_grade: 1 },
			term2: 'diaggrp'
		},
		'sample counts by Asthma condition most recent grade, categorical overlay'
	)

	compareResponseData(
		test,
		{
			term1: 'Asthma',
			term1_q: { value_by_max_grade: 1, bar_by_grade: 1 },
			term2: 'agedx',
			term2_q: termjson['agedx'].bins.default
		},
		'sample counts by Asthma condition max grade, numerical overlay'
	)

	compareResponseData(
		test,
		{
			term1: 'Asthma',
			term1_q: { value_by_most_recent: 1, bar_by_grade: 1 },
			term2: 'aaclassic_5',
			term2_q: termjson['aaclassic_5'].bins.default
		},
		'sample counts by Asthma condition most recent grade, numerical overlay'
	)

	compareResponseData(
		test,
		{
			term1: 'Asthma',
			term1_q: { value_by_max_grade: 1, bar_by_grade: 1 },
			term2: 'Hearing loss',
			term2_q: { value_by_max_grade: 1, bar_by_grade: 1 }
		},
		'sample counts by Asthma condition max grade, condition overlay by max-grade'
	)

	compareResponseData(
		test,
		{
			term1: 'Asthma',
			term1_q: { value_by_most_recent: 1, bar_by_grade: 1 },
			term2: 'Hearing loss',
			term2_q: { value_by_max_grade: 1, bar_by_grade: 1 }
		},
		'sample counts by Asthma condition most recent grade, condition overlay by max-grade'
	)

	compareResponseData(
		test,
		{
			term1: 'Asthma',
			term1_q: { value_by_most_recent: 1, bar_by_grade: 1 },
			term2: 'Hearing loss',
			term2_q: { value_by_max_grade: 1, bar_by_grade: 1 },
			filter: {
				type: 'tvslst',
				in: true,
				join: 'and',
				lst: [
					{
						type: 'tvs',
						tvs: {
							term: { id: 'sex', name: 'Sex', type: 'categorical' },
							values: [{ key: '2', label: 'Female' }]
						}
					},
					{
						type: 'tvs',
						tvs: {
							term: { id: 'agedx', name: 'Age at diagnosis', type: 'float' },
							ranges: [{ start: 0, stop: 18 }]
						}
					}
				]
			}
		},
		'filtered sample counts by Asthma condition most recent grade, condition overlay by max-grade'
	)

	compareResponseData(
		test,
		{
			term1: 'Asthma',
			term1_q: { value_by_most_recent: 1, bar_by_grade: 1 },
			term2_is_genotype: 1,
			ssid,
			mname: 'T>C',
			chr: 'chr17',
			pos: 7666870
		},
		'sample counts by Asthma condition most recent grade, genotype overlay'
	)
})

tape('non-leaf condition term1', function(test) {
	test.timeoutAfter(7000)
	test.plan(13)

	compareResponseData(
		test,
		{
			term1: 'Cardiovascular System',
			term1_q: { value_by_max_grade: 1, bar_by_grade: 1 }
		},
		'sample counts by Cardiovascular System condition max-grade, no overlay'
	)

	compareResponseData(
		test,
		{
			term1: 'Cardiovascular System',
			term1_q: { value_by_max_grade: 1, bar_by_grade: 1 },
			filter: {
				type: 'tvslst',
				in: true,
				join: 'and',
				lst: [
					{
						type: 'tvs',
						tvs: {
							term: { id: 'sex', name: 'sex', type: 'categorical' },
							values: [{ key: '1', label: 'Male' }]
						}
					}
				]
			}
		},
		'filtered sample counts by Cardiovascular System condition max-grade, no overlay'
	)

	compareResponseData(
		test,
		{
			term1: 'Cardiovascular System',
			term1_q: { value_by_most_recent: 1, bar_by_grade: 1 }
		},
		'sample counts by Cardiovascular System condition most recent grade, no overlay'
	)

	compareResponseData(
		test,
		{
			term1: 'Arrhythmias',
			term1_q: { value_by_max_grade: 1, bar_by_children: 1 }
		},
		'sample counts by Arrhythmias condition by children, no overlay'
	)

	compareResponseData(
		test,
		{
			term1: 'Arrhythmias',
			term1_q: { value_by_computable_grade: 1, bar_by_children: 1 },
			filter: {
				type: 'tvslst',
				in: true,
				join: 'and',
				lst: [
					{
						type: 'tvs',
						tvs: {
							term: { id: 'sex', name: 'sex', type: 'categorical' },
							values: [{ key: '1', label: 'Male' }]
						}
					}
				]
			}
		},
		'filtered sample counts by Arrhythmias condition by children, no overlay'
	)

	compareResponseData(
		test,
		{
			term1: 'Arrhythmias',
			term1_q: { value_by_max_grade: 1, bar_by_grade: 1 },
			term2: 'sex'
		},
		'sample counts by Arrhythmias condition max grade, categorical overlay'
	)

	compareResponseData(
		test,
		{
			term1: 'Arrhythmias',
			term1_q: { value_by_most_recent: 1, bar_by_grade: 1 },
			term2: 'diaggrp'
		},
		'sample counts by Arrhythmias condition most recent grade, categorical overlay'
	)

	compareResponseData(
		test,
		{
			term1: 'Arrhythmias',
			term1_q: { value_by_max_grade: 1, bar_by_grade: 1 },
			term2: 'agedx',
			term2_q: termjson['agedx'].bins.default
		},
		'sample counts by Arrhythmias condition max grade, numerical overlay'
	)

	compareResponseData(
		test,
		{
			term1: 'Arrhythmias',
			term1_q: { value_by_most_recent: 1, bar_by_grade: 1 },
			term2: 'aaclassic_5',
			term2_q: termjson['aaclassic_5'].bins.default
		},
		'sample counts by Arrhythmias condition most recent grade, numerical overlay'
	)

	compareResponseData(
		test,
		{
			term1: 'Arrhythmias',
			term1_q: { value_by_max_grade: 1, bar_by_grade: 1 },
			term2: 'Hearing loss',
			term2_q: { value_by_max_grade: 1, bar_by_grade: 1 }
		},
		'sample counts by Arrhythmias condition max grade, condition overlay by max-grade'
	)

	compareResponseData(
		test,
		{
			term1: 'Arrhythmias',
			term1_q: { value_by_most_recent: 1, bar_by_grade: 1 },
			term2: 'Hearing loss',
			term2_q: { value_by_max_grade: 1, bar_by_grade: 1 }
		},
		'sample counts by Arrhythmias condition most recent grade, condition overlay by max-grade'
	)

	compareResponseData(
		test,
		{
			term1: 'Arrhythmias',
			term1_q: { value_by_most_recent: 1, bar_by_grade: 1 },
			term2: 'Hearing loss',
			term2_q: { value_by_max_grade: 1, bar_by_grade: 1 },
			filter: {
				type: 'tvslst',
				in: true,
				join: 'and',
				lst: [
					{
						type: 'tvs',
						tvs: {
							term: { id: 'sex', name: 'Sex', type: 'categorical' },
							values: [{ key: '2', label: 'Female' }]
						}
					},
					{
						type: 'tvs',
						tvs: {
							term: { id: 'Asthma', name: 'Asthma', type: 'condition' },
							bar_by_grade: true,
							values: [{ key: 1, label: '1' }],
							value_by_max_grade: true
						}
					}
				]
			}
		},
		'filtered sample counts by Arrhythmias condition most recent grade, condition overlay by max-grade'
	)

	compareResponseData(
		test,
		{
			term1: 'Arrhythmias',
			term1_q: { value_by_max_grade: 1, bar_by_grade: 1 },
			term2_is_genotype: 1,
			ssid,
			mname: 'T>C',
			chr: 'chr17',
			pos: 7666870
		},
		'sample counts by Arrhythmias condition most recent grade, genotype overlay'
	)
})

tape('term0 charts', function(test) {
	test.timeoutAfter(5000)
	test.plan(4)

	compareResponseData(
		test,
		{
			term0: 'sex',
			term1: 'diaggrp'
		},
		'categorical charts by sex, categorical bars by diagnosis group'
	)

	compareResponseData(
		test,
		{
			term0: 'agedx',
			term0_q: termjson['agedx'].bins.less,
			term1: 'sex'
		},
		'numerical charts by agedx, categorical bars by sex'
	)

	compareResponseData(
		test,
		{
			term0: 'Arrhythmias',
			term0_q: { value_by_most_recent: 1, bar_by_children: 1 },
			term1: 'sex'
		},
		'condition charts by Arrhythmias subcondition, categorical bars by sex'
	)

	compareResponseData(
		test,
		{
			term0_is_genotype: 1,
			term0: 'genotype',
			term1: 'diaggrp',
			ssid,
			mname: 'T>C',
			chr: 'chr17',
			pos: 7666870
		},
		'genotype charts, categorical bars by diagnosis'
	)
})
