import tape from 'tape'
import { validateAggMatrixAxes } from '#shared/aggregateMatrix.js'
import * as helpers from '../../../test/front.helpers.js'
import { getTermCopy } from '../../../test/testdata/termjson.ts'
import {
	getGeneVariantTw,
	getIsoformExpCollectionFractionTw,
	getScctTw,
	getSsgseaTw
} from '../../../test/testdata/data.ts'

/*
Tests:
	- Test rendering of two genes vs single gene set
	- Multiple sections and categories aggregate matrix
	- Gene variant rows by sex columns
	- Gene variant pies by diagnosis group columns
	- Diagnosis group rows by age columns
	- DNA methylation rows by sex columns
	- Isoform expression rows by diagnosis group columns
	- Cell type rows by cell type columns
 */

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('mass', {
	state: {
		nav: {
			header_mode: 'hidden'
		},
		vocab: {
			dslabel: 'TermdbTest',
			genome: 'hg38-test'
		}
	},
	debug: 1
})

// TermdbTest terms and term wrappers shared with other client tests
const sex = getTermCopy('sex')
const diaggrp = getTermCopy('diaggrp')
const agedx = getTermCopy('agedx')
const ssgsea = getSsgseaTw()
const tp53Variant = getGeneVariantTw()
const krasRegionVariant = getGeneVariantTw(true)
const krasIsoforms = getIsoformExpCollectionFractionTw().term.termlst

const geneExpression = (gene: string) => ({ name: gene, gene, type: 'geneExpression' })
const dnaMethylation = (name: string, start: number, stop: number) => ({
	name,
	id: `chr17:${start}-${stop}`,
	chr: 'chr17',
	start,
	stop,
	genomicFeatureType: 'promoter',
	type: 'dnaMethylation'
})

/** Rows, columns, and dots rendered by the plot. */
function getRendered(aggregateMatrix: any) {
	const mainDiv = aggregateMatrix.Inner.dom.mainDiv.node()
	const texts = (selector: string) => [...mainDiv.querySelectorAll(selector)].map((e: any) => e.textContent)
	return {
		mainDiv,
		error: aggregateMatrix.Inner.dom.errorDiv.node().textContent,
		rowLabels: texts('.sjpp-ag-matrix-row-label'),
		colLabels: texts('.sjpp-ag-matrix-col-label'),
		rowSections: texts('.sjpp-ag-matrix-row-section-label'),
		colSections: texts('.sjpp-ag-matrix-col-section-label'),
		dots: mainDiv.querySelectorAll('.sjpp-ag-matrix-dot').length
	}
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- plots/aggregateMatrix -***-')
	test.end()
})

tape('Test rendering of two genes vs single gene set', function (test) {
	test.timeoutAfter(10000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'aggregateMatrix',
					rows: {
						Genes: [geneExpression('TP53'), geneExpression('KRAS')]
					},
					columns: {
						'Gene sets': [ssgsea]
					},
					settings: {
						aggregateMatrix: {
							gradientMethod: 'mean',
							sizeMethod: 'percent'
						}
					}
				}
			]
		},
		aggregateMatrix: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(aggregateMatrix: any) {
		aggregateMatrix.on('postRender.test', null)
		const rendered = getRendered(aggregateMatrix)

		test.equal(rendered.error, '', 'Should not display an error')
		test.deepEqual(rendered.rowLabels, ['TP53', 'KRAS'], 'Should render a row label for each gene')
		test.deepEqual(rendered.colLabels, ['HALLMARK_ADIPOGENESIS'], 'Should render a column label for each gene set')
		test.equal(rendered.dots, 2, 'Should render a dot for every row and column')

		// if (test['_ok']) aggregateMatrix.Inner.app.destroy()
		test.end()
	}
})

