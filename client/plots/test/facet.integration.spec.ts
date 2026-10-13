import tape from 'tape'
import * as helpers from '../../test/front.helpers.js'
import { detectGte } from '../../test/test.helpers.js'
import { getFilterItemByTag } from '#filter/filter'
import { rebaseGroupFilter } from '../../mass/groups.js'

/* 
Tests:
    - Render facet table
	- geneVariant facet table
	- geneExpression facet table
	- termCollection (row), categorical (col)
	- categorical (row), termCollection (col)
	- static count table when displaySampleIds is disabled
	- create a group from selected cells
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

tape('geneVariant facet table', test => {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'facet',
					columnTw: { id: 'sex' },
					rowTw: { term: { type: 'geneVariant', gene: 'TP53' } }
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
			prompt && prompt.text() == 'Click on cells to select samples',
			'Should render prompt to select cells on render.'
		)

		const clickableCells = await detectGte({
			elem: table.node(),
			selector: 'td.sja_menuoption'
		})
		test.equal(clickableCells.length, 4, 'Should render 4 clickable cells.')

		if (test['_ok']) facet.Inner.app.destroy()
		test.end()
	}
})

tape('geneExpression facet table', test => {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'facet',
					columnTw: { id: 'sex' },
					rowTw: { term: { type: 'geneExpression', gene: 'TP53' } }
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
		test.equal(rowNum, 8, 'Should render 8 rows')

		const prompt = table.select('div[data-testid="sjpp-facet-start-prompt"]')
		test.true(
			prompt && prompt.text() == 'Click on cells to select samples',
			'Should render prompt to select cells on render.'
		)

		const blankCells = await detectGte({
			elem: table.node(),
			selector: 'td.highlightable-cell'
		})
		test.equal(blankCells.length, 2, 'Should render 2 blank, highlightable cells.')

		const clickableCells = await detectGte({
			elem: table.node(),
			selector: 'td.sja_menuoption'
		})
		test.equal(clickableCells.length, 14, 'Should render 14 clickable cells.')

		if (test['_ok']) facet.Inner.app.destroy()
		test.end()
	}
})

tape('termCollection (row), categorical (col)', test => {
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
		test.equal(rowNum, 3, 'Should render 3 rows')

		const prompt = table.select('div[data-testid="sjpp-facet-start-prompt"]')
		test.true(
			prompt && prompt.text() == 'Values in cells are averages',
			'Should render prompt that cells are averages.'
		)

		const cells = await detectGte({
			elem: table.node(),
			selector: 'td.sja_menuoption'
		})
		test.equal(cells.length, 6, 'Should render 6 cells.')

		if (test['_ok']) facet.Inner.app.destroy()
		test.end()
	}
})

tape('categorical (row), termCollection (col)', test => {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'facet',
					columnTw: getTermCollection(),
					rowTw: { id: 'sex' }
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
		test.equal(headerNum, 3, 'Should render 3 headers')
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
		test.equal(cells.length, 6, 'Should render 6 cells.')

		if (test['_ok']) facet.Inner.app.destroy()
		test.end()
	}
})

tape('static count table when displaySampleIds is disabled', test => {
	test.timeoutAfter(3000)

	/*
	TermdbTest sets displaySampleIds: () => true, so every case above takes the interactive
	sample-level branch. Turn that policy off while the token stays verified -- the shape of a
	logged-in role the dataset still denies sample ids, e.g. careReg 'user' -- and the static count
	table must be what renders. renderTable() pairs both checks, and server/src/termdb.get_matrix.ts
	enforces the same boundary by withholding sample rows and refs.bySampleId, so a regression here
	would ask for sample-level data the server never serves.
	*/
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

	// the first render uses the dataset default; the re-render below is the one under test
	let policyDisabled = false

	async function runTests(facet) {
		if (policyDisabled) return
		policyDisabled = true

		facet.Inner.app.vocabApi.termdbConfig.displaySampleIds = false
		await facet.Inner.app.dispatch({
			type: 'plot_edit',
			id: facet.Inner.id,
			config: { settings: { facet: { showPercents: true } } }
		})

		const table = facet.Inner.dom.mainDiv

		test.true(facet.Inner.app.vocabApi.hasVerifiedToken(), 'Should still hold a verified token')

		const headerNum = table.selectAll('th[data-testid="sjpp-facet-col-header"]').size()
		test.equal(headerNum, 5, 'Should render 5 headers')
		const rowNum = table.selectAll('td[data-testid="sjpp-facet-row-label"]').size()
		test.equal(rowNum, 7, 'Should render 7 rows')

		const prompt = table.selectAll('div[data-testid="sjpp-facet-start-prompt"]').size()
		test.equal(prompt, 0, 'Should not render the prompt to select cells.')

		/* the only cell class renderStaticTable() sets is sja_menuoption, on cells that carry a count,
		so highlightable-cell is what separates a selectable grid from a static one */
		const selectableCells = table.selectAll('td.highlightable-cell').size()
		test.equal(selectableCells, 0, 'Should not render selectable cells.')

		if (test['_ok']) facet.Inner.app.destroy()
		test.end()
	}
})

