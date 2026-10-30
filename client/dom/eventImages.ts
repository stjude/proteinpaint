import type { EventImageGroup } from '#types'
import type { Button, Elem } from '../types/d3'

/*
renders the images of an event as buttons, clicking one shows the image as an inline preview below the buttons

holder: d3 element, contents are replaced
groups[]: {label, images:[{file, label}]}, from the eventImages query of termdb/mds3
loadImage(file): async, returns the image src for a listed file; successful loads are cached
*/
export function renderEventImages(
	holder: Elem,
	groups: EventImageGroup[],
	loadImage: (file: string) => Promise<string>
) {
	holder.text('')
	const buttons = holder.append('div')
	const preview = holder
		.append('div')
		.attr('data-testid', 'sjpp-event-image-preview')
		.style('display', 'none')
		.style('margin-top', '5px')
	const srcByFile = new Map<string, string>()
	let active: Button | null = null
	let shown = 0
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
	for (const group of groups) {
		const div = buttons.append('div').style('margin-bottom', '4px')
		if (groups.length > 1) div.append('div').text(group.label).style('font-size', '0.85em')
		for (const image of group.images) {
			const button = div
				.append('button')
				.attr('type', 'button')
				.attr('aria-pressed', 'false')
				.style('margin', '3px')
				.text(image.label)
			button.on('click', async () => {
				const showToken = ++shown
				preview.selectAll('*').remove()
				if (active == button) {
					setActive(null)
					preview.style('display', 'none')
					return
				}
				setActive(button)
				preview.style('display', '')
				const wait = preview.append('div').text('Loading...')
				try {
					let src = srcByFile.get(image.file)
					if (!src) {
						src = await loadImage(image.file)
						srcByFile.set(image.file, src)
					}
					if (showToken != shown) return
					preview
						.append('div')
						.style('width', 'min(800px, 75vw)')
						.style('max-height', '70vh')
						.style('overflow', 'auto')
						.style('border', '1px solid #ccc')
						.append('img')
						.attr('alt', `${group.label}: ${image.label}`)
						.style('display', 'block')
						.style('width', '100%')
						.on('load', () => wait.remove())
						.on('error', () => wait.text('Error: Could not display image'))
						.attr('src', src)
				} catch (e: any) {
					if (showToken == shown) wait.text('Error: ' + (e.message || e))
				}
			})
		}
	}
}