tape('Multiple sections and categories aggregate matrix', function (test) {
	test.timeoutAfter(10000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'aggregateMatrix',
					rows: {
						Genes: [geneExpression('TP53'), geneExpression('KRAS')],
						'Really long row section gene variant label for testing': [tp53Variant, krasRegionVariant]
					},
					columns: {
						'Gene sets': [ssgsea],
						'Really long column section gene label for testing': [geneExpression('KRAS')]
					},
					settings: {
						aggregateMatrix: {
							gradientMethod: 'mean',
							sizeMethod: 'percent',
							startColor: '#57ea57',
							stopColor: '#6424f9'
						}
					}
				}
			]
		},
		aggregateMatrix: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(aggregateMatrix: any) {
		aggregateMatrix.on('postRender.test', null)
		const rendered = getRendered(aggregateMatrix)

		test.equal(rendered.error, '', 'Should not display an error')
		test.deepEqual(
			rendered.rowSections,
			['Genes', 'Really long row section gene variant label for testing'],
			'Should render the row sections in the requested order'
		)
		test.deepEqual(
			rendered.colSections,
			['Gene sets', 'Really long column section gene label for testing'],
			'Should render the column sections in the requested order'
		)
		test.equal(rendered.rowLabels.length, 4, 'Should render a row label for every row term')
		test.equal(rendered.colLabels.length, 2, 'Should render a column label for every column term')
		test.equal(rendered.dots, 8, 'Should render a dot for every row and column')

		// if (test['_ok']) aggregateMatrix.Inner.app.destroy()
		test.end()
	}
})

tape('Gene variant rows by sex columns', function (test) {
	test.timeoutAfter(20000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'aggregateMatrix',
					rows: {
						'Gene variants': [tp53Variant, krasRegionVariant]
					},
					columns: {
						Sex: [sex]
					},
					settings: {
						aggregateMatrix: {
							// No mean: neither gene variant nor categorical terms have a numeric value
							gradientMethod: 'percent',
							sizeMethod: 'count'
						}
					}
				}
			]
		},
		aggregateMatrix: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(aggregateMatrix: any) {
		aggregateMatrix.on('postRender.test', null)
		const rendered = getRendered(aggregateMatrix)

		test.equal(rendered.error, '', 'Should not display an error')
		test.deepEqual(
			rendered.rowLabels,
			['TP53', 'KRASregion'],
			'Should label gene variant terms by their gene or region name, as the terms have only genes[]'
		)
		// The shared sex term lists 1 as Female, but in TermdbTest 1 is Male. The labels come from the dataset.
		test.deepEqual(
			rendered.colLabels,
			['Male', 'Female'],
			'Should label the sex categories with the labels of the dataset, not of the term in the request'
		)
		test.equal(
			rendered.dots,
			rendered.rowLabels.length * rendered.colLabels.length,
			'Should render a dot for every row and column'
		)
		const pies = rendered.mainDiv.querySelectorAll('.sjpp-ag-matrix-pie')
		test.ok(pies.length > 0, 'Should render gene variant dots as pies')
		test.ok(
			[...pies].every((pie: any) => pie.querySelectorAll('.sjpp-ag-matrix-pie-slice').length > 0),
			'Should render a slice in every pie'
		)
		test.equal(
			rendered.mainDiv.querySelectorAll('.sjpp-ag-matrix-pie-legend').length,
			1,
			'Should render one shared legend for the pie slices'
		)

		// if (test['_ok']) aggregateMatrix.Inner.app.destroy()
		test.end()
	}
})

/** Plots rows by columns, waits for the render, and checks that every row and column has a dot.
 * Not an async function: tape ends a test when the promise it returns resolves, which is before the plot renders. */
function testMatrix(
	test: any,
	rows: any,
	columns: any,
	settings: { gradientMethod: string; sizeMethod: string },
	runTests: (rendered: ReturnType<typeof getRendered>) => void
) {
	test.timeoutAfter(20000)
	runpp({
		state: {
			plots: [{ chartType: 'aggregateMatrix', rows, columns, settings: { aggregateMatrix: settings } }]
		},
		aggregateMatrix: {
			callbacks: {
				'postRender.test': (aggregateMatrix: any) => {
					aggregateMatrix.on('postRender.test', null)
					const rendered = getRendered(aggregateMatrix)
					test.equal(rendered.error, '', 'Should not display an error')
					test.ok(rendered.rowLabels.length > 0, 'Should render row labels')
					test.ok(rendered.colLabels.length > 0, 'Should render column labels')
					test.equal(
						rendered.dots,
						rendered.rowLabels.length * rendered.colLabels.length,
						'Should render a dot for every row and column'
					)
					runTests(rendered)
					// if (test['_ok']) aggregateMatrix.Inner.app.destroy()
					test.end()
				}
			}
		}
	})
}

