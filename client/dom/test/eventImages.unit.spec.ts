import tape from 'tape'
import { select } from 'd3-selection'
import type { EventImage } from '#types'
import { renderEventImages } from '../eventImages'

/* Tests
	- one button per image
	- clicking a button previews its image, clicking it again hides the preview
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

function getImages(): EventImage[] {
	return [
		{ label: 'Image A', src: gifSrc + '#a' },
		{ label: 'Image B', src: gifSrc + '#b' }
	]
}

function getButtons(holder): HTMLButtonElement[] {
	return holder.selectAll('button').nodes()
}

function getPreview(holder): HTMLElement {
	return holder.select('[data-testid="sjpp-event-image-preview"]').node()
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
	renderEventImages(holder, getImages())

	test.notOk(holder.text().includes('Loading...'), 'Should replace the holder contents')
	const buttons = getButtons(holder)
	test.deepEqual(
		buttons.map(b => b.textContent),
		['Image A', 'Image B'],
		'Should render a button for each image'
	)
	test.ok(
		buttons.every(b => b.getAttribute('aria-pressed') == 'false'),
		'Should render all buttons as not pressed'
	)
	test.equal(getPreview(holder).style.display, 'none', 'Should hide the preview to begin with')

	holder.remove()
	test.end()
})

tape('click to show and hide an image', test => {
	const holder = getHolder()
	const images = getImages()
	renderEventImages(holder, images)
	const [a, b] = getButtons(holder)
	const preview = getPreview(holder)

	a.click()
	test.equal(preview.style.display, '', 'Should show the preview')
	const img = preview.querySelector('img')
	test.equal(img?.getAttribute('src'), images[0].src, 'Should preview the image of the clicked button')
	test.equal(img?.getAttribute('alt'), 'Image A', 'Should describe the image by its label')
	test.equal(a.getAttribute('aria-pressed'), 'true', 'Should mark the clicked button as pressed')

	b.click()
	test.equal(a.getAttribute('aria-pressed'), 'false', 'Should unpress the previous button')
	test.equal(b.getAttribute('aria-pressed'), 'true', 'Should mark the newly clicked button as pressed')
	const imgs = preview.querySelectorAll('img')
	test.equal(imgs.length, 1, 'Should replace the previewed image')
	test.equal(imgs[0].getAttribute('src'), images[1].src, 'Should preview the image of the newly clicked button')

	b.click()
	test.equal(b.getAttribute('aria-pressed'), 'false', 'Should unpress a button clicked again')
	test.equal(preview.style.display, 'none', 'Should hide the preview when the pressed button is clicked again')
	test.equal(preview.childNodes.length, 0, 'Should clear the preview when hidden')

	holder.remove()
	test.end()
})

tape('image that cannot be displayed', async test => {
	const holder = getHolder()
	renderEventImages(holder, [{ label: 'Image A', src: 'data:image/png;base64,invalid' }])
	const preview = getPreview(holder)

	getButtons(holder)[0].click()
	const img = preview.querySelector('img')!
	if (!img.complete) await new Promise(resolve => img.addEventListener('error', resolve))
	test.equal(preview.textContent, 'Error: Could not display image', 'Should show the display error')

	holder.remove()
	test.end()
})
