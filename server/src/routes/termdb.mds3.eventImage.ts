import fs from 'fs/promises'
import path from 'path'
import type {
	EventImage,
	TermdbMds3EventImageRequest,
	TermdbMds3EventImageResponse,
	RouteApi,
	RoutePayload
} from '#types'
import serverconfig from '#src/serverconfig.js'
import { imageSize } from '#src/utils/imageSize.ts'
import { validGenomeDs } from '#routes/common.ts'
import { genomes } from '#src/initGenomesDs.js'

/*
images of sv/fusion events, see ds.queries.svfusion.eventImages{}

an event may carry an image file prefix as its optional "eventImage" value: in the mattr{} of the svfusion
file, which svfusionByRangeGetter_file() attaches to a track event as m.eventImage (or to each of its partner
breakpoints, see mayUpdatePairlst() in mds3.load.js), or on the event in the singleSampleMutation data of a
sample. the images of the event are the png files in eventImages.folder that start with the prefix followed by "_"
*/

export const payload: RoutePayload = {
	// a getter so that the loaded genomes are checked when augen sets up the route, not when this module
	// is evaluated (this module is also imported by mds3.init.js, which is imported by initGenomesDs.js);
	// the route is only set up when at least one ds has ds.queries.svfusion.eventImages
	get init() {
		return hasEventImagesDs(genomes) ? init : null
	},
	request: {
		typeId: 'TermdbMds3EventImageRequest',
		checker: validTermdbMds3EventImageRequest
	},
	response: { typeId: 'TermdbMds3EventImageResponse' }
}

export const api: RouteApi = {
	endpoint: 'termdb/mds3/eventImage',
	methods: {
		get: payload,
		post: payload
	}
}

export function hasEventImagesDs(genomes) {
	return Object.values(genomes).some((g: any) =>
		Object.values(g.datasets || {}).some((ds: any) => ds.queries?.svfusion?.eventImages)
	)
}

export function validTermdbMds3EventImageRequest(input): TermdbMds3EventImageRequest {
	// the prefix is a file name in eventImages.folder, without the "_" and the rest of the name
	const prefix = input.eventImage
	if (typeof prefix != 'string' || !prefix || path.basename(prefix) != prefix || /[\\\0]/.test(prefix))
		throw 'invalid event image prefix'
	return { ...validGenomeDs(input), eventImage: prefix }
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		const q: TermdbMds3EventImageRequest = req.query
		let result
		try {
			const g = genomes[q.genome]
			if (!g) throw 'invalid genome name'
			const ds = g.datasets?.[q.dslabel]
			if (!ds) throw 'invalid dataset name'
			if (!ds.queries?.svfusion?.eventImages) throw 'eventImages not supported on this dataset'
			result = await ds.queries.svfusion.eventImages.get(q)
		} catch (e: any) {
			if (e.stack) console.log(e.stack)
			result = {
				status: e.status || 400,
				error: e.message || e
			}
		}
		res.send(result satisfies TermdbMds3EventImageResponse)
	}
}

/////////////////// ds query validator
// called by validate_query_svfusion() in mds3.init.js
export function validate_query_svfusionEventImages(ds) {
	const q = ds.queries.svfusion.eventImages
	if (!q) return
	if (typeof q.label != 'string' || !q.label.trim()) throw 'svfusion.eventImages.label must be a nonempty string'
	if (typeof q.get == 'function') return // ds-supplied
	if (typeof q.folder != 'string' || !q.folder.trim()) throw 'svfusion.eventImages.folder must be a nonempty string'
	q.get = async (q: TermdbMds3EventImageRequest) => {
		try {
			return { images: await readImages(q.eventImage, ds.queries.svfusion.eventImages.folder) }
		} catch (e: any) {
			if (e.code) {
				console.log(e)
				throw 'unable to read event images'
			}
			throw e
		}
	}
}

// eventImage is validated by validTermdbMds3EventImageRequest()
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
