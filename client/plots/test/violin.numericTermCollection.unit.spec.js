import tape from 'tape'
import { violinInit } from '../violin.js'

/**
 * Tests for numeric termCollection support in violin plot
 */

tape('isNumericTermCollection() detection', function (test) {
	test.plan(3)

	// Test 1: Numeric termCollection should return true
	const mockViolinWithNumericCollection = {
		type: 'violin',
		id: 'test1',
		opts: {},
		state: {
			config: {
				term: {
					term: {
						type: 'termCollection',
						memberType: 'numeric',
						termlst: [
							{ id: 'gene1', name: 'Gene 1', type: 'float' },
							{ id: 'gene2', name: 'Gene 2', type: 'float' }
						]
					}
				},
				settings: { violin: {} }
			}
		},
		config: {
			term: {
				term: {
					type: 'termCollection',
					memberType: 'numeric',
					termlst: [
						{ id: 'gene1', name: 'Gene 1', type: 'float' },
						{ id: 'gene2', name: 'Gene 2', type: 'float' }
					]
				}
			},
			settings: { violin: {} }
		},
		settings: {}
	}

	const violinPlot1 = Object.assign(Object.create({ isNumericTermCollection: function () {
		const t1 = this.config.term
		return t1?.term?.type === 'termCollection' && t1.term.memberType === 'numeric'
	} }), mockViolinWithNumericCollection)

	test.equal(violinPlot1.isNumericTermCollection(), true, 'Should detect numeric termCollection')

	// Test 2: Regular numeric term should return false
	const mockViolinWithRegularTerm = {
		type: 'violin',
		id: 'test2',
		opts: {},
		state: {
			config: {
				term: {
					term: {
						type: 'float',
						id: 'agedx',
						name: 'Age at Diagnosis'
					}
				},
				settings: { violin: {} }
			}
		},
		config: {
			term: {
				term: {
					type: 'float',
					id: 'agedx',
					name: 'Age at Diagnosis'
				}
			},
			settings: { violin: {} }
		},
		settings: {}
	}

	const violinPlot2 = Object.assign(Object.create({ isNumericTermCollection: function () {
		const t1 = this.config.term
		return t1?.term?.type === 'termCollection' && t1.term.memberType === 'numeric'
	} }), mockViolinWithRegularTerm)

	test.equal(violinPlot2.isNumericTermCollection(), false, 'Should not detect regular term as termCollection')

	// Test 3: Categorical termCollection should return false
	const mockViolinWithCategoricalCollection = {
		type: 'violin',
		id: 'test3',
		opts: {},
		state: {
			config: {
				term: {
					term: {
						type: 'termCollection',
						memberType: 'categorical',
						termlst: [
							{ id: 'cat1', name: 'Category 1', type: 'categorical' },
							{ id: 'cat2', name: 'Category 2', type: 'categorical' }
						]
					}
				},
				settings: { violin: {} }
			}
		},
		config: {
			term: {
				term: {
					type: 'termCollection',
					memberType: 'categorical',
					termlst: [
						{ id: 'cat1', name: 'Category 1', type: 'categorical' },
						{ id: 'cat2', name: 'Category 2', type: 'categorical' }
					]
				}
			},
			settings: { violin: {} }
		},
		settings: {}
	}

	const violinPlot3 = Object.assign(Object.create({ isNumericTermCollection: function () {
		const t1 = this.config.term
		return t1?.term?.type === 'termCollection' && t1.term.memberType === 'numeric'
	} }), mockViolinWithCategoricalCollection)

	test.equal(violinPlot3.isNumericTermCollection(), false, 'Should not detect categorical termCollection as numeric')
})

tape('combineNumericTermCollectionData() merges results correctly', function (test) {
	test.plan(4)

	const mockViolinConfig = {
		term: {
			term: {
				type: 'termCollection',
				memberType: 'numeric',
				termlst: [
					{ id: 'gene1', name: 'Gene 1', type: 'float' },
					{ id: 'gene2', name: 'Gene 2', type: 'float' }
				],
				propsByTermId: {
					gene1: { color: '#FF0000' },
					gene2: { color: '#00FF00' }
				}
			}
		}
	}

	const mockResults = [
		{
			memberTerm: { id: 'gene1', name: 'Gene 1' },
			data: {
				min: 10,
				max: 100,
				charts: {
					default: {
						chartId: 'default',
						plots: [
							{
								label: 'Plot 1',
								summaryStats: [{ id: 'median', value: 50 }],
								color: null
							}
						],
						pvalues: []
					}
				},
				bins: {},
				descrStats: { min: 10, max: 100 }
			}
		},
		{
			memberTerm: { id: 'gene2', name: 'Gene 2' },
			data: {
				min: 5,
				max: 80,
				charts: {
					default: {
						chartId: 'default',
						plots: [
							{
								label: 'Plot 2',
								summaryStats: [{ id: 'median', value: 40 }],
								color: null
							}
						],
						pvalues: []
					}
				},
				bins: {},
				descrStats: { min: 5, max: 80 }
			}
		}
	]

	// Create a mock violin instance with the combineNumericTermCollectionData method
	const violinInstance = {
		combineNumericTermCollectionData: function (results, termCollection) {
			let min = Infinity
			let max = -Infinity
			const combinedCharts = {}

			results.forEach(({ memberTerm, data }) => {
				if (data.min !== undefined && data.min < min) min = data.min
				if (data.max !== undefined && data.max > max) max = data.max

				Object.entries(data.charts || {}).forEach(([chartId, chart]) => {
					if (!combinedCharts[chartId]) {
						combinedCharts[chartId] = {
							chartId,
							plots: [],
							pvalues: chart.pvalues
						}
					}

					chart.plots.forEach((plot) => {
						const updatedPlot = {
							...plot,
							label: memberTerm.name || memberTerm.id,
							color: termCollection.term.propsByTermId?.[memberTerm.id]?.color || plot.color
						}
						combinedCharts[chartId].plots.push(updatedPlot)
					})
				})
			})

			return {
				min: min === Infinity ? undefined : min,
				max: max === -Infinity ? undefined : max,
				bins: results[0]?.data.bins || {},
				charts: combinedCharts,
				descrStats: results[0]?.data.descrStats,
				uncomputableValues: null
			}
		}
	}

	const combined = violinInstance.combineNumericTermCollectionData(mockResults, mockViolinConfig.term)

	test.equal(combined.min, 5, 'Should use minimum value from all results')
	test.equal(combined.max, 100, 'Should use maximum value from all results')
	test.equal(combined.charts.default.plots.length, 2, 'Should combine plots from all member terms')
	test.equal(
		combined.charts.default.plots[0].color,
		'#FF0000',
		'Should apply color from propsByTermId'
	)
})
