import tape from 'tape'
import { select } from 'd3-selection'
import type { EventImageGroup } from '#types'
import { renderEventImages } from '../eventImages'

/* Tests
	- one button per image, group labels only with multiple groups
	- clicking a button previews its image, clicking it again hides the preview
	- loaded images are cached, failed loads are not
	- a slow load does not overwrite the preview of a later click
	- image that cannot be displayed
*/

/**************
 helper functions
***************/

// 1x1 transparent gif
const gifSrc = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

function getHolder() {
	return select('body').append('div') as any
}

function getGroups(): EventImageGroup[] {
	return [
		{
			label: 'chr1:100 > chr2:200',
			images: [
				{ file: 'a.png', label: 'Image A' },
				{ file: 'b.png', label: 'Image B' }
			]
		},
		{ label: 'chr1:101 > chr2:201', images: [{ file: 'c.png', label: 'Image C' }] }
	]
}

function getButtons(holder): HTMLButtonElement[] {
	return holder.selectAll('button').nodes()
}

function getPreview(holder): HTMLElement {
	return holder.select('[data-testid="sjpp-event-image-preview"]').node()
}

function clickAndWait(button: HTMLButtonElement) {
	button.click()
	return new Promise(resolve => setTimeout(resolve, 0))
}

/**************
 test sections
***************/

tape('\n', test => {
	test.comment('-***- dom/eventImages -***-')
	test.end()
})

tape('renders one button per image', test => {
	const holder = getHolder()
	holder.append('div').text('Loading...')
	const groups = getGroups()
	renderEventImages(holder, groups, async () => gifSrc)

	test.notOk(holder.text().includes('Loading...'), 'Should replace the holder contents')
	const buttons = getButtons(holder)
	test.deepEqual(
		buttons.map(b => b.textContent),
		['Image A', 'Image B', 'Image C'],
		'Should render a button for each image of all groups'
	)
	test.ok(
		buttons.every(b => b.getAttribute('aria-pressed') == 'false'),
		'Should render all buttons as not pressed'
	)
	test.ok(
		holder.text().includes(groups[0].label) && holder.text().includes(groups[1].label),
		'Should show group labels when there are multiple groups'
	)
	test.equal(getPreview(holder).style.display, 'none', 'Should hide the preview to begin with')

	holder.remove()
	test.end()
})

tape('does not label a single group', test => {
	const holder = getHolder()
	const groups = getGroups().slice(0, 1)
	renderEventImages(holder, groups, async () => gifSrc)

	test.equal(getButtons(holder).length, 2, 'Should render a button for each image')
	test.notOk(holder.text().includes(groups[0].label), 'Should not show the label of a single group')

	holder.remove()
	test.end()
})

tape('click to show and hide an image', async test => {
	const holder = getHolder()
	const loaded: string[] = []
	renderEventImages(holder, getGroups(), async file => {
		loaded.push(file)
		return gifSrc
	})
	const [a, b] = getButtons(holder)
	const preview = getPreview(holder)

	await clickAndWait(a)
	test.deepEqual(loaded, ['a.png'], 'Should load the file of the clicked image')
	test.equal(preview.style.display, '', 'Should show the preview')
	const img = preview.querySelector('img')
	test.equal(img?.getAttribute('src'), gifSrc, 'Should preview the loaded image')
	test.equal(img?.getAttribute('alt'), 'chr1:100 > chr2:200: Image A', 'Should describe the image by group and label')
	test.equal(a.getAttribute('aria-pressed'), 'true', 'Should mark the clicked button as pressed')

	await clickAndWait(b)
	test.equal(a.getAttribute('aria-pressed'), 'false', 'Should unpress the previous button')
	test.equal(b.getAttribute('aria-pressed'), 'true', 'Should mark the newly clicked button as pressed')
	test.equal(preview.querySelectorAll('img').length, 1, 'Should replace the previewed image')

	await clickAndWait(b)
	test.equal(b.getAttribute('aria-pressed'), 'false', 'Should unpress a button clicked again')
	test.equal(preview.style.display, 'none', 'Should hide the preview when the pressed button is clicked again')
	test.equal(preview.childNodes.length, 0, 'Should clear the preview when hidden')

	holder.remove()
	test.end()
})

tape('caches loaded images', async test => {
	const holder = getHolder()
	const loaded: string[] = []
	renderEventImages(holder, getGroups(), async file => {
		loaded.push(file)
		return gifSrc
	})
	const [a, b] = getButtons(holder)

	await clickAndWait(a)
	await clickAndWait(b)
	await clickAndWait(a)
	test.deepEqual(loaded, ['a.png', 'b.png'], 'Should not load an image again')

	holder.remove()
	test.end()
})

tape('failed load', async test => {
	const holder = getHolder()
	let calls = 0
	renderEventImages(holder, getGroups(), async () => {
		if (++calls == 1) throw 'test error'
		return gifSrc
	})
	const [a, b] = getButtons(holder)
	const preview = getPreview(holder)

	await clickAndWait(a)
	test.equal(preview.textContent, 'Error: test error', 'Should show the error')
	test.notOk(preview.querySelector('img'), 'Should not render an image')

	await clickAndWait(b)
	await clickAndWait(a)
	test.equal(calls, 3, 'Should not cache a failed load')
	test.equal(preview.querySelector('img')?.getAttribute('src'), gifSrc, 'Should show the image once loaded')

	holder.remove()
	test.end()
})

tape('slow load does not overwrite a later click', async test => {
	const holder = getHolder()
	let resolveA
	renderEventImages(holder, getGroups(), file =>
		file == 'a.png' ? new Promise(resolve => (resolveA = resolve)) : Promise.resolve(gifSrc + '#' + file)
	)
	const [a, b] = getButtons(holder)
	const preview = getPreview(holder)

	await clickAndWait(a)
	test.equal(preview.textContent, 'Loading...', 'Should show the loading message')
	await clickAndWait(b)
	resolveA(gifSrc + '#a.png')
	await new Promise(resolve => setTimeout(resolve, 0))
	const imgs = preview.querySelectorAll('img')
	test.equal(imgs.length, 1, 'Should preview only one image')
	test.equal(imgs[0]?.getAttribute('src'), gifSrc + '#b.png', 'Should preview the image of the later click')

	holder.remove()
	test.end()
})

tape('image that cannot be displayed', async test => {
	const holder = getHolder()
	renderEventImages(holder, getGroups(), async () => 'data:image/png;base64,invalid')
	const [a] = getButtons(holder)
	const preview = getPreview(holder)

	await clickAndWait(a)
	const img = preview.querySelector('img')!
	if (!img.complete) await new Promise(resolve => img.addEventListener('error', resolve))
	test.ok(preview.textContent?.includes('Error: Could not display image'), 'Should show the display error')

	holder.remove()
	test.end()
})
