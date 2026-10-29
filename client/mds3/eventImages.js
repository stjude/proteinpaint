import { renderEventImages } from '#dom/eventImages'

/*
adds a row to the item table of a svfusion event to show its images, if the ds has svfusion.eventImages
the row is hidden until there are images to show

returns update(range), to list the images of the event limited to samples whose partner breakpoint is in range{},
or all samples when range is null; or undefined when the ds has no event images
*/
export function eventImageRow(arg, table) {
	const eventImages = arg.tk.mds.eventImages
	if (!eventImages?.get) return
	const [key, cell] = table.addRow()
	key.text(eventImages.label)
	const row = cell.node().parentNode
	row.style.display = 'none'
	cell.attr('data-testid', 'sjpp-mds3-event-images')
	let latest = 0 // increments on each update, so that a slow response does not overwrite a newer one

	return async range => {
		const token = ++latest
		row.style.display = ''
		cell.text('Loading...')
		const m = arg.mlst[0]
		try {
			const { groups } = await eventImages.get({ m, range, tid2value: arg.tid2value })
			if (token != latest) return
			if (!Array.isArray(groups)) throw 'groups[] not array from return'
			row.style.display = groups.length ? '' : 'none'
			renderEventImages(cell, groups, async file => {
				const { src } = await eventImages.get({ m, range, file, tid2value: arg.tid2value })
				if (!src) throw 'src missing from return'
				return src
			})
		} catch (e) {
			if (token == latest) cell.text('Error: ' + (e.message || e))
		}
	}
}
