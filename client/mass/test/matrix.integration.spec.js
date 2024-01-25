const tape = require('tape')
const termjson = require('../../test/testdata/termjson').termjson
const helpers = require('../../test/front.helpers.js')
const { sleep } = require('../../test/test.helpers.js')

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
				'postRender.test': runTests
			}
		}
	})

	function runTests(matrix) {
		matrix.on('postRender.test', null)
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
							lst: [{ term: { name: 'TP53', type: 'geneVariant', isleaf: true } }]
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
								{ term: { name: 'TP53', type: 'geneVariant', isleaf: true } },
								{ term: { name: 'KRAS', type: 'geneVariant', isleaf: true } },
								{ term: { name: 'AKT1', type: 'geneVariant', isleaf: true } },
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
							lst: [
								{ term: { name: 'TP53', type: 'geneVariant', isleaf: true } },
								{ term: { name: 'KRAS', type: 'geneVariant', isleaf: true } },
								{ term: { name: 'AKT1', type: 'geneVariant', isleaf: true } }
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
								{ term: { name: 'TP53', type: 'geneVariant', isleaf: true } },
								{ term: { name: 'KRAS', type: 'geneVariant', isleaf: true } },
								{ term: { name: 'AKT1', type: 'geneVariant', isleaf: true } },
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
							lst: [
								{ term: { name: 'TP53', type: 'geneVariant', isleaf: true } },
								{ term: { name: 'KRAS', type: 'geneVariant', isleaf: true } },
								{ term: { name: 'AKT1', type: 'geneVariant', isleaf: true } }
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
		const g = matrix.Inner.dom.sampleLabelsPG.selectAll('.sjpp-matrix-series-label-g g')
		test.equal(g.size(), 60, `should render the expected number of sample names`)
		test.equal(g._groups[0][0].textContent, '2646', `should be the expected sample name`)
		test.equal(g._groups[0][9].textContent, '2772', `should be the expected sample name`)
		test.equal(g._groups[0][59].textContent, '3472', `should be the expected sample name`)
		if (test._ok) matrix.Inner.app.destroy()
		test.end()
	}
})

tape('sort samples by CNV+SSM > SSM-only > CNV-only', function (test) {
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
							lst: [
								{ term: { name: 'TP53', type: 'geneVariant', isleaf: true } },
								{ term: { name: 'KRAS', type: 'geneVariant', isleaf: true } },
								{ term: { name: 'AKT1', type: 'geneVariant', isleaf: true } }
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
			matrix.Inner.dom.sampleLabelsPG.selectAll('.sjpp-matrix-series-label-g g').size(),
			60,
			`should render the expected number of sample names`
		)
		const rects = matrix.Inner.dom.sampleLabelsPG.selectAll('.sjpp-matrix-series-label-g g')._groups[0]
		const index_3346 = Array.from(rects).find(rect => rect.textContent == '3346').__data__.index
		test.true(index_3346 < 10, `should be in the expected order`)
		const index_2660 = Array.from(rects).find(rect => rect.textContent == '2660').__data__.index
		test.true(index_2660 > 9, `should be in the expected order`)
		const index_3472 = Array.from(rects).find(rect => rect.textContent == '3472').__data__.index
		test.true(index_3472 > 9, `should be in the expected order`)
		if (test._ok) matrix.Inner.app.destroy()
		test.end()
	}
})