tape('Gene variant pies by diagnosis group columns', function (test) {
	// A gene variant term with a dictionary term makes a pie chart: one pie per row and column, one slice per variant class
	testMatrix(
		test,
		{ 'Gene variants': [tp53Variant, krasRegionVariant] },
		{ 'Diagnosis group': [diaggrp] },
		{ gradientMethod: 'percent', sizeMethod: 'count' },
		rendered => {
			const pies = [...rendered.mainDiv.querySelectorAll('.sjpp-ag-matrix-pie')] as any[]
			test.ok(pies.length > 0, 'Should render gene variant dots as pies')
			const slices = [...rendered.mainDiv.querySelectorAll('.sjpp-ag-matrix-pie-slice')] as any[]
			test.ok(slices.length >= pies.length, 'Should render at least one slice in every pie')
			test.ok(
				slices.every(slice => slice.getAttribute('d')?.startsWith('M') && slice.getAttribute('fill')),
				'Should draw every slice as a path with a fill color'
			)
			const legend = rendered.mainDiv.querySelector('.sjpp-ag-matrix-pie-legend') as any
			test.ok(legend?.textContent.includes('Variant class'), 'Should render the variant class legend')
			const sizes = pies.map(pie => pie.getBoundingClientRect().width / 2)
			test.ok(
				sizes.every(radius => radius >= 39 && radius <= 101),
				'Should draw pies with a radius between the default pie sizes of 40 and 100'
			)
		}
	)
})

tape('Diagnosis group rows by age columns', function (test) {
	// A numeric column makes mean available. Dictionary terms expand into their categories and bins.
	testMatrix(
		test,
		{ 'Diagnosis group': [diaggrp] },
		{ 'Age at diagnosis': [agedx] },
		{ gradientMethod: 'mean', sizeMethod: 'percent' },
		rendered => {
			test.ok(rendered.rowLabels.length > 1, 'Should expand diagnosis group into one row per category')
			test.ok(rendered.colLabels.length > 1, 'Should expand age into one column per bin')
			test.deepEqual(rendered.rowSections, ['Diagnosis group'], 'Should render the row section')
			test.deepEqual(rendered.colSections, ['Age at diagnosis'], 'Should render the column section')
		}
	)
})

tape('DNA methylation rows by sex columns', function (test) {
	// The column term is categorical, so mean is not available. Only the column terms decide the methods.
	testMatrix(
		test,
		{
			'TP53 regions': [
				dnaMethylation('TP53 promoter', 7673484, 7681953),
				dnaMethylation('TP53 3 prime', 7682557, 7687424)
			]
		},
		{ Sex: [sex] },
		{ gradientMethod: 'percent', sizeMethod: 'count' },
		rendered => {
			test.deepEqual(
				rendered.rowLabels,
				['TP53 promoter', 'TP53 3 prime'],
				'Should render one row per methylation region'
			)
			test.deepEqual(rendered.colSections, ['Sex'], 'Should render the column section')
		}
	)
})

tape('Isoform expression rows by diagnosis group columns', function (test) {
	testMatrix(
		test,
		{ 'KRAS isoforms': krasIsoforms },
		{ 'Diagnosis group': [diaggrp] },
		{ gradientMethod: 'percent', sizeMethod: 'count' },
		rendered => {
			test.deepEqual(
				rendered.rowLabels,
				krasIsoforms.map(isoform => isoform.name),
				'Should render one row per isoform'
			)
			test.ok(rendered.colLabels.length > 1, 'Should expand diagnosis group into one column per category')
		}
	)
})

tape('Cell type rows by cell type columns', function (test) {
	/* Cell type is the single cell cell type term of TermdbTest. It expands into one entry per cell type.
	Its terms are cells, so they only combine with other cell type terms, not with sample-level terms such as
	gene variant. The plot rejects that combination when the app starts, so nothing renders for it. */
	test.throws(
		() => validateAggMatrixAxes({ 'Gene variants': [tp53Variant] }, { 'Cell type': [{ ...getScctTw(), q: {} }] }),
		/cannot be combined with sample-level terms/,
		'Should reject a cell type column with gene variant rows'
	)
	testMatrix(
		test,
		{ 'Cell type': [{ ...getScctTw(), q: {} }] },
		{ 'Cell type again': [{ ...getScctTw(), q: {} }] },
		{ gradientMethod: 'percent', sizeMethod: 'count' },
		rendered => {
			test.deepEqual(rendered.rowSections, ['Cell type'], 'Should render the cell type row section')
			test.deepEqual(rendered.colSections, ['Cell type again'], 'Should render the cell type column section')
			test.ok(rendered.rowLabels.length > 1, 'Should expand cell type into one row per cell type')
			test.deepEqual(rendered.colLabels, rendered.rowLabels, 'Should expand both axes into the same cell types')
		}
	)
})
