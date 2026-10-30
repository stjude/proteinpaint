import type { EventImage } from '#types'
import type { Button, Elem } from '../types/d3'

/*
renders the images of an event as buttons, clicking one shows the image as an inline preview below the buttons

holder: d3 element, contents are replaced
images[]: {label, src}, from the termdb/mds3/eventImage route
*/
export function renderEventImages(holder: Elem, images: EventImage[]) {
	holder.text('')
	const buttons = holder.append('div').style('margin-bottom', '4px')
	const preview = holder
		.append('div')
		.attr('data-testid', 'sjpp-event-image-preview')
		.style('display', 'none')
		.style('margin-top', '5px')
	let active: Button | null = null
	const setActive = (button: Button | null) => {
		if (active)
			active.attr('aria-pressed', 'false').style('font-weight', '').style('background-color', '').style('color', '')
		active = button
		if (button)
			button
				.attr('aria-pressed', 'true')
				.style('font-weight', 'bold')
				.style('background-color', '#255398')
				.style('color', 'white')
	}
	for (const image of images) {
		const button = buttons
			.append('button')
			.attr('type', 'button')
			.attr('aria-pressed', 'false')
			.style('margin', '3px')
			.text(image.label)
		button.on('click', () => {
			preview.selectAll('*').remove()
			if (active == button) {
				setActive(null)
				preview.style('display', 'none')
				return
			}
			setActive(button)
			preview.style('display', '')
			const div = preview
				.append('div')
				.style('width', 'min(800px, 75vw)')
				.style('max-height', '70vh')
				.style('overflow', 'auto')
				.style('border', '1px solid #ccc')
			div
				.append('img')
				.attr('alt', image.label)
				.style('display', 'block')
				.style('width', '100%')
				.on('error', () => div.text('Error: Could not display image'))
				.attr('src', image.src)
		})
	}
}
