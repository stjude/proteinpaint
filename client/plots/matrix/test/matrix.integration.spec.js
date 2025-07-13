import tape from 'tape'
import { termjson } from '#test/testdata/termjson.ts'
import * as helpers from '#test/front.helpers.js'
import { sleep, detectLst, detectGte } from '#test/test.helpers.js'
import { getSortOptions } from '../matrix.sort.js'
import {
	proteinChangingMutations,
	truncatingMutations,
	synonymousMutations,
	mutationClasses,
	CNVClasses
} from '#shared/common.js'

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('mass', {
	state: {
		dslabel: 'TermdbTest',
		genome: 'hg38-test'
	},
	debug: 1
})

function getGenes() {
	return [
		{ term: { gene: 'TP53', name: 'TP53', type: 'geneVariant', isleaf: true } },
		{ term: { gene: 'KRAS', name: 'KRAS', type: 'geneVariant', isleaf: true } },
		{ term: { gene: 'AKT1', name: 'AKT1', type: 'geneVariant', isleaf: true } }
	]
}

/**************
 test sections
***************/
tape('\n', function (test) {
	test.pass('-***- plots/matrix -***-')
	test.end()
})

tape('only dictionary terms', function (test) {
	test.timeoutAfter(5000)
	test.plan(5)
	runpp({
		state: {
			nav: {
				activeTab: 1
			},
			plots: [
				{
					chartType: 'matrix',
					settings: {
						matrix: {
							// the matrix autocomputes the colw based on available screen width,
							// need to set an exact screen width for consistent tests using getBBox()
							availContentWidth: 1200
						}
					},
					termgroups: [
						{
							name: 'Demographics',
							lst: [
								{
									id: 'aaclassic_5',
									q: {
										mode: 'continuous'
									}
								},
								{
									id: 'sex'
									//q: { mode: 'values' } // or 'groupsetting'
								},
								{
									id: 'agedx',
									q: {
										mode: 'discrete',
										type: 'regular-bin',
										bin_size: 5,
										first_bin: {
											startunbounded: true,
											stop: 5,
											stopinclusive: true
										}
									} // or 'continuous'
								},
								{
									id: 'Arrhythmias'
								}
							]
						}
					]
				}
			]
		},
		matrix: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(matrix) {
		matrix.on('postRender.test', null)
		test.equal(
			matrix.Inner.dom.seriesesG.selectAll('.sjpp-mass-series-g').size(),
			4,
			`should render the expected number of serieses`
		)
		test.equal(
			matrix.Inner.dom.seriesesG.selectAll('.sjpp-mass-series-g rect').size(),
			240,
			`should render the expected number of cell rects`
		)
		test.equal(
			matrix.Inner.dom.cluster.selectAll('.sjpp-matrix-clusteroutlines rect').size(),
			1,
			`should render the expected number of cluster rects`
		)
		// select the first series
		const sg0rects = matrix.Inner.dom.seriesesG.select('.sjpp-mass-series-g').selectAll('rect')
		test.equal(
			sg0rects.filter(d => d.key <= 0 && d.fill === 'transparent').size(),
			14,
			`should render special values with transparent rects`
		)
		const uniqueHts = new Set()
		sg0rects.each(d => uniqueHts.add(d.height))
		test.equal(uniqueHts.size, 45, `should render different rect heights for continuous mode bar plots`)

		// TODO: test for matrix bar plots of continuous mode terms with allowed negative value

		if (test._ok) matrix.Inner.app.destroy()
		test.end()
	}
})

tape('with divide by terms', function (test) {
	test.timeoutAfter(5000)
	test.plan(3)
	runpp({
		state: {
			nav: {
				activeTab: 1
			},
			plots: [
				{
					chartType: 'matrix',
					settings: {
						// the matrix autocomputes the colw based on available screen width,
						// need to set an exact screen width for consistent tests using getBBox()
						matrix: {
							availContentWidth: 1200
						}
					},
					divideBy: {
						id: 'sex'
					},
					termgroups: [
						{
							name: 'Demographics',
							lst: [
								{ id: 'agedx', term: termjson['agedx'] },
								{ id: 'diaggrp', term: termjson['diaggrp'] },
								{ id: 'aaclassic_5', term: termjson['aaclassic_5'] }
							]
						}
					]
				}
			]
		},
		matrix: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(matrix) {
		matrix.on('postRender.test', null)
		test.equal(
			matrix.Inner.dom.seriesesG.selectAll('.sjpp-mass-series-g').size(),
			3,
			`should render the expected number of serieses`
		)
		test.equal(
			matrix.Inner.dom.seriesesG.selectAll('.sjpp-mass-series-g rect').size(),
			180,
			`should render the expected number of cell rects`
		)
		test.equal(
			matrix.Inner.dom.cluster.selectAll('.sjpp-matrix-clusteroutlines rect').size(),
			2,
			`should render the expected number of cluster rects`
		)

		if (test._ok) matrix.Inner.app.destroy()
		test.end()
	}
})

tape('long column group labels', function (test) {
	test.timeoutAfter(5000)
	test.plan(2)
	runpp({
		state: {
			nav: {
				activeTab: 1
			},
			plots: [
				{
					chartType: 'matrix',
					settings: {
						// the matrix autocomputes the colw based on available screen width,
						// need to set an exact screen width for consistent tests using getBBox()
						matrix: {
							availContentWidth: 1200
						}
					},
					divideBy: {
						id: 'diaggrp'
					},
					termgroups: [
						{
							name: 'Demographics',
							lst: [
								{ id: 'diaggrp', term: termjson['diaggrp'] },
								{ id: 'agedx', term: termjson['agedx'] },
								{ id: 'aaclassic_5', term: termjson['aaclassic_5'] }
							]
						}
					]
				}
			]
		},
		matrix: {
			callbacks: {
				'postRender.test222': runTests
			}
		}
	})

	function runTests(matrix) {
		matrix.on('postRender.test222', null)
		const y = matrix.Inner.dom.clipRect.property('y').baseVal.value
		test.true(y > -63 && y < -62, `should adjust the clip-path rect y-value to between -39 and -38, actual=${y}`)
		const h = matrix.Inner.dom.clipRect.property('height').baseVal.value
		test.true(h > 619 && h <= 620, `should adjust the clip-path height to between 595 and 596, actual=${h}`)

		if (test._ok) matrix.Inner.app.destroy()
		test.end()
	}
})

tape('divide by continuous terms', function (test) {
	test.timeoutAfter(5000)
	test.plan(3)
	runpp({
		state: {
			nav: {
				activeTab: 1
			},
			plots: [
				{
					chartType: 'matrix',
					settings: {
						// the matrix autocomputes the colw based on available screen width,
						// need to set an exact screen width for consistent tests using getBBox()
						matrix: {
							availContentWidth: 1200
						}
					},
					divideBy: {
						id: 'agedx'
					},
					termgroups: [
						{
							name: 'Demographics',
							lst: [
								{ id: 'sex', term: termjson['sex'] },
								{ id: 'diaggrp', term: termjson['diaggrp'] },
								{ id: 'aaclassic_5', term: termjson['aaclassic_5'] }
							]
						}
					]
				}
			]
		},
		matrix: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(matrix) {
		matrix.on('postRender.test', null)
		test.equal(
			matrix.Inner.dom.seriesesG.selectAll('.sjpp-mass-series-g').size(),
			3,
			`should render the expected number of serieses`
		)
		test.equal(
			matrix.Inner.dom.seriesesG.selectAll('.sjpp-mass-series-g rect').size(),
			180,
			`should render the expected number of cell rects`
		)
		test.equal(
			matrix.Inner.dom.cluster.selectAll('.sjpp-matrix-clusteroutlines rect').size(),
			5,
			`should render the expected number of cluster rects`
		)

		if (test._ok) matrix.Inner.app.destroy()
		test.end()
	}
})

tape('geneVariant term', function (test) {
	test.timeoutAfter(5000)
	test.plan(2)
	runpp({
		state: {
			nav: {
				activeTab: 1
			},
			plots: [
				{
					chartType: 'matrix',
					settings: {
						// the matrix autocomputes the colw based on available screen width,
						// need to set an exact screen width for consistent tests using getBBox()
						matrix: {
							availContentWidth: 1200
						}
					},
					termgroups: [
						{
							name: '',
							lst: [{ term: { gene: 'TP53', name: 'TP53', type: 'geneVariant', isleaf: true } }]
						}
					]
				}
			]
		},
		matrix: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(matrix) {
		matrix.on('postRender.test', null)
		test.equal(
			matrix.Inner.dom.seriesesG.selectAll('.sjpp-mass-series-g').size(),
			1,
			`should render the expected number of serieses`
		)
		test.equal(
			matrix.Inner.dom.seriesesG.selectAll('.sjpp-mass-series-g rect').size(),
			240,
			`should render the expected number of cell rects`
		)
		if (test._ok) matrix.Inner.app.destroy()
		test.end()
	}
})

tape('geneVariant terms and dictionary terms', function (test) {
	test.timeoutAfter(5000)
	test.plan(3)
	runpp({
		state: {
			nav: {
				activeTab: 1
			},
			plots: [
				{
					chartType: 'matrix',
					settings: {
						// the matrix autocomputes the colw based on available screen width,
						// need to set an exact screen width for consistent tests using getBBox()
						matrix: {
							availContentWidth: 1200
						}
					},
					termgroups: [
						{
							name: '',
							lst: [
								...getGenes(),
								{ id: 'agedx', term: termjson['agedx'] },
								{ id: 'diaggrp', term: termjson['diaggrp'] },
								{ id: 'aaclassic_5', term: termjson['aaclassic_5'] }
							]
						}
					]
				}
			]
		},
		matrix: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(matrix) {
		matrix.on('postRender.test', null)
		test.equal(
			matrix.Inner.dom.seriesesG.selectAll('.sjpp-mass-series-g').size(),
			6,
			`should render the expected number of serieses`
		)
		test.equal(
			matrix.Inner.dom.seriesesG.selectAll('.sjpp-mass-series-g rect').size(),
			900,
			`should render the expected number of cell rects`
		)
		test.equal(
			matrix.Inner.dom.cluster.selectAll('.sjpp-matrix-clusteroutlines rect').size(),
			1,
			`should render the expected number of cluster rects`
		)
		if (test._ok) matrix.Inner.app.destroy()
		test.end()
	}
})

tape('geneVariant terms with divide by dictionary term', function (test) {
	test.timeoutAfter(5000)
	test.plan(3)
	runpp({
		state: {
			nav: {
				activeTab: 1
			},
			plots: [
				{
					chartType: 'matrix',
					settings: {
						// the matrix autocomputes the colw based on available screen width,
						// need to set an exact screen width for consistent tests using getBBox()
						matrix: {
							availContentWidth: 1200
						}
					},
					divideBy: {
						id: 'sex'
					},
					termgroups: [
						{
							name: '',
							lst: getGenes()
						}
					]
				}
			]
		},
		matrix: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(matrix) {
		matrix.on('postRender.test', null)
		test.equal(
			matrix.Inner.dom.seriesesG.selectAll('.sjpp-mass-series-g').size(),
			3,
			`should render the expected number of serieses`
		)
		test.equal(
			matrix.Inner.dom.seriesesG.selectAll('.sjpp-mass-series-g rect').size(),
			720,
			`should render the expected number of cell rects`
		)
		test.equal(
			matrix.Inner.dom.cluster.selectAll('.sjpp-matrix-clusteroutlines rect').size(),
			2,
			`should render the expected number of cluster rects`
		)
		if (test._ok) matrix.Inner.app.destroy()
		test.end()
	}
})

tape('geneVariant terms and dictionary terms divide by dictionary term', function (test) {
	test.timeoutAfter(5000)
	test.plan(3)
	runpp({
		state: {
			nav: {
				activeTab: 1
			},
			plots: [
				{
					chartType: 'matrix',
					settings: {
						// the matrix autocomputes the colw based on available screen width,
						// need to set an exact screen width for consistent tests using getBBox()
						matrix: {
							availContentWidth: 1200
						}
					},
					divideBy: {
						id: 'sex'
					},
					termgroups: [
						{
							name: '',
							lst: [
								...getGenes(),
								{ id: 'agedx', term: termjson['agedx'] },
								{ id: 'diaggrp', term: termjson['diaggrp'] },
								{ id: 'aaclassic_5', term: termjson['aaclassic_5'] }
							]
						}
					]
				}
			]
		},
		matrix: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(matrix) {
		matrix.on('postRender.test', null)
		test.equal(
			matrix.Inner.dom.seriesesG.selectAll('.sjpp-mass-series-g').size(),
			6,
			`should render the expected number of serieses`
		)
		test.equal(
			matrix.Inner.dom.seriesesG.selectAll('.sjpp-mass-series-g rect').size(),
			900,
			`should render the expected number of cell rects`
		)
		test.equal(
			matrix.Inner.dom.cluster.selectAll('.sjpp-matrix-clusteroutlines rect').size(),
			2,
			`should render the expected number of cluster rects`
		)
		if (test._ok) matrix.Inner.app.destroy()
		test.end()
	}
})

tape('sort samples by sample name', function (test) {
	test.timeoutAfter(5000)
	test.plan(4)
	runpp({
		state: {
			nav: {
				activeTab: 1
			},
			plots: [
				{
					chartType: 'matrix',
					settings: {
						// the matrix autocomputes the colw based on available screen width,
						// need to set an exact screen width for consistent tests using getBBox()
						matrix: {
							availContentWidth: 1200,
							sortSamplesBy: 'name'
						}
					},
					termgroups: [
						{
							name: '',
							lst: getGenes()
						}
					]
				}
			]
		},
		matrix: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(matrix) {
		matrix.on('postRender.test', null)
		const g = matrix.Inner.dom.sampleLabelsPG.selectAll('.sjpp-matrix-series-label-g g')
		test.equal(g.size(), 60, `should render the expected number of sample names`)
		test.equal(g._groups[0][0].textContent, '2646', `should be the expected sample name`)
		test.equal(g._groups[0][9].textContent, '2772', `should be the expected sample name`)
		test.equal(g._groups[0][59].textContent, '3472', `should be the expected sample name`)
		if (test._ok) matrix.Inner.app.destroy()
		test.end()
	}
})

tape('sort samples by Mutation categories, not sorted by CNV', function (test) {
	test.timeoutAfter(5000)
	test.plan(4)
	runpp({
		state: {
			nav: {
				activeTab: 1
			},
			plots: [
				{
					chartType: 'matrix',
					settings: {
						// the matrix autocomputes the colw based on available screen width,
						// need to set an exact screen width for consistent tests using getBBox()
						matrix: {
							availContentWidth: 1200,
							sortSamplesBy: 'a'
						}
					},
					termgroups: [
						{
							name: 'Demographics',
							lst: getGenes()
						}
					]
				}
			]
		},
		matrix: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(matrix) {
		matrix.on('postRender.test', null)
		test.equal(
			matrix.Inner.dom.sampleLabelsPG.selectAll('.sjpp-matrix-series-label-g g').size(),
			60,
			`should render the expected number of sample names`
		)
		const rects = matrix.Inner.dom.sampleLabelsPG.selectAll('.sjpp-matrix-series-label-g g')._groups[0]
		const index_3346 = Array.from(rects).find(rect => rect.textContent == '3346').__data__.index
		test.true(index_3346 < 10, `sample 3346 should be in the expected order (not sorted by CNV)`)
		const index_2660 = Array.from(rects).find(rect => rect.textContent == '2660').__data__.index
		test.equal(index_2660, 8, `sample 2660 should be in the expected order (not sorted by CNV)`)
		const index_3472 = Array.from(rects).find(rect => rect.textContent == '3472').__data__.index
		test.true(index_3472 > 9, `sample 3472 should be in the expected order (not sorted by CNV)`)
		if (test._ok) matrix.Inner.app.destroy()
		test.end()
	}
})

tape('sort samples by CNV+SSM > SSM-only', function (test) {
	test.timeoutAfter(5000)
	test.plan(5)
	const sortOptions = getSortOptions(
		undefined,
		{},
		{
			proteinChangingMutations,
			truncatingMutations,
			synonymousMutations,
			mutationClasses,
			CNVClasses
		}
	)

	const cnvtb = sortOptions.a.sortPriority[0].tiebreakers[2]
	cnvtb.disabled = false

	runpp({
		state: {
			nav: {
				activeTab: 1
			},
			plots: [
				{
					chartType: 'matrix',
					legendValueFilter: {
						type: 'tvslst',
						lst: []
					},
					settings: {
						// the matrix autocomputes the colw based on available screen width,
						// need to set an exact screen width for consistent tests using getBBox()
						matrix: {
							availContentWidth: 1200,
							sortSamplesBy: 'a',
							sortOptions
						}
					},
					termgroups: [
						{
							name: '',
							lst: getGenes()
						}
					]
				}
			]
		},
		matrix: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(matrix) {
		matrix.on('postRender.test', null)
		test.equal(
			matrix.Inner.dom.sampleLabelsPG.selectAll('.sjpp-matrix-series-label-g g').size(),
			60,
			`should render the expected number of sample names`
		)
		const rects = matrix.Inner.dom.sampleLabelsPG.selectAll('.sjpp-matrix-series-label-g g')._groups[0]
		const r = Array.from(rects)
		const index_3416 = r.find(rect => rect.textContent == '3416').__data__.index
		test.equal(index_3416, 0, `should be in the expected order`)
		const index_3346 = r.find(rect => rect.textContent == '3346').__data__.index
		test.equal(index_3346, 9, `should be in the expected order`)
		const index_2660 = r.find(rect => rect.textContent == '2660').__data__.index
		test.equal(index_2660, 11, `should be in the expected order`)
		const index_3472 = r.find(rect => rect.textContent == '3472').__data__.index
		test.equal(index_3472, r.length - 1, `should be in the expected order`)
		if (test._ok) matrix.Inner.app.destroy()
		test.end()
	}
})

tape('set max number of samples', function (test) {
	test.timeoutAfter(5000)
	test.plan(1)
	runpp({
		state: {
			nav: {
				activeTab: 1
			},
			plots: [
				{
					chartType: 'matrix',
					settings: {
						matrix: {
							// the matrix autocomputes the colw based on available screen width,
							// need to set an exact screen width for consistent tests using getBBox()
							availContentWidth: 1200,
							maxSample: 10
						}
					},
					termgroups: [
						{
							name: '',
							lst: [
								{
									id: 'sex'
									//q: { mode: 'values' } // or 'groupsetting'
								}
							]
						}
					]
				}
			]
		},
		matrix: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(matrix) {
		matrix.on('postRender.test', null)
		test.equal(
			matrix.Inner.dom.seriesesG.selectAll('.sjpp-mass-series-g rect').size(),
			10,
			`should render the expected number of cell rects`
		)
		if (test._ok) matrix.Inner.app.destroy()
		test.end()
	}
})

tape('sort sample groups by Group Name', function (test) {
	test.timeoutAfter(5000)
	test.plan(2)
	runpp({
		state: {
			nav: {
				activeTab: 1
			},
			plots: [
				{
					chartType: 'matrix',
					settings: {
						// the matrix autocomputes the colw based on available screen width,
						// need to set an exact screen width for consistent tests using getBBox()
						matrix: {
							availContentWidth: 1200,
							sortSampleGrpsBy: 'name'
						}
					},
					divideBy: {
						id: 'genetic_race'
					},
					termgroups: [
						{
							name: '',
							lst: getGenes()
						}
					]
				}
			]
		},
		matrix: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(matrix) {
		matrix.on('postRender.test', null)
		const matrixGroupLabels = matrix.Inner.dom.sampleLabelsPG.selectAll(
			'.sjpp-matrix-series-group-label-g .sjpp-matrix-label'
		)._groups[0]
		test.true(matrixGroupLabels[0].textContent.startsWith('African Ancestry'), `should be the expected group name`)
		test.true(matrixGroupLabels[2].textContent.startsWith('European Ancestry'), `should be the expected group name`)
		if (test._ok) matrix.Inner.app.destroy()
		test.end()
	}
})

tape('sort sample groups by Sample Count', function (test) {
	test.timeoutAfter(5000)
	test.plan(2)
	runpp({
		state: {
			nav: {
				activeTab: 1
			},
			plots: [
				{
					chartType: 'matrix',
					settings: {
						// the matrix autocomputes the colw based on available screen width,
						// need to set an exact screen width for consistent tests using getBBox()
						matrix: {
							availContentWidth: 1200,
							sortSampleGrpsBy: 'sampleCount'
						}
					},
					divideBy: {
						id: 'genetic_race'
					},
					termgroups: [
						{
							name: '',
							lst: getGenes()
						}
					]
				}
			]
		},
		matrix: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(matrix) {
		matrix.on('postRender.test', null)
		const matrixGroupLabels = matrix.Inner.dom.sampleLabelsPG.selectAll(
			'.sjpp-matrix-series-group-label-g .sjpp-matrix-label'
		)._groups[0]
		test.true(matrixGroupLabels[0].textContent.startsWith('European Ancestry'), `should be the expected group name`)
		test.true(matrixGroupLabels[2].textContent.startsWith('Asian Ancestry'), `should be the expected group name`)
		if (test._ok) matrix.Inner.app.destroy()
		test.end()
	}
})

tape('sort sample groups by Hits', function (test) {
	test.timeoutAfter(5000)
	test.plan(2)
	runpp({
		state: {
			nav: {
				activeTab: 1
			},
			plots: [
				{
					chartType: 'matrix',
					settings: {
						// the matrix autocomputes the colw based on available screen width,
						// need to set an exact screen width for consistent tests using getBBox()
						matrix: {
							availContentWidth: 1200,
							sortSampleGrpsBy: 'hits'
						}
					},
					divideBy: {
						id: 'Hearing loss'
					},
					termgroups: [
						{
							name: '',
							lst: getGenes()
						}
					]
				}
			]
		},
		matrix: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(matrix) {
		matrix.on('postRender.test', null)
		const matrixGroupLabels = matrix.Inner.dom.sampleLabelsPG.selectAll(
			'.sjpp-matrix-series-group-label-g .sjpp-matrix-label'
		)._groups[0]
		test.true(matrixGroupLabels[0].textContent.startsWith('3: Severe'), `should be the expected group name`)
		test.true(matrixGroupLabels[4].textContent.startsWith('1: Mild'), `should be the expected group name`)
		if (test._ok) matrix.Inner.app.destroy()
		test.end()
	}
})

tape('sort sample groups by Hits 2', function (test) {
	test.timeoutAfter(5000)
	test.plan(2)
	runpp({
		state: {
			nav: {
				activeTab: 1
			},
			plots: [
				{
					id: 'xyz',
					chartType: 'matrix',
					settings: {
						// the matrix autocomputes the colw based on available screen width,
						// need to set an exact screen width for consistent tests using getBBox()
						matrix: {
							availContentWidth: 1200,
							sortSampleGrpsBy: 'hits'
						}
					},
					divideBy: {
						id: 'agedx'
					},
					termgroups: [
						{
							name: '',
							lst: getGenes()
						}
					]
				}
			]
		},
		matrix: {
			callbacks: {
				postRender: runTests
			}
		}
	})

	function runTests(matrix) {
		matrix.on('postRender', null)
		const matrixGroupLabels = matrix.Inner.dom.sampleLabelsPG.selectAll(
			'.sjpp-matrix-series-group-label-g .sjpp-matrix-label'
		)._groups[0]
		test.true(matrixGroupLabels[0].textContent.startsWith('10 to <15'), `should have the expected left-most group name`)
		test.true(matrixGroupLabels[4].textContent.startsWith('≥20'), `should have the right-most expected group name`)
		if (test._ok) matrix.Inner.app.destroy()
		test.end()
	}
})

tape('Display Sample Counts for Gene: Absolute', function (test) {
	test.timeoutAfter(5000)
	test.plan(2)
	runpp({
		state: {
			nav: {
				activeTab: 1
			},
			plots: [
				{
					chartType: 'matrix',
					settings: {
						// the matrix autocomputes the colw based on available screen width,
						// need to set an exact screen width for consistent tests using getBBox()
						matrix: {
							availContentWidth: 1200,
							samplecount4gene: 'abs'
						}
					},
					termgroups: [
						{
							name: '',
							lst: getGenes()
						}
					]
				}
			]
		},
		matrix: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(matrix) {
		matrix.on('postRender.test', null)

		const termLabels = matrix.Inner.dom.termLabelG.selectAll('.sjpp-matrix-term-label-g .sjpp-matrix-label')._groups[0]
		const pattern = /\(\d+\)/
		test.true(pattern.test(termLabels[0].textContent), `should display sample counts for gene by absolute number`)
		test.true(
			pattern.test(termLabels[termLabels.length - 1].textContent),
			`should display sample counts for gene by absolute number`
		)
		if (test._ok) matrix.Inner.app.destroy()
		test.end()
	}
})

tape('Display Sample Counts for Gene: Percent', function (test) {
	test.timeoutAfter(5000)
	test.plan(2)
	runpp({
		state: {
			nav: {
				activeTab: 1
			},
			plots: [
				{
					chartType: 'matrix',
					settings: {
						// the matrix autocomputes the colw based on available screen width,
						// need to set an exact screen width for consistent tests using getBBox()
						matrix: {
							availContentWidth: 1200,
							samplecount4gene: 'pct'
						}
					},
					termgroups: [
						{
							name: '',
							lst: getGenes()
						}
					]
				}
			]
		},
		matrix: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(matrix) {
		matrix.on('postRender.test', null)

		const termLabels = matrix.Inner.dom.termLabelG.selectAll('.sjpp-matrix-term-label-g .sjpp-matrix-label')._groups[0]
		const pattern = /\(\d+(\.\d+)? ?%\)/
		test.true(pattern.test(termLabels[0].textContent), `should display sample counts for gene by percentage`)
		test.true(
			pattern.test(termLabels[termLabels.length - 1].textContent),
			`should display sample counts for gene by percentage`
		)
		if (test._ok) matrix.Inner.app.destroy()
		test.end()
	}
})

tape('Display Sample Counts for Gene: None', function (test) {
	test.timeoutAfter(5000)
	test.plan(2)
	runpp({
		state: {
			nav: {
				activeTab: 1
			},
			plots: [
				{
					chartType: 'matrix',
					settings: {
						// the matrix autocomputes the colw based on available screen width,
						// need to set an exact screen width for consistent tests using getBBox()
						matrix: {
							availContentWidth: 1200,
							samplecount4gene: ''
						}
					},
					termgroups: [
						{
							name: '',
							lst: getGenes()
						}
					]
				}
			]
		},
		matrix: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(matrix) {
		matrix.on('postRender.test', null)

		const termLabels = matrix.Inner.dom.termLabelG.selectAll('.sjpp-matrix-term-label-g .sjpp-matrix-label')._groups[0]
		const pattern = /\(\d+(\.\d+)?%\)|\(\d+\)/g
		test.true(!pattern.test(termLabels[0].textContent), `should not display sample counts for gene`)
		test.true(!pattern.test(termLabels[termLabels.length - 1].textContent), `should not display sample counts for gene`)
		if (test._ok) matrix.Inner.app.destroy()
		test.end()
	}
})

tape('Sort Genes By Sample Count', function (test) {
	test.timeoutAfter(5000)
	test.plan(2)
	runpp({
		state: {
			nav: {
				activeTab: 1
			},
			plots: [
				{
					chartType: 'matrix',
					settings: {
						// the matrix autocomputes the colw based on available screen width,
						// need to set an exact screen width for consistent tests using getBBox()
						matrix: {
							availContentWidth: 1200,
							sortTermsBy: 'sampleCount'
						}
					},
					termgroups: [
						{
							name: '',
							lst: getGenes()
						}
					]
				}
			]
		},
		matrix: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(matrix) {
		matrix.on('postRender.test', null)

		const termLabels = matrix.Inner.dom.termLabelG.selectAll('.sjpp-matrix-term-label-g .sjpp-matrix-label')._groups[0]
		test.true(termLabels[0].textContent.startsWith('AKT1'), `should sort genes by sample count`)
		test.true(termLabels[2].textContent.startsWith('KRAS'), `should sort genes by sample count`)
		if (test._ok) matrix.Inner.app.destroy()
		test.end()
	}
})

tape('Sort Genes By Input Data Order', function (test) {
	test.timeoutAfter(5000)
	test.plan(2)
	runpp({
		state: {
			nav: {
				activeTab: 1
			},
			plots: [
				{
					chartType: 'matrix',
					settings: {
						// the matrix autocomputes the colw based on available screen width,
						// need to set an exact screen width for consistent tests using getBBox()
						matrix: {
							availContentWidth: 1200,
							sortTermsBy: 'asListed'
						}
					},
					termgroups: [
						{
							name: '',
							lst: getGenes()
						}
					]
				}
			]
		},
		matrix: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(matrix) {
		matrix.on('postRender.test', null)

		const termLabels = matrix.Inner.dom.termLabelG.selectAll('.sjpp-matrix-term-label-g .sjpp-matrix-label')._groups[0]
		test.true(termLabels[0].textContent.startsWith('TP53'), `should sort genes by input data order`)
		test.true(termLabels[2].textContent.startsWith('AKT1'), `should sort genes by input data order`)
		if (test._ok) matrix.Inner.app.destroy()
		test.end()
	}
})

tape('avoid race condition', function (test) {
	test.timeoutAfter(1500)
	test.plan(4)
	runpp({
		state: {
			nav: {
				activeTab: 1
			},
			plots: [
				{
					chartType: 'matrix',
					settings: {
						// the matrix autocomputes the colw based on available screen width,
						// need to set an exact screen width for consistent tests using getBBox()
						matrix: {
							availContentWidth: 1200,
							sortTermsBy: 'asListed'
						}
					},
					termgroups: [
						{
							name: '',
							lst: getGenes()
						}
					]
				}
			]
		},
		matrix: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(matrix) {
		matrix.on('postRender.test', null)
		matrix.Inner.app.vocabApi.origGetAnnotatedSampleData = matrix.Inner.app.vocabApi.getAnnotatedSampleData
		matrix.Inner.app.vocabApi.getAnnotatedSampleData = async (opts, _refs = {}) => {
			await sleep(i)
			i = 0
			const data = await matrix.Inner.app.vocabApi.origGetAnnotatedSampleData(opts, _refs)
			return data
		}
		// set up the postRender callback before triggering rerenders via app.dispatch
		matrix.on('postRender.test', async () => {
			matrix.on('postRender.test', null)
			// run tests after the delayed response, as part of simulating the race condition
			await sleep(responseDelay + 300)
			const termLabels = matrix.Inner.dom.termLabelG.selectAll('.sjpp-matrix-term-label-g .sjpp-matrix-label')
			test.equal(termLabels.size(), 1, `should have 1 gene row`)
			test.true(termLabels._groups?.[0][0].textContent.startsWith('BCR'), `should sort genes by input data order`)
			const rects = matrix.Inner.dom.seriesesG.selectAll('.sjpp-mass-series-g rect')
			const hits = rects.filter(d => d.key === 'BCR' && d.value.class != 'WT' && d.value.class != 'Blank')
			test.equal(
				rects.size(),
				240,
				'should have the expected total number of matrix cell rects, inlcuding WT and not tested'
			)
			test.equal(hits.size(), 2, 'should have the expected number of matrix cell rects with hits')
			if (test._ok) matrix.Inner.app.destroy()
			test.end()
		})

		const responseDelay = 10
		let i = responseDelay
		try {
			const results = await Promise.all([
				matrix.Inner.app.dispatch({
					type: 'plot_edit',
					id: matrix.id,
					config: {
						termgroups: [
							{
								name: '',
								lst: [
									// $id is added manually since fillTermWrapper() is not called here and
									// cannot be assumed to be called within store.plot_edit()
									{
										$id: 0,
										term: {
											gene: 'KRAS',
											name: 'KRAS',
											type: 'geneVariant',
											isleaf: true,
											groupsetting: { disabled: false }
										},
										q: { type: 'values' }
									},
									{
										$id: 1,
										term: {
											gene: 'AKT1',
											name: 'AKT1',
											type: 'geneVariant',
											isleaf: true,
											groupsetting: { disabled: false }
										},
										q: { type: 'values' }
									}
								]
							}
						]
					}
				}),
				(async () => {
					await sleep(1)
					matrix.Inner.app.dispatch({
						type: 'plot_edit',
						id: matrix.id,
						config: {
							termgroups: [
								{
									name: '',
									// $id is added manually since fillTermWrapper() is not called here and
									// cannot be assumed to be called within store.plot_edit()
									lst: [
										{
											$id: 3,
											term: {
												gene: 'BCR',
												name: 'BCR',
												type: 'geneVariant',
												isleaf: true,
												groupsetting: { disabled: false }
											},
											q: { type: 'values' }
										}
									]
								}
							]
						}
					})
				})()
			])
		} catch (e) {
			test.fail('error: ' + e)
			throw e
		}
	}
})

// legend filter tests
tape('apply "hide" legend filters to a dictionary term', function (test) {
	test.timeoutAfter(5000)
	test.plan(10)
	runpp({
		state: {
			nav: {
				activeTab: 1
			},
			plots: [
				{
					chartType: 'matrix',
					settings: {
						matrix: {
							// the matrix autocomputes the colw based on available screen width,
							// need to set an exact screen width for consistent tests using getBBox()
							availContentWidth: 1200
						}
					},
					termgroups: [
						{
							name: 'Demographics',
							lst: [
								{
									id: 'aaclassic_5',
									q: {
										mode: 'continuous'
									}
								},
								{
									id: 'genetic_race'
									//q: { mode: 'values' } // or 'groupsetting'
								},
								{
									id: 'agedx',
									q: {
										mode: 'discrete',
										type: 'regular-bin',
										bin_size: 5,
										first_bin: {
											startunbounded: true,
											stop: 5,
											stopinclusive: true
										}
									} // or 'continuous'
								}
							]
						}
					]
				}
			]
		},
		matrix: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(matrix) {
		matrix.on('postRender.test', null)

		// 1. Hide
		const legendTexts = [...matrix.Inner.dom.legendG.node().querySelectorAll('g g text')].find(d =>
			d?.__data__?.text?.startsWith('Asian')
		)
		legendTexts.dispatchEvent(
			new MouseEvent('mouseup', {
				bubbles: true,
				cancelable: true
			})
		)

		const options = matrix.Inner.dom.legendMenu.d.node().querySelectorAll('div.sja_menuoption.sja_sharp_border')

		test.equal(options[0].innerText, 'Hide', `First option should be Hide`)
		test.equal(options[1].innerText, 'Show only', `second option should be Show only`)
		test.equal(options[2].innerText, 'Show all', `third option should be Show all`)

		const rects = await detectLst({
			elem: matrix.Inner.dom.seriesesG.node(),
			selector: '.sjpp-mass-series-g rect',
			count: 177,
			trigger: () => {
				options[0].dispatchEvent(
					new MouseEvent('click', {
						bubbles: true,
						cancelable: true
					})
				)
			}
		})

		test.equal(
			matrix.Inner.dom.seriesesG.selectAll('.sjpp-mass-series-g').size(),
			3,
			`should render the expected number of serieses`
		)
		test.equal(
			matrix.Inner.dom.cluster.selectAll('.sjpp-matrix-clusteroutlines rect').size(),
			1,
			`should render the expected number of cluster rects`
		)

		// 2. Show
		const legendTexts2 = [...matrix.Inner.dom.legendG.node().querySelectorAll('g g text')].find(d =>
			d?.__data__?.text?.startsWith('Asian')
		)
		legendTexts2.dispatchEvent(
			new MouseEvent('mouseup', {
				bubbles: true,
				cancelable: true
			})
		)

		const options2 = matrix.Inner.dom.legendMenu.d.node().querySelectorAll('div.sja_menuoption.sja_sharp_border')

		test.equal(options2[0].innerText, 'Show', `First option should be Show`)
		test.equal(options2[1].innerText, 'Show only', `second option should be Show only`)
		test.equal(options2[2].innerText, 'Show all', `third option should be Show all`)

		const rects2 = await detectLst({
			elem: matrix.Inner.dom.seriesesG.node(),
			selector: '.sjpp-mass-series-g rect',
			count: 180,
			trigger: () => {
				options2[0].dispatchEvent(
					new MouseEvent('click', {
						bubbles: true,
						cancelable: true
					})
				)
			}
		})

		test.equal(
			matrix.Inner.dom.seriesesG.selectAll('.sjpp-mass-series-g').size(),
			3,
			`should render the expected number of serieses`
		)
		test.equal(
			matrix.Inner.dom.cluster.selectAll('.sjpp-matrix-clusteroutlines rect').size(),
			1,
			`should render the expected number of cluster rects`
		)

		if (test._ok) matrix.Inner.app.destroy()
		test.end()
	}
})

tape('apply "show only" and "show all" legend filters to dictionary terms', function (test) {
	test.timeoutAfter(5000)
	test.plan(14)
	runpp({
		state: {
			nav: {
				activeTab: 1
			},
			plots: [
				{
					chartType: 'matrix',
					settings: {
						matrix: {
							// the matrix autocomputes the colw based on available screen width,
							// need to set an exact screen width for consistent tests using getBBox()
							availContentWidth: 1200
						}
					},
					termgroups: [
						{
							name: 'Demographics',
							lst: [
								{
									id: 'aaclassic_5',
									q: {
										mode: 'continuous'
									}
								},
								{
									id: 'sex'
									//q: { mode: 'values' } // or 'groupsetting'
								},
								{
									id: 'agedx',
									q: {
										mode: 'discrete',
										type: 'regular-bin',
										bin_size: 5,
										first_bin: {
											startunbounded: true,
											stop: 5,
											stopinclusive: true
										}
									} // or 'continuous'
								}
							]
						}
					]
				}
			]
		},
		matrix: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(matrix) {
		matrix.on('postRender.test', null)

		// 1. Show only
		const legendTexts = [...matrix.Inner.dom.legendG.node().querySelectorAll('g g text')].find(d =>
			d?.__data__?.text?.startsWith('Male')
		)
		legendTexts.dispatchEvent(
			new MouseEvent('mouseup', {
				bubbles: true,
				cancelable: true
			})
		)

		const options = matrix.Inner.dom.legendMenu.d.node().querySelectorAll('div.sja_menuoption.sja_sharp_border')

		const rects = await detectLst({
			elem: matrix.Inner.dom.seriesesG.node(),
			selector: '.sjpp-mass-series-g rect',
			count: 75,
			trigger: () => {
				options[1].dispatchEvent(
					new MouseEvent('click', {
						bubbles: true,
						cancelable: true
					})
				)
			}
		})

		test.equal(
			matrix.Inner.dom.seriesesG.selectAll('.sjpp-mass-series-g').size(),
			3,
			`should render the expected number of serieses`
		)
		test.equal(
			matrix.Inner.dom.cluster.selectAll('.sjpp-matrix-clusteroutlines rect').size(),
			1,
			`should render the expected number of cluster rects`
		)

		// 2. second Show only
		const secondLegendTexts = [...matrix.Inner.dom.legendG.node().querySelectorAll('g g text')].find(d =>
			d?.__data__?.text?.startsWith('<5')
		)
		secondLegendTexts.dispatchEvent(
			new MouseEvent('mouseup', {
				bubbles: true,
				cancelable: true
			})
		)

		const secondOptions = matrix.Inner.dom.legendMenu.d.node().querySelectorAll('div.sja_menuoption.sja_sharp_border')

		test.equal(secondOptions[0].innerText, 'Hide', `First option should be Hide`)
		test.equal(secondOptions[1].innerText, 'Show only', `second option should be Show only`)
		test.equal(secondOptions[2].innerText, 'Show all', `third option should be Show all`)

		const secondRects = await detectLst({
			elem: matrix.Inner.dom.seriesesG.node(),
			selector: '.sjpp-mass-series-g rect',
			count: 30,
			trigger: () => {
				secondOptions[1].dispatchEvent(
					new MouseEvent('click', {
						bubbles: true,
						cancelable: true
					})
				)
			}
		})

		test.equal(
			matrix.Inner.dom.seriesesG.selectAll('.sjpp-mass-series-g').size(),
			3,
			`should render the expected number of serieses`
		)
		test.equal(
			matrix.Inner.dom.cluster.selectAll('.sjpp-matrix-clusteroutlines rect').size(),
			1,
			`should render the expected number of cluster rects`
		)

		// 3. hide
		const thirdLegendTexts = [...matrix.Inner.dom.legendG.node().querySelectorAll('g g text')].find(d =>
			d?.__data__?.text?.startsWith('<5')
		)
		thirdLegendTexts.dispatchEvent(
			new MouseEvent('mouseup', {
				bubbles: true,
				cancelable: true
			})
		)
		const thirdOptions = matrix.Inner.dom.legendMenu.d.node().querySelectorAll('div.sja_menuoption.sja_sharp_border')

		test.equal(thirdOptions[0].innerText, 'Hide', `First option should be Hide`)
		test.equal(thirdOptions[2].innerText, 'Show all', `third option should be Show all`)

		const thirdRects = await detectLst({
			elem: matrix.Inner.dom.seriesesG.node(),
			selector: '.sjpp-mass-series-g rect',
			count: 0,
			trigger: () => {
				thirdOptions[0].dispatchEvent(
					new MouseEvent('click', {
						bubbles: true,
						cancelable: true
					})
				)
			}
		})

		test.equal(
			matrix.Inner.dom.seriesesG.selectAll('.sjpp-mass-series-g').size(),
			0,
			`should render the expected number of serieses`
		)

		// 4. Show all
		const fourthLegendTexts = [...matrix.Inner.dom.legendG.node().querySelectorAll('g g text')].find(d =>
			d?.__data__?.text?.startsWith('<5')
		)
		fourthLegendTexts.dispatchEvent(
			new MouseEvent('mouseup', {
				bubbles: true,
				cancelable: true
			})
		)
		const fourthOptions = matrix.Inner.dom.legendMenu.d.node().querySelectorAll('div.sja_menuoption.sja_sharp_border')

		test.equal(fourthOptions[0].innerText, 'Show', `first option should be Show`)
		test.equal(fourthOptions[2].innerText, 'Show all', `third option should be Show all`)

		const fourthRects = await detectLst({
			elem: matrix.Inner.dom.seriesesG.node(),
			selector: '.sjpp-mass-series-g rect',
			count: 75,
			trigger: () => {
				fourthOptions[2].dispatchEvent(
					new MouseEvent('click', {
						bubbles: true,
						cancelable: true
					})
				)
			}
		})

		test.equal(
			matrix.Inner.dom.seriesesG.selectAll('.sjpp-mass-series-g').size(),
			3,
			`should render the expected number of serieses`
		)
		test.equal(
			matrix.Inner.dom.cluster.selectAll('.sjpp-matrix-clusteroutlines rect').size(),
			1,
			`should render the expected number of cluster rects`
		)

		if (test._ok) matrix.Inner.app.destroy()
		test.end()
	}
})

tape(
	'apply "Hide samples with" and "Do not show" legend filters to a geneVariant term in geneVariant term only matrix',
	function (test) {
		test.timeoutAfter(5000)
		test.plan(12)

		runpp({
			state: {
				nav: {
					activeTab: 1
				},
				plots: [
					{
						chartType: 'matrix',
						settings: {
							// the matrix autocomputes the colw based on available screen width,
							// need to set an exact screen width for consistent tests using getBBox()
							matrix: {
								availContentWidth: 1200
							}
						},
						termgroups: [
							{
								name: '',
								lst: [getGenes()[0]]
							}
						]
					}
				]
			},
			matrix: {
				callbacks: {
					'postRender.test': runTests
				}
			}
		})

		async function runTests(matrix) {
			matrix.on('postRender.test', null)

			// 1. Hide
			const legendTexts = [...matrix.Inner.dom.legendG.node().querySelectorAll('g g text')].find(
				d => d?.__data__?.$id?.startsWith('Germline Mutations') && d.__data__.text?.startsWith('FRAMESHIFT')
			)

			legendTexts.dispatchEvent(
				new MouseEvent('mouseup', {
					bubbles: true,
					cancelable: true
				})
			)

			const options = matrix.Inner.dom.legendMenu.d.node().querySelectorAll('div.sja_menuoption.sja_sharp_border')

			test.equal(
				options[0].innerText,
				'Hide samples with FRAMESHIFT',
				`First option should be "Hide samples with FRAMESHIFT"`
			)
			test.equal(options[1].innerText, 'Do not show FRAMESHIFT', `second option should be "Do not show FRAMESHIFT"`)

			test.equal(options.length, 2, `Should only show two options`)

			const rects = await detectLst({
				elem: matrix.Inner.dom.seriesesG.node(),
				selector: '.sjpp-mass-series-g rect',
				count: 236,
				trigger: () => {
					options[0].dispatchEvent(
						new MouseEvent('click', {
							bubbles: true,
							cancelable: true
						})
					)
				}
			})

			test.equal(
				matrix.Inner.dom.seriesesG.selectAll('.sjpp-mass-series-g').size(),
				1,
				`should render the expected number of serieses`
			)
			test.equal(
				matrix.Inner.dom.cluster.selectAll('.sjpp-matrix-clusteroutlines rect').size(),
				1,
				`should render the expected number of cluster rects`
			)

			// 2. Show
			const legendTexts2 = [...matrix.Inner.dom.legendG.node().querySelectorAll('g g text')].find(
				d => d?.__data__?.$id?.startsWith('Germline Mutations') && d.__data__.text?.startsWith('FRAMESHIFT')
			)

			legendTexts2.dispatchEvent(
				new MouseEvent('mouseup', {
					bubbles: true,
					cancelable: true
				})
			)

			const options2 = matrix.Inner.dom.legendMenu.d.node().querySelectorAll('div.sja_menuoption.sja_sharp_border')

			test.equal(
				options2[0].innerText,
				'Show samples with FRAMESHIFT',
				`First option should be "Show samples with FRAMESHIFT"`
			)
			test.equal(options2.length, 1, `Should only show one option`)

			const rects2 = await detectLst({
				elem: matrix.Inner.dom.seriesesG.node(),
				selector: '.sjpp-mass-series-g rect',
				count: 240,
				trigger: () => {
					options2[0].dispatchEvent(
						new MouseEvent('click', {
							bubbles: true,
							cancelable: true
						})
					)
				}
			})

			test.equal(
				matrix.Inner.dom.seriesesG.selectAll('.sjpp-mass-series-g').size(),
				1,
				`should render the expected number of serieses`
			)
			test.equal(
				matrix.Inner.dom.cluster.selectAll('.sjpp-matrix-clusteroutlines rect').size(),
				1,
				`should render the expected number of cluster rects`
			)

			// 3. Do not show

			const legendTexts3 = [...matrix.Inner.dom.legendG.node().querySelectorAll('g g text')].find(
				d => d?.__data__?.$id?.startsWith('Germline Mutations') && d.__data__.text?.startsWith('FRAMESHIFT')
			)

			legendTexts3.dispatchEvent(
				new MouseEvent('mouseup', {
					bubbles: true,
					cancelable: true
				})
			)

			const options3 = matrix.Inner.dom.legendMenu.d.node().querySelectorAll('div.sja_menuoption.sja_sharp_border')

			test.equal(options3.length, 2, `Should only show two options`)

			const rects3 = await detectLst({
				elem: matrix.Inner.dom.seriesesG.node(),
				selector: '.sjpp-mass-series-g rect',
				count: 239,
				trigger: () => {
					options3[1].dispatchEvent(
						new MouseEvent('click', {
							bubbles: true,
							cancelable: true
						})
					)
				}
			})

			// 4. Show
			const legendTexts4 = [...matrix.Inner.dom.legendG.node().querySelectorAll('g g text')].find(
				d => d?.__data__?.$id?.startsWith('Germline Mutations') && d.__data__.text?.startsWith('FRAMESHIFT')
			)

			legendTexts4.dispatchEvent(
				new MouseEvent('mouseup', {
					bubbles: true,
					cancelable: true
				})
			)

			const options4 = matrix.Inner.dom.legendMenu.d.node().querySelectorAll('div.sja_menuoption.sja_sharp_border')

			test.equal(
				options4[0].innerText,
				'Show samples with FRAMESHIFT',
				`First option should be "Show samples with FRAMESHIFT"`
			)
			test.equal(options4.length, 1, `Should only show one option`)

			const rects4 = await detectLst({
				elem: matrix.Inner.dom.seriesesG.node(),
				selector: '.sjpp-mass-series-g rect',
				count: 240,
				trigger: () => {
					options4[0].dispatchEvent(
						new MouseEvent('click', {
							bubbles: true,
							cancelable: true
						})
					)
				}
			})

			if (test._ok) matrix.Inner.app.destroy()
			test.end()
		}
	}
)

tape('apply legend group filters to a geneVariant term in geneVariant term only matrix', function (test) {
	test.timeoutAfter(5000)
	test.plan(15)

	runpp({
		state: {
			nav: {
				activeTab: 1
			},
			plots: [
				{
					chartType: 'matrix',
					settings: {
						// the matrix autocomputes the colw based on available screen width,
						// need to set an exact screen width for consistent tests using getBBox()
						matrix: {
							availContentWidth: 1200
						}
					},
					termgroups: [
						{
							name: '',
							lst: [{ term: { gene: 'TP53', name: 'TP53', type: 'geneVariant', isleaf: true } }]
						}
					]
				}
			]
		},
		matrix: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(matrix) {
		matrix.on('postRender.test', null)

		// 1. Show only truncating mutations
		const legendTexts = [...matrix.Inner.dom.legendG.node().querySelectorAll('g g text')].find(
			d => d?.__data__?.name == 'Somatic Mutations' && !d.__data__.isLegendItem
		)

		legendTexts.dispatchEvent(
			new MouseEvent('mouseup', {
				bubbles: true,
				cancelable: true
			})
		)

		const options = matrix.Inner.dom.legendMenu.d.node().querySelectorAll('div.sja_menuoption.sja_sharp_border')

		test.equal(
			options[0].innerText,
			'Show only truncating mutations',
			`First option should be "Show only truncating mutations"`
		)
		test.equal(
			options[1].innerText,
			'Show only protein-changing mutations',
			`second option should be "Show only protein-changing mutations"`
		)
		test.equal(
			options[2].innerText,
			'Do not show Somatic Mutations',
			`third option should be "Do not show Somatic Mutations"`
		)
		test.equal(options.length, 3, `Should show three options`)
		const rects = await detectLst({
			elem: matrix.Inner.dom.seriesesG.node(),
			selector: '.sjpp-mass-series-g rect',
			count: 181,
			trigger: () => {
				options[0].dispatchEvent(
					new MouseEvent('click', {
						bubbles: true,
						cancelable: true
					})
				)
			}
		})

		test.equal(
			matrix.Inner.dom.seriesesG.selectAll('.sjpp-mass-series-g').size(),
			1,
			`should render the expected number of serieses`
		)

		// 2. Show only protein-changing mutations
		const legendTexts2 = [...matrix.Inner.dom.legendG.node().querySelectorAll('g g text')].find(
			d => d?.__data__?.name == 'Somatic Mutations' && !d.__data__.isLegendItem
		)

		legendTexts2.dispatchEvent(
			new MouseEvent('mouseup', {
				bubbles: true,
				cancelable: true
			})
		)

		const options2 = matrix.Inner.dom.legendMenu.d.node().querySelectorAll('div.sja_menuoption.sja_sharp_border')

		test.equal(
			options2[2].innerText,
			'Do not show Somatic Mutations',
			`third option should be "Do not show Somatic Mutations"`
		)
		test.equal(
			options2[3].innerText,
			'Show all Somatic Mutations',
			`fourth option should be "Show all Somatic Mutations"`
		)
		test.equal(options2.length, 4, `Should show four options`)
		const rects2 = await detectLst({
			elem: matrix.Inner.dom.seriesesG.node(),
			selector: '.sjpp-mass-series-g rect',
			count: 183,
			trigger: () => {
				options2[1].dispatchEvent(
					new MouseEvent('click', {
						bubbles: true,
						cancelable: true
					})
				)
			}
		})

		test.equal(
			matrix.Inner.dom.seriesesG.selectAll('.sjpp-mass-series-g').size(),
			1,
			`should render the expected number of serieses`
		)

		// 3. Do not show somatic mutations
		const legendTexts3 = [...matrix.Inner.dom.legendG.node().querySelectorAll('g g text')].find(
			d => d?.__data__?.name == 'Somatic Mutations' && !d.__data__.isLegendItem
		)

		legendTexts3.dispatchEvent(
			new MouseEvent('mouseup', {
				bubbles: true,
				cancelable: true
			})
		)

		const options3 = matrix.Inner.dom.legendMenu.d.node().querySelectorAll('div.sja_menuoption.sja_sharp_border')

		test.equal(
			options3[2].innerText,
			'Do not show Somatic Mutations',
			`third option should be "Do not show Somatic Mutations"`
		)

		test.equal(options3.length, 4, `Should show four options`)
		const rects3 = await detectLst({
			elem: matrix.Inner.dom.seriesesG.node(),
			selector: '.sjpp-mass-series-g rect',
			count: 180,
			trigger: () => {
				options3[2].dispatchEvent(
					new MouseEvent('click', {
						bubbles: true,
						cancelable: true
					})
				)
			}
		})

		test.equal(
			matrix.Inner.dom.seriesesG.selectAll('.sjpp-mass-series-g').size(),
			1,
			`should render the expected number of serieses`
		)

		// 4. Show all somatic mutations
		const legendTexts4 = [...matrix.Inner.dom.legendG.node().querySelectorAll('g g text')].find(
			d => d?.__data__?.name == 'Somatic Mutations' && !d.__data__.isLegendItem
		)

		legendTexts4.dispatchEvent(
			new MouseEvent('mouseup', {
				bubbles: true,
				cancelable: true
			})
		)

		const options4 = matrix.Inner.dom.legendMenu.d.node().querySelectorAll('div.sja_menuoption.sja_sharp_border')

		test.equal(
			options4[0].innerText,
			'Show all Somatic Mutations',
			`first option should be "Show all Somatic Mutations"`
		)

		test.equal(options4.length, 1, `Should show one option`)
		const rects4 = await detectLst({
			elem: matrix.Inner.dom.seriesesG.node(),
			selector: '.sjpp-mass-series-g rect',
			count: 240,
			trigger: () => {
				options4[0].dispatchEvent(
					new MouseEvent('click', {
						bubbles: true,
						cancelable: true
					})
				)
			}
		})

		test.equal(
			matrix.Inner.dom.seriesesG.selectAll('.sjpp-mass-series-g').size(),
			1,
			`should render the expected number of serieses`
		)

		if (test._ok) matrix.Inner.app.destroy()
		test.end()
	}
})

tape(
	'apply legend group filters and legend filters to a matrix with both geneVariant and dictionary terms',
	function (test) {
		test.timeoutAfter(5000)
		test.plan(13)

		runpp({
			state: {
				nav: {
					activeTab: 1
				},
				plots: [
					{
						chartType: 'matrix',
						settings: {
							// the matrix autocomputes the colw based on available screen width,
							// need to set an exact screen width for consistent tests using getBBox()
							matrix: {
								availContentWidth: 1200
							}
						},
						termgroups: [
							{
								name: '',
								lst: [
									{ term: { gene: 'TP53', name: 'TP53', type: 'geneVariant', isleaf: true } },
									{ term: { gene: 'KRAS', name: 'KRAS', type: 'geneVariant', isleaf: true } },
									{ term: { gene: 'AKT1', name: 'AKT1', type: 'geneVariant', isleaf: true } },
									{ id: 'agedx', term: termjson['agedx'] },
									{ id: 'diaggrp', term: termjson['diaggrp'] },
									{ id: 'aaclassic_5', term: termjson['aaclassic_5'] }
								]
							}
						]
					}
				]
			},
			matrix: {
				callbacks: {
					'postRender.test': runTests
				}
			}
		})

		async function runTests(matrix) {
			matrix.on('postRender.test', null)

			// 1. Show only truncating mutations
			const legendTexts = [...matrix.Inner.dom.legendG.node().querySelectorAll('g g text')].find(
				d => d?.__data__?.name == 'Somatic Mutations' && !d.__data__.isLegendItem
			)

			legendTexts.dispatchEvent(
				new MouseEvent('mouseup', {
					bubbles: true,
					cancelable: true
				})
			)

			const options = matrix.Inner.dom.legendMenu.d.node().querySelectorAll('div.sja_menuoption.sja_sharp_border')

			test.equal(
				options[0].innerText,
				'Show only truncating mutations',
				`First option should be "Show only truncating mutations"`
			)
			test.equal(options.length, 3, `Should show three options`)
			const rects = await detectLst({
				elem: matrix.Inner.dom.seriesesG.node(),
				selector: '.sjpp-mass-series-g rect',
				count: 721,
				trigger: () => {
					options[0].dispatchEvent(
						new MouseEvent('click', {
							bubbles: true,
							cancelable: true
						})
					)
				}
			})

			test.equal(
				matrix.Inner.dom.seriesesG.selectAll('.sjpp-mass-series-g').size(),
				6,
				`should render the expected number of serieses`
			)

			// 2. Show only protein-changing mutations
			const legendTexts2 = [...matrix.Inner.dom.legendG.node().querySelectorAll('g g text')].find(
				d => d?.__data__?.name == 'Somatic Mutations' && !d.__data__.isLegendItem
			)

			legendTexts2.dispatchEvent(
				new MouseEvent('mouseup', {
					bubbles: true,
					cancelable: true
				})
			)

			const options2 = matrix.Inner.dom.legendMenu.d.node().querySelectorAll('div.sja_menuoption.sja_sharp_border')

			test.equal(
				options2[1].innerText,
				'Show only protein-changing mutations',
				`second option should be "Show only protein-changing mutations"`
			)
			test.equal(
				options2[3].innerText,
				'Show all Somatic Mutations',
				`fourth option should be "Show all Somatic Mutations"`
			)
			test.equal(options2.length, 4, `Should show four options`)
			const rects2 = await detectLst({
				elem: matrix.Inner.dom.seriesesG.node(),
				selector: '.sjpp-mass-series-g rect',
				count: 724,
				trigger: () => {
					options2[1].dispatchEvent(
						new MouseEvent('click', {
							bubbles: true,
							cancelable: true
						})
					)
				}
			})

			// 3. Hide
			const legendTexts3 = [...matrix.Inner.dom.legendG.node().querySelectorAll('g g text')].find(
				d => d?.__data__?.$id?.startsWith('Somatic Mutations') && d.__data__.text?.startsWith('FRAMESHIFT')
			)

			legendTexts3.dispatchEvent(
				new MouseEvent('mouseup', {
					bubbles: true,
					cancelable: true
				})
			)

			const options3 = matrix.Inner.dom.legendMenu.d.node().querySelectorAll('div.sja_menuoption.sja_sharp_border')

			test.equal(
				options3[0].innerText,
				'Hide samples with FRAMESHIFT',
				`First option should be "Hide samples with FRAMESHIFT"`
			)
			test.equal(options3[1].innerText, 'Do not show FRAMESHIFT', `second option should be "Do not show FRAMESHIFT"`)

			const rects3 = await detectLst({
				elem: matrix.Inner.dom.seriesesG.node(),
				selector: '.sjpp-mass-series-g rect',
				count: 711,
				trigger: () => {
					options3[0].dispatchEvent(
						new MouseEvent('click', {
							bubbles: true,
							cancelable: true
						})
					)
				}
			})

			test.equal(
				matrix.Inner.dom.seriesesG.selectAll('.sjpp-mass-series-g').size(),
				6,
				`should render the expected number of serieses`
			)

			// 4. Show
			const legendTexts4 = [...matrix.Inner.dom.legendG.node().querySelectorAll('g g text')].find(
				d => d?.__data__?.$id?.startsWith('Somatic Mutations') && d.__data__.text?.startsWith('FRAMESHIFT')
			)

			legendTexts4.dispatchEvent(
				new MouseEvent('mouseup', {
					bubbles: true,
					cancelable: true
				})
			)

			const options4 = matrix.Inner.dom.legendMenu.d.node().querySelectorAll('div.sja_menuoption.sja_sharp_border')

			test.equal(
				options4[0].innerText,
				'Show samples with FRAMESHIFT',
				`First option should be "Show samples with FRAMESHIFT"`
			)
			test.equal(options4.length, 1, `Should only show one option`)

			const rects4 = await detectLst({
				elem: matrix.Inner.dom.seriesesG.node(),
				selector: '.sjpp-mass-series-g rect',
				count: 724,
				trigger: () => {
					options4[0].dispatchEvent(
						new MouseEvent('click', {
							bubbles: true,
							cancelable: true
						})
					)
				}
			})

			// 5. Show all somatic mutations
			const legendTexts5 = [...matrix.Inner.dom.legendG.node().querySelectorAll('g g text')].find(
				d => d?.__data__?.name == 'Somatic Mutations' && !d.__data__.isLegendItem
			)

			legendTexts5.dispatchEvent(
				new MouseEvent('mouseup', {
					bubbles: true,
					cancelable: true
				})
			)

			const options5 = matrix.Inner.dom.legendMenu.d.node().querySelectorAll('div.sja_menuoption.sja_sharp_border')

			test.equal(
				options5[3].innerText,
				'Show all Somatic Mutations',
				`fourth option should be "Show all Somatic Mutations"`
			)

			test.equal(options5.length, 4, `Should show four options`)
			const rects5 = await detectLst({
				elem: matrix.Inner.dom.seriesesG.node(),
				selector: '.sjpp-mass-series-g rect',
				count: 900,
				trigger: () => {
					options5[3].dispatchEvent(
						new MouseEvent('click', {
							bubbles: true,
							cancelable: true
						})
					)
				}
			})

			if (test._ok) matrix.Inner.app.destroy()
			test.end()
		}
	}
)

// cell brush zoom in
tape('cell brush zoom in', function (test) {
	test.timeoutAfter(5000)
	test.plan(1)
	runpp({
		state: {
			nav: {
				activeTab: 1
			},
			plots: [
				{
					chartType: 'matrix',
					settings: {
						matrix: {
							// the matrix autocomputes the colw based on available screen width,
							// need to set an exact screen width for consistent tests using getBBox()
							availContentWidth: 300
						}
					},
					termgroups: [
						{
							name: 'Demographics',
							lst: [
								{
									id: 'aaclassic_5',
									q: {
										mode: 'continuous'
									}
								},
								{
									id: 'sex'
									//q: { mode: 'values' } // or 'groupsetting'
								},
								{
									id: 'agedx',
									q: {
										mode: 'discrete',
										type: 'regular-bin',
										bin_size: 5,
										first_bin: {
											startunbounded: true,
											stop: 5,
											stopinclusive: true
										}
									} // or 'continuous'
								}
							]
						}
					]
				}
			]
		},
		matrix: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(matrix) {
		matrix.on('postRender.test', null)

		const startCell = matrix.Inner.serieses[1].cells[10]
		const endCell = matrix.Inner.serieses[1].cells[14]

		matrix.Inner.clickedSeriesCell = {
			startCell,
			endCell
		}
		matrix.Inner.zoomWidth = Math.abs(startCell.totalIndex - endCell.totalIndex) * matrix.Inner.dimensions.colw

		matrix.on('postRender.test', () => {
			matrix.on('postRender.test', null)
			test.deepEqual(matrix.Inner.settings.matrix.zoomLevel, 4, 'should have the expected zoom level after zoom in')
			if (test._ok) matrix.Inner.app.destroy()
			test.end()
		})

		matrix.Inner.triggerZoomArea()
	}
})

tape('survival term in continous mode', function (test) {
	test.timeoutAfter(5000)
	test.plan(2)
	runpp({
		state: {
			nav: {
				activeTab: 1
			},
			plots: [
				{
					chartType: 'matrix',
					settings: {
						// the matrix autocomputes the colw based on available screen width,
						// need to set an exact screen width for consistent tests using getBBox()
						matrix: {
							availContentWidth: 1200
						}
					},
					termgroups: [
						{
							name: '',
							lst: [
								{
									term: {
										name: 'Overall survival',
										type: 'survival',
										isleaf: true,
										unit: 'years',
										id: 'os'
									},
									q: {
										mode: 'continuous'
									}
								}
							]
						}
					]
				}
			]
		},
		matrix: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(matrix) {
		matrix.on('postRender.test', null)
		test.equal(
			matrix.Inner.dom.seriesesG.selectAll('.sjpp-mass-series-g').size(),
			1,
			`should render the expected number of serieses`
		)
		test.equal(
			matrix.Inner.dom.seriesesG.selectAll('.sjpp-mass-series-g rect').size(),
			60,
			`should render the expected number of cell rects`
		)
		if (test._ok) matrix.Inner.app.destroy()
		test.end()
	}
})

tape('survival term in discrete mode', function (test) {
	test.timeoutAfter(5000)
	test.plan(2)
	runpp({
		state: {
			nav: {
				activeTab: 1
			},
			plots: [
				{
					chartType: 'matrix',
					settings: {
						// the matrix autocomputes the colw based on available screen width,
						// need to set an exact screen width for consistent tests using getBBox()
						matrix: {
							availContentWidth: 1200
						}
					},
					termgroups: [
						{
							name: '',
							lst: [
								{
									term: {
										name: 'Overall survival',
										type: 'survival',
										isleaf: true,
										unit: 'years',
										id: 'os'
									},
									q: {
										mode: 'continuous'
									}
								}
							]
						}
					]
				}
			]
		},
		matrix: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(matrix) {
		matrix.on('postRender.test', null)
		test.equal(
			matrix.Inner.dom.seriesesG.selectAll('.sjpp-mass-series-g').size(),
			1,
			`should render the expected number of serieses`
		)
		test.equal(
			matrix.Inner.dom.seriesesG.selectAll('.sjpp-mass-series-g rect').size(),
			60,
			`should render the expected number of cell rects`
		)
		if (test._ok) matrix.Inner.app.destroy()
		test.end()
	}
})

tape('survival term with divide by dictionary term', function (test) {
	test.timeoutAfter(5000)
	test.plan(3)
	runpp({
		state: {
			nav: {
				activeTab: 1
			},
			plots: [
				{
					chartType: 'matrix',
					settings: {
						// the matrix autocomputes the colw based on available screen width,
						// need to set an exact screen width for consistent tests using getBBox()
						matrix: {
							availContentWidth: 1200
						}
					},
					divideBy: {
						id: 'sex'
					},
					termgroups: [
						{
							name: '',
							lst: [
								{
									term: {
										name: 'Overall survival',
										type: 'survival',
										isleaf: true,
										unit: 'years',
										id: 'os'
									},
									q: {
										mode: 'continuous'
									}
								}
							]
						}
					]
				}
			]
		},
		matrix: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(matrix) {
		matrix.on('postRender.test', null)
		test.equal(
			matrix.Inner.dom.seriesesG.selectAll('.sjpp-mass-series-g').size(),
			1,
			`should render the expected number of serieses`
		)
		test.equal(
			matrix.Inner.dom.seriesesG.selectAll('.sjpp-mass-series-g rect').size(),
			60,
			`should render the expected number of cell rects`
		)
		test.equal(
			matrix.Inner.dom.cluster.selectAll('.sjpp-matrix-clusteroutlines rect').size(),
			2,
			`should render the expected number of cluster rects`
		)
		if (test._ok) matrix.Inner.app.destroy()
		test.end()
	}
})

tape('dictionary term with divide by survival term', function (test) {
	test.timeoutAfter(5000)
	test.plan(3)
	runpp({
		state: {
			nav: {
				activeTab: 1
			},
			plots: [
				{
					chartType: 'matrix',
					settings: {
						// the matrix autocomputes the colw based on available screen width,
						// need to set an exact screen width for consistent tests using getBBox()
						matrix: {
							availContentWidth: 1200
						}
					},
					divideBy: {
						id: 'os'
					},
					termgroups: [
						{
							name: 'Demographics',
							lst: [
								{ id: 'agedx', term: termjson['agedx'] },
								{ id: 'diaggrp', term: termjson['diaggrp'] },
								{ id: 'aaclassic_5', term: termjson['aaclassic_5'] }
							]
						}
					]
				}
			]
		},
		matrix: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(matrix) {
		matrix.on('postRender.test', null)
		test.equal(
			matrix.Inner.dom.seriesesG.selectAll('.sjpp-mass-series-g').size(),
			3,
			`should render the expected number of serieses`
		)
		test.equal(
			matrix.Inner.dom.seriesesG.selectAll('.sjpp-mass-series-g rect').size(),
			180,
			`should render the expected number of cell rects`
		)
		test.equal(
			matrix.Inner.dom.cluster.selectAll('.sjpp-matrix-clusteroutlines rect').size(),
			2,
			`should render the expected number of cluster rects`
		)
		if (test._ok) matrix.Inner.app.destroy()
		test.end()
	}
})

tape('apply "hide" and "show" legend filters to a survival term', function (test) {
	test.timeoutAfter(5000)
	test.plan(10)
	runpp({
		state: {
			nav: {
				activeTab: 1
			},
			plots: [
				{
					chartType: 'matrix',
					settings: {
						matrix: {
							// the matrix autocomputes the colw based on available screen width,
							// need to set an exact screen width for consistent tests using getBBox()
							availContentWidth: 1200
						}
					},
					termgroups: [
						{
							name: '',
							lst: [
								{
									id: 'aaclassic_5',
									q: {
										mode: 'continuous'
									}
								},
								{
									id: 'genetic_race'
									//q: { mode: 'values' } // or 'groupsetting'
								},
								{
									id: 'agedx',
									q: {
										mode: 'discrete',
										type: 'regular-bin',
										bin_size: 5,
										first_bin: {
											startunbounded: true,
											stop: 5,
											stopinclusive: true
										}
									}
								},
								{
									term: {
										name: 'Overall survival',
										type: 'survival',
										isleaf: true,
										unit: 'years',
										id: 'os'
									}
								}
							]
						}
					]
				}
			]
		},
		matrix: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(matrix) {
		matrix.on('postRender.test', null)

		// 1. Hide
		const legendTexts = [...matrix.Inner.dom.legendG.node().querySelectorAll('g g text')].find(d =>
			d?.__data__?.text?.startsWith('Alive')
		)
		legendTexts.dispatchEvent(
			new MouseEvent('mouseup', {
				bubbles: true,
				cancelable: true
			})
		)

		const options = matrix.Inner.dom.legendMenu.d.node().querySelectorAll('div.sja_menuoption.sja_sharp_border')

		test.equal(options[0].innerText, 'Hide', `First option should be Hide`)
		test.equal(options[1].innerText, 'Show only', `second option should be Show only`)
		test.equal(options[2].innerText, 'Show all', `third option should be Show all`)

		const rects = await detectLst({
			elem: matrix.Inner.dom.seriesesG.node(),
			selector: '.sjpp-mass-series-g rect',
			count: 228,
			trigger: () => {
				options[0].dispatchEvent(
					new MouseEvent('click', {
						bubbles: true,
						cancelable: true
					})
				)
			}
		})

		test.equal(
			matrix.Inner.dom.seriesesG.selectAll('.sjpp-mass-series-g').size(),
			4,
			`should render the expected number of serieses`
		)
		test.equal(
			matrix.Inner.dom.cluster.selectAll('.sjpp-matrix-clusteroutlines rect').size(),
			1,
			`should render the expected number of cluster rects`
		)

		// 2. Show
		const legendTexts2 = [...matrix.Inner.dom.legendG.node().querySelectorAll('g g text')].find(d =>
			d?.__data__?.text?.startsWith('Alive')
		)
		legendTexts2.dispatchEvent(
			new MouseEvent('mouseup', {
				bubbles: true,
				cancelable: true
			})
		)

		const options2 = matrix.Inner.dom.legendMenu.d.node().querySelectorAll('div.sja_menuoption.sja_sharp_border')

		test.equal(options2[0].innerText, 'Show', `First option should be Show`)
		test.equal(options2[1].innerText, 'Show only', `second option should be Show only`)
		test.equal(options2[2].innerText, 'Show all', `third option should be Show all`)

		const rects2 = await detectLst({
			elem: matrix.Inner.dom.seriesesG.node(),
			selector: '.sjpp-mass-series-g rect',
			count: 240,
			trigger: () => {
				options2[0].dispatchEvent(
					new MouseEvent('click', {
						bubbles: true,
						cancelable: true
					})
				)
			}
		})

		test.equal(
			matrix.Inner.dom.seriesesG.selectAll('.sjpp-mass-series-g').size(),
			4,
			`should render the expected number of serieses`
		)
		test.equal(
			matrix.Inner.dom.cluster.selectAll('.sjpp-matrix-clusteroutlines rect').size(),
			1,
			`should render the expected number of cluster rects`
		)

		if (test._ok) matrix.Inner.app.destroy()
		test.end()
	}
})

tape('apply "show only" and "show all" legend filters to a survival terms', function (test) {
	test.timeoutAfter(5000)
	test.plan(14)
	runpp({
		state: {
			nav: {
				activeTab: 1
			},
			plots: [
				{
					chartType: 'matrix',
					settings: {
						matrix: {
							// the matrix autocomputes the colw based on available screen width,
							// need to set an exact screen width for consistent tests using getBBox()
							availContentWidth: 1200
						}
					},
					termgroups: [
						{
							name: '',
							lst: [
								{
									id: 'aaclassic_5',
									q: {
										mode: 'continuous'
									}
								},
								{
									id: 'genetic_race'
									//q: { mode: 'values' } // or 'groupsetting'
								},
								{
									id: 'agedx',
									q: {
										mode: 'discrete',
										type: 'regular-bin',
										bin_size: 5,
										first_bin: {
											startunbounded: true,
											stop: 5,
											stopinclusive: true
										}
									}
								},
								{
									term: {
										name: 'Overall survival',
										type: 'survival',
										isleaf: true,
										unit: 'years',
										id: 'os'
									}
								}
							]
						}
					]
				}
			]
		},
		matrix: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(matrix) {
		matrix.on('postRender.test', null)

		// 1. Show only
		const legendTexts = [...matrix.Inner.dom.legendG.node().querySelectorAll('g g text')].find(d =>
			d?.__data__?.text?.startsWith('Alive')
		)
		legendTexts.dispatchEvent(
			new MouseEvent('mouseup', {
				bubbles: true,
				cancelable: true
			})
		)

		const options = matrix.Inner.dom.legendMenu.d.node().querySelectorAll('div.sja_menuoption.sja_sharp_border')

		const rects = await detectLst({
			elem: matrix.Inner.dom.seriesesG.node(),
			selector: '.sjpp-mass-series-g rect',
			count: 12,
			trigger: () => {
				options[1].dispatchEvent(
					new MouseEvent('click', {
						bubbles: true,
						cancelable: true
					})
				)
			}
		})

		test.equal(
			matrix.Inner.dom.seriesesG.selectAll('.sjpp-mass-series-g').size(),
			4,
			`should render the expected number of serieses`
		)
		test.equal(
			matrix.Inner.dom.cluster.selectAll('.sjpp-matrix-clusteroutlines rect').size(),
			1,
			`should render the expected number of cluster rects`
		)

		// 2. second Show only
		const secondLegendTexts = [...matrix.Inner.dom.legendG.node().querySelectorAll('g g text')].find(d =>
			d?.__data__?.text?.startsWith('<5')
		)
		secondLegendTexts.dispatchEvent(
			new MouseEvent('mouseup', {
				bubbles: true,
				cancelable: true
			})
		)

		const secondOptions = matrix.Inner.dom.legendMenu.d.node().querySelectorAll('div.sja_menuoption.sja_sharp_border')

		test.equal(secondOptions[0].innerText, 'Hide', `First option should be Hide`)
		test.equal(secondOptions[1].innerText, 'Show only', `second option should be Show only`)
		test.equal(secondOptions[2].innerText, 'Show all', `third option should be Show all`)

		const secondRects = await detectLst({
			elem: matrix.Inner.dom.seriesesG.node(),
			selector: '.sjpp-mass-series-g rect',
			count: 4,
			trigger: () => {
				secondOptions[1].dispatchEvent(
					new MouseEvent('click', {
						bubbles: true,
						cancelable: true
					})
				)
			}
		})

		test.equal(
			matrix.Inner.dom.seriesesG.selectAll('.sjpp-mass-series-g').size(),
			4,
			`should render the expected number of serieses`
		)
		test.equal(
			matrix.Inner.dom.cluster.selectAll('.sjpp-matrix-clusteroutlines rect').size(),
			1,
			`should render the expected number of cluster rects`
		)

		// 3. first show all
		const thirdLegendTexts = [...matrix.Inner.dom.legendG.node().querySelectorAll('g g text')].find(d =>
			d?.__data__?.text?.startsWith('<5')
		)
		thirdLegendTexts.dispatchEvent(
			new MouseEvent('mouseup', {
				bubbles: true,
				cancelable: true
			})
		)
		const thirdOptions = matrix.Inner.dom.legendMenu.d.node().querySelectorAll('div.sja_menuoption.sja_sharp_border')

		test.equal(thirdOptions[0].innerText, 'Hide', `First option should be Hide`)
		test.equal(thirdOptions[2].innerText, 'Show all', `third option should be Show all`)

		const thirdRects = await detectLst({
			elem: matrix.Inner.dom.seriesesG.node(),
			selector: '.sjpp-mass-series-g rect',
			count: 12,
			trigger: () => {
				thirdOptions[2].dispatchEvent(
					new MouseEvent('click', {
						bubbles: true,
						cancelable: true
					})
				)
			}
		})

		test.equal(
			matrix.Inner.dom.seriesesG.selectAll('.sjpp-mass-series-g').size(),
			4,
			`should render the expected number of serieses`
		)

		// 4. Show all
		const fourthLegendTexts = [...matrix.Inner.dom.legendG.node().querySelectorAll('g g text')].find(d =>
			d?.__data__?.text?.startsWith('Alive')
		)
		fourthLegendTexts.dispatchEvent(
			new MouseEvent('mouseup', {
				bubbles: true,
				cancelable: true
			})
		)
		const fourthOptions = matrix.Inner.dom.legendMenu.d.node().querySelectorAll('div.sja_menuoption.sja_sharp_border')

		test.equal(fourthOptions[0].innerText, 'Hide', `first option should be Hide`)
		test.equal(fourthOptions[2].innerText, 'Show all', `third option should be Show all`)

		const fourthRects = await detectLst({
			elem: matrix.Inner.dom.seriesesG.node(),
			selector: '.sjpp-mass-series-g rect',
			count: 240,
			trigger: () => {
				fourthOptions[2].dispatchEvent(
					new MouseEvent('click', {
						bubbles: true,
						cancelable: true
					})
				)
			}
		})

		test.equal(
			matrix.Inner.dom.seriesesG.selectAll('.sjpp-mass-series-g').size(),
			4,
			`should render the expected number of serieses`
		)
		test.equal(
			matrix.Inner.dom.cluster.selectAll('.sjpp-matrix-clusteroutlines rect').size(),
			1,
			`should render the expected number of cluster rects`
		)

		if (test._ok) matrix.Inner.app.destroy()
		test.end()
	}
})
