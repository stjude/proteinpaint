import tape from 'tape'
import { select } from 'd3-selection'
import { makeTileGrid, makeAsyncCard } from '../tileCard.ts'

/**
 * Tests
 *  - makeAsyncCard(): a card of data is drawn once the data loads, and left out without data
 *  - makeAsyncCard(): a card started open opens after its async face is drawn
 */

/**************
 helper functions
***************/

function getHolder() {
	return select(document.body).append('div')
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- plots/tileCard -***-')
	test.end()
})

tape('makeAsyncCard(): data and no data', async function (test) {
	const holder = getHolder()
	const grid = makeTileGrid(holder)
	const withData = makeAsyncCard(grid, {
		title: 'A',
		data: Promise.resolve({ v: 1 }),
		renderFace: (face, data: any) => {
			face.append('div').attr('class', 'face').text(`v=${data.v}`)
		},
		renderExpanded: () => {}
	})
	const noData = makeAsyncCard(grid, {
		title: 'B',
		data: Promise.resolve(null),
		renderFace: () => {},
		renderExpanded: () => {}
	})
	test.ok(withData.text().includes('Loading'), 'Should show a loading card before the data loads.')
	await new Promise(r => setTimeout(r, 0))
	test.equal(withData.select('.face').text(), 'v=1', 'Should draw the face from the loaded data.')
	test.notOk(withData.text().includes('Loading'), 'Should replace the loading card.')
	test.notOk(noData.node().isConnected, 'Should leave out the card of no data.')
	holder.remove()
	test.end()
})

tape('makeAsyncCard(): started open with an async face', async function (test) {
	const holder = getHolder()
	const grid = makeTileGrid(holder)
	let faceDisplayed: boolean | undefined
	const slot = makeAsyncCard(grid, {
		title: 'A',
		data: Promise.resolve({}),
		renderFace: async face => {
			// e.g. a face that imports its plot code before drawing
			await new Promise(r => setTimeout(r, 20))
			faceDisplayed = face.node().getClientRects().length > 0
		},
		renderExpanded: holder => {
			holder.append('div').attr('class', 'expanded')
		},
		open: true
	})
	await new Promise(r => setTimeout(r, 60))
	test.equal(faceDisplayed, true, 'Should keep the face displayed while it is drawn.')
	test.equal(
		slot.select('[aria-expanded]').attr('aria-expanded'),
		'true',
		'Should open the card once the face is drawn.'
	)
	test.ok(slot.select('.expanded').node(), 'Should draw the expanded view.')
	holder.remove()
	test.end()
})
