import tape from 'tape'
import { Model } from '../model/Model'

/**
 * Tests for numeric termCollection support in boxplot
 */

tape('Model.combineNumericTermCollectionData() merges results correctly', function (test) {
	test.plan(4)

	const mockBoxplot = {
		boxplot: {},
		config: {
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
			},
			settings: { boxplot: {} }
		},
		state: {},
		app: {},
		settings: {}
	} as any

	const model = new Model(mockBoxplot, mockBoxplot.config)

	const mockResults = [
		{
			memberTerm: { id: 'gene1', name: 'Gene 1' },
			data: {
				absMin: 10,
				absMax: 100,
				charts: {
					default: {
						chartId: 'default',
						plots: [
							{
								key: 'plot1',
								boxplot: { label: 'Plot 1', p50: 50 },
								color: null
							}
						],
						sampleCount: 10
					}
				},
				bins: {},
				descrStats: { min: { value: 10 }, max: { value: 100 } },
				uncomputableValues: null
			}
		},
		{
			memberTerm: { id: 'gene2', name: 'Gene 2' },
			data: {
				absMin: 5,
				absMax: 80,
				charts: {
					default: {
						chartId: 'default',
						plots: [
							{
								key: 'plot2',
								boxplot: { label: 'Plot 2', p50: 40 },
								color: null
							}
						],
						sampleCount: 8
					}
				},
				bins: {},
				descrStats: { min: { value: 5 }, max: { value: 80 } },
				uncomputableValues: null
			}
		}
	]

	const combined = model.combineNumericTermCollectionData(mockResults, mockBoxplot.config.term)

	test.equal(combined.absMin, 5, 'Should use minimum absMin from all results')
	test.equal(combined.absMax, 100, 'Should use maximum absMax from all results')
	test.equal(combined.charts.default.plots.length, 2, 'Should combine plots from all member terms')
	test.equal(combined.charts.default.plots[0].color, '#FF0000', 'Should apply color from propsByTermId')
})