tape.skip('sort samples by CNV+SSM > SSM-only', function (test) {
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
							sortSamplesBy: 'b'
						}
					},
					termgroups: [
						{
							name: '',
							lst: [
								{ term: { name: 'TP53', type: 'geneVariant', isleaf: true } },
								{ term: { name: 'KRAS', type: 'geneVariant', isleaf: true } },
								{ term: { name: 'AKT1', type: 'geneVariant', isleaf: true } }
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
			matrix.Inner.dom.sampleLabelsPG.selectAll('.sjpp-matrix-series-label-g g').size(),
			60,
			`should render the expected number of sample names`
		)
		const rects = matrix.Inner.dom.sampleLabelsPG.selectAll('.sjpp-matrix-series-label-g g')._groups[0]
		const index_3346 = Array.from(rects).find(rect => rect.textContent == '3346').__data__.index
		test.true(index_3346 < 7, `should be in the expected order`)
		const index_2660 = Array.from(rects).find(rect => rect.textContent == '2660').__data__.index
		test.true(index_2660 > 6, `should be in the expected order`)
		const index_3472 = Array.from(rects).find(rect => rect.textContent == '3472').__data__.index
		test.true(index_3472 > 6, `should be in the expected order`)
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
							lst: [
								{ term: { name: 'TP53', type: 'geneVariant', isleaf: true } },
								{ term: { name: 'KRAS', type: 'geneVariant', isleaf: true } },
								{ term: { name: 'AKT1', type: 'geneVariant', isleaf: true } }
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
							lst: [
								{ term: { name: 'TP53', type: 'geneVariant', isleaf: true } },
								{ term: { name: 'KRAS', type: 'geneVariant', isleaf: true } },
								{ term: { name: 'AKT1', type: 'geneVariant', isleaf: true } }
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
							lst: [
								{ term: { name: 'TP53', type: 'geneVariant', isleaf: true } },
								{ term: { name: 'KRAS', type: 'geneVariant', isleaf: true } },
								{ term: { name: 'AKT1', type: 'geneVariant', isleaf: true } }
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
							lst: [
								{ term: { name: 'TP53', type: 'geneVariant', isleaf: true } },
								{ term: { name: 'KRAS', type: 'geneVariant', isleaf: true } },
								{ term: { name: 'AKT1', type: 'geneVariant', isleaf: true } }
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
		const matrixGroupLabels = matrix.Inner.dom.sampleLabelsPG.selectAll(
			'.sjpp-matrix-series-group-label-g .sjpp-matrix-label'
		)._groups[0]
		test.true(matrixGroupLabels[0].textContent.startsWith('10 to <15'), `should be the expected group name`)
		test.true(matrixGroupLabels[4].textContent.startsWith('≥20'), `should be the expected group name`)
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
							lst: [
								{ term: { name: 'TP53', type: 'geneVariant', isleaf: true } },
								{ term: { name: 'KRAS', type: 'geneVariant', isleaf: true } },
								{ term: { name: 'AKT1', type: 'geneVariant', isleaf: true } }
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
							lst: [
								{ term: { name: 'TP53', type: 'geneVariant', isleaf: true } },
								{ term: { name: 'KRAS', type: 'geneVariant', isleaf: true } },
								{ term: { name: 'AKT1', type: 'geneVariant', isleaf: true } }
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
							lst: [
								{ term: { name: 'TP53', type: 'geneVariant', isleaf: true } },
								{ term: { name: 'KRAS', type: 'geneVariant', isleaf: true } },
								{ term: { name: 'AKT1', type: 'geneVariant', isleaf: true } }
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
							lst: [
								{ term: { name: 'TP53', type: 'geneVariant', isleaf: true } },
								{ term: { name: 'KRAS', type: 'geneVariant', isleaf: true } },
								{ term: { name: 'AKT1', type: 'geneVariant', isleaf: true } }
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
							lst: [
								{ term: { name: 'TP53', type: 'geneVariant', isleaf: true } },
								{ term: { name: 'KRAS', type: 'geneVariant', isleaf: true } },
								{ term: { name: 'AKT1', type: 'geneVariant', isleaf: true } }
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

		const termLabels = matrix.Inner.dom.termLabelG.selectAll('.sjpp-matrix-term-label-g .sjpp-matrix-label')._groups[0]
		test.true(termLabels[0].textContent.startsWith('TP53'), `should sort genes by input data order`)
		test.true(termLabels[2].textContent.startsWith('AKT1'), `should sort genes by input data order`)
		if (test._ok) matrix.Inner.app.destroy()
		test.end()
	}
})

tape('avoid race condition', function (test) {
	test.timeoutAfter(1000)
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
							lst: [
								{ term: { name: 'TP53', type: 'geneVariant', isleaf: true } },
								{ term: { name: 'KRAS', type: 'geneVariant', isleaf: true } },
								{ term: { name: 'AKT1', type: 'geneVariant', isleaf: true } }
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
		matrix.Inner.app.vocabApi.origGetAnnotatedSampleData = matrix.Inner.app.vocabApi.getAnnotatedSampleData
		matrix.Inner.app.vocabApi.getAnnotatedSampleData = async (opts, _refs = {}) => {
			await sleep(i)
			i = 0
			return await matrix.Inner.app.vocabApi.origGetAnnotatedSampleData(opts, _refs)
		}
		let i = 5
		const results = await Promise.all([
			matrix.Inner.app.dispatch({
				type: 'plot_edit',
				id: matrix.id,
				config: {
					termgroups: [
						{
							name: '',
							lst: [
								{ term: { name: 'KRAS', type: 'geneVariant', isleaf: true } },
								{ term: { name: 'AKT1', type: 'geneVariant', isleaf: true } }
							]
						}
					]
				}
			}),
			(async () => {
				await sleep(5)
				matrix.Inner.app.dispatch({
					type: 'plot_edit',
					id: matrix.id,
					config: {
						termgroups: [
							{
								name: '',
								lst: [{ term: { name: 'BCR', type: 'geneVariant', isleaf: true } }]
							}
						]
					}
				})
			})()
		])

		matrix.on('postRender.test', () => {
			matrix.on('postRender.test', null)
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
	}
})
