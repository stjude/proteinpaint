import fs from 'fs/promises'
import path from 'path'
import type { SvFusionEventImagesResult, EventImage } from '#types'
import serverconfig from './serverconfig.js'
import { imageSize } from './utils/imageSize.ts'

/*
images of sv/fusion events, see ds.queries.svfusion.eventImages{}

an event may carry an image file prefix as its optional "eventImage" value: in the mattr{} of the svfusion
file, which svfusionByRangeGetter_file() attaches to a track event as m.eventImage (or to each of its partner
breakpoints, see mayUpdatePairlst() in mds3.load.js), or on the event in the singleSampleMutation data of a sample. the images of the event are the png files in eventImages.folder
that start with the prefix followed by "_"

the getter is called by load_driver() in mds3.load.js for termdb/mds3 requests with q.eventImage
*/

// called by validate_query_svfusion() in mds3.init.js
export function validate_query_svfusionEventImages(ds) {
	const q = ds.queries.svfusion.eventImages
	if (!q) return
	if (typeof q.label != 'string' || !q.label.trim()) throw 'svfusion.eventImages.label must be a nonempty string'
	if (typeof q.get == 'function') return // ds-supplied
	if (typeof q.folder != 'string' || !q.folder.trim()) throw 'svfusion.eventImages.folder must be a nonempty string'
	q.get = q => getEventImages(q, ds)
}

/* q{} is the termdb/mds3 request, and q.eventImage identifies the event
returns all images of the event, each with its png data */
async function getEventImages(q, ds): Promise<SvFusionEventImagesResult> {
	// the prefix is a file name in eventImages.folder, without the "_" and the rest of the name
	const prefix = q.eventImage
	if (typeof prefix != 'string' || !prefix || path.basename(prefix) != prefix || /[\\\0]/.test(prefix))
		throw 'invalid event image prefix'
	try {
		return { images: await readImages(prefix, ds.queries.svfusion.eventImages.folder) }
	} catch (e: any) {
		if (e.code) {
			console.log(e)
			throw 'unable to read event images'
		}
		throw e
	}
}

async function readImages(prefix: string, folderName: string): Promise<EventImage[]> {
	const folder = await fs.realpath(path.resolve(serverconfig.tpmasterdir, folderName))
	// a symlink is not a file entry, thus is skipped
	const files = (await fs.readdir(folder, { withFileTypes: true }))
		.filter(f => f.isFile() && f.name.endsWith('.png') && f.name.startsWith(prefix + '_'))
		.map(f => f.name)
		.sort()
	const images: EventImage[] = []
	for (const file of files) {
		const data = await fs.readFile(path.join(folder, file))
		if (!isPng(data)) throw 'invalid PNG image'
		images.push({
			label: file.slice(prefix.length + 1, -4).replaceAll('_', ' '),
			src: `data:image/png;base64,${data.toString('base64')}`
		})
	}
	return images
}

function isPng(data: Buffer) {
	try {
		return imageSize(data).type == 'png'
	} catch {
		return false
	}
}
