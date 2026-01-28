import tape from 'tape'
import * as helpers from '../../test/front.helpers.js'
import { detectGte } from '../../test/test.helpers.js'

/* 
Tests:
    - Render facet table
	- termCollection facet table
*/

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('mass', {
	state: {
		nav: { header_mode: 'hidden' },
		dslabel: 'TermdbTest',
		genome: 'hg38-test'
	},
	debug: 1
})

/**************
 test sections
***************/

tape('\n', test => {
	test.comment('-***- plots/facet -***-')
	test.end()
})

tape('Render facet table', test => {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'facet',
					columnTw: {
						id: 'agedx'
					},
					rowTw: {
						id: 'diaggrp'
					}
				}
			]
		},
		facet: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(facet) {
		const table = facet.Inner.dom.mainDiv

		const headerNum = table.selectAll('th[data-testid="sjpp-facet-col-header"]').size()
		test.equal(headerNum, 5, 'Should render 5 headers')
		const rowNum = table.selectAll('td[data-testid="sjpp-facet-row-label"]').size()
		test.equal(rowNum, 7, 'Should render 7 rows')

		const prompt = table.select('div[data-testid="sjpp-facet-start-prompt"]')
		test.true(
			prompt && prompt.text() == 'Click on cells to select samples',
			'Should render prompt to select cells on render.'
		)

		const blankCells = await detectGte({
			elem: table.node(),
			selector: 'td.highlightable-cell'
		})
		test.equal(blankCells.length, 18, 'Should render  18 blank, highlightable cells.')

		const clickableCells = await detectGte({
			elem: table.node(),
			selector: 'td.sja_menuoption'
		})
		test.equal(clickableCells.length, 17, 'Should render 17 clickable cells.')

		if (test['_ok']) facet.Inner.app.destroy()
		test.end()
	}
})

tape('termCollection facet table', test => {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'facet',
					columnTw: { id: 'sex' },
					rowTw: getTermCollection()
				}
			]
		},
		facet: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(facet) {
		const table = facet.Inner.dom.mainDiv

		const headerNum = table.selectAll('th[data-testid="sjpp-facet-col-header"]').size()
		test.equal(headerNum, 2, 'Should render 2 headers')
		const rowNum = table.selectAll('td[data-testid="sjpp-facet-row-label"]').size()
		test.equal(rowNum, 2, 'Should render 2 rows')

		const prompt = table.select('div[data-testid="sjpp-facet-start-prompt"]')
		test.true(
			prompt && prompt.text() == 'Values in cells are averages',
			'Should render prompt that cells are averages.'
		)

		const cells = await detectGte({
			elem: table.node(),
			selector: 'td.sja_menuoption'
		})
		test.equal(cells.length, 4, 'Should render 4 cells.')

		if (test['_ok']) facet.Inner.app.destroy()
		test.end()
	}
})

function getTermCollection() {
	return {
		type: 'TermCollectionTWValues',
		term: {
			collectionId: 'Fake Collection 1',
			type: 'termCollection',
			termlst: [
				{
					type: 'float',
					bins: {
						default: {
							type: 'regular-bin',
							bin_size: 5,
							startinclusive: true,
							first_bin: { startunbounded: true, stop: 5 }
						},
						label_offset: 1
					},
					name: 'Age (years) at Cancer Diagnosis',
					id: 'agedx',
					isleaf: true,
					values: {},
					hashtmldetail: true
				},
				{
					type: 'float',
					bins: { default: { type: 'regular-bin', startinclusive: true, bin_size: 10, first_bin: { stop: 15 } } },
					values: { '-994': { label: 'N/A: No campus visit', uncomputable: true } },
					name: 'Age at last ABC assessment',
					id: 'agelastvisit',
					isleaf: true
				}
			],
			name: '(agedx,agelastvisit)',
			isleaf: true,
			propsByTermId: {
				agedx: { color: '#1b9e77' },
				agelastvisit: { color: '#e7298a' }
			}
		},
		q: { isAtomic: true, mode: 'continuous', lst: [] }
	}
}