function getTermCollection() {
	return {
		type: 'TermCollectionTWCont',
		term: {
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
				},
				{
					type: 'float',
					bins: {
						default: {
							type: 'regular-bin',
							startinclusive: true,
							bin_size: 5,
							first_bin: { stop: 25 },
							last_bin: { start: 55 }
						}
					},
					name: 'Age (years) at Death',
					id: 'a_death',
					isleaf: true,
					values: {},
					hashtmldetail: true
				}
			],
			name: 'Fake Collection 1',
			isleaf: true,
			propsByTermId: {
				agedx: { color: '#1b9e77' },
				agelastvisit: { color: '#e7298a' },
				a_death: { color: '#d95f02' }
			}
		},
		q: { isAtomic: true, mode: 'continuous', lst: [] }
	}
}

tape('create a group from selected cells', async test => {
	test.timeoutAfter(20000)
	const cases = [
		{ name: 'bins by categories', columnTw: { id: 'agedx' }, rowTw: { id: 'diaggrp' } },
		{
			name: 'categories by groups of a gene variant term',
			columnTw: { id: 'diaggrp' },
			rowTw: { term: { type: 'geneVariant', gene: 'TP53' } }
		}
	]
	const wait = (fn, ms = 5000) =>
		new Promise<void>((resolve, reject) => {
			const start = Date.now()
			const i = setInterval(() => {
				const done = fn()
				if (!done && Date.now() - start <= ms) return
				clearInterval(i)
				if (done) resolve()
				else reject('timed out waiting')
			}, 50)
		})

	for (const c of cases) {
		await new Promise<void>(resolve => {
			runpp({
				state: { plots: [{ chartType: 'facet', columnTw: c.columnTw, rowTw: c.rowTw }] },
				facet: { callbacks: { 'postRender.test': runTests } }
			})

			let started
			async function runTests(facet) {
				if (started) return
				started = true
				facet.on('postRender.test', null)
				const app = facet.Inner.app
				const main = facet.Inner.dom.mainDiv.node()
				try {
					// one cell as a group, then two cells, then every cell. the table is drawn again after each
					const expected: number[] = []
					let numRows = 0
					for (const pick of [cells => [cells[0]], cells => [cells[1], cells.at(-1)], cells => cells]) {
						const cells: any[] = [...main.querySelectorAll('td.sja_menuoption')]
						if (cells.length < 3) throw 'the table has fewer than 3 cells with samples'
						numRows = new Set(cells.map(td => td.parentNode)).size
						const n = app.getState().groups.length
						const selection = pick(cells)
						for (const td of selection) td.dispatchEvent(new Event('click'))
						expected.push(selection.reduce((sum, td) => sum + Number.parseInt(td.textContent), 0))
						const button: any = [...main.querySelectorAll('button')].find((b: any) => b.textContent == 'Create group')
						button.dispatchEvent(new Event('click'))
						await wait(() => app.getState().groups.length == n + 1)
						await wait(() => main.querySelector('td.sja_menuoption') && !main.querySelector('td[style*="blue"]'))
					}
					const groups = rebaseGroupFilter(app.getState())
					test.ok(
						groups.every(g => getFilterItemByTag(g.filter, 'filterUiRoot') && !JSON.stringify(g).includes('sampleId')),
						`${c.name}: should define each group by conditions, and list no sample`
					)
					test.equal(
						getFilterItemByTag(groups[1].filter, 'filterUiRoot').join,
						'or',
						`${c.name}: should join the conditions of several cells with "or"`
					)
					test.equal(
						getFilterItemByTag(groups[2].filter, 'filterUiRoot').lst.length,
						numRows,
						`${c.name}: should state the condition of a row once, for all of its selected cells`
					)
					const sizes: number[] = []
					for (const g of groups) sizes.push((await app.vocabApi.getFilteredSampleList(g.filter)).length)
					test.deepEqual(sizes, expected, `${c.name}: should select as many samples in each group as its cells have`)
				} catch (e: any) {
					test.fail(`${c.name}: ${e?.message || e}`)
				}
				if (test['_ok']) app.destroy()
				resolve()
			}
		})
	}
	test.end()
})
