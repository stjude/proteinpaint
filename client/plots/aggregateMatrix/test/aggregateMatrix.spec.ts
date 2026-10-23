import tape from 'tape'
import * as helpers from '../../../test/front.helpers.js'
import { getTermCopy } from '../../../test/testdata/termjson.ts'
import { getGeneVariantTw, getIsoformExpCollectionFractionTw, getSsgseaTw } from '../../../test/testdata/data.ts'

/*
Tests:
	- Simple aggregate matrix
	- Multiple sections and categories aggregate matrix
	- Gene variant rows by sex columns
	- Diagnosis group rows by age columns
	- DNA methylation rows by sex columns
	- Isoform expression rows by diagnosis group columns
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

/* The tests below are not async functions: tape ends a test when the promise it returns resolves,
which is before the plot renders. */

tape('Simple aggregate matrix', function (test) {
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
						'Really long row section label for testing': [tp53Variant, krasRegionVariant]
					},
					columns: {
						'Gene sets': [ssgsea],
						'Really long column section label for testing': [geneExpression('KRAS')]
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
			['Genes', 'Really long row section label for testing'],
			'Should render the row sections in the requested order'
		)
		test.deepEqual(
			rendered.colSections,
			['Gene sets', 'Really long column section label for testing'],
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
						Genes: [tp53Variant, krasRegionVariant]
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
		test.ok(rendered.colLabels.length > 0, 'Should render a column label for each observed sex category')
		test.equal(
			rendered.dots,
			rendered.rowLabels.length * rendered.colLabels.length,
			'Should render a dot for every row and column'
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
