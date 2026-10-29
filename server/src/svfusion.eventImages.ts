import fs from 'fs/promises'
import path from 'path'
import type { SvFusionEventImagesArg, SvFusionEventImagesResult, EventImageGroup } from '#types'
import serverconfig from './serverconfig.js'
import { validateRglst } from './utils.js'
import { imageSize } from './utils/imageSize.ts'
import { isPartnerBreakpointInRange } from './svfusion.breakpoint.ts'
import { dtfusionrna, dtsv } from '#shared/common.js'

/*
images of sv/fusion events, see ds.queries.svfusion.eventImages{}

each sample of an event may carry an image file prefix in its mattr{}, under the key of eventImages.attrKey.
the images of the event are the png files in eventImages.folder that start with the prefix followed by "_"

the getter is called by load_driver() in mds3.load.js for termdb/mds3 requests with q.eventImages{},
after the track filters of the request are validated. the event is re-queried on both listing and loading,
so that only images of samples passing the filters can be loaded, using each sample's own breakpoint pair
*/

// called by validate_query_svfusion() in mds3.init.js, after svfusion.byrange.get() is added
export function validate_query_svfusionEventImages(ds, genome) {
	const q = ds.queries.svfusion.eventImages
	if (!q) return
	if (typeof q.label != 'string' || !q.label.trim()) throw 'svfusion.eventImages.label must be a nonempty string'
	if (typeof q.get == 'function') return // ds-supplied
	if (!ds.queries.svfusion.byrange) throw 'svfusion.eventImages requires svfusion.byrange'
	for (const key of ['folder', 'attrKey']) {
		if (typeof q[key] != 'string' || !q[key].trim()) throw `svfusion.eventImages.${key} must be a nonempty string`
	}
	q.get = q => getEventImages(q, ds, genome)
}

/* q{} is the termdb/mds3 request, with track filters, and q.eventImages{} to identify the event
lists the images of the event, or loads one listed image when q.eventImages.file is given */
async function getEventImages(q, ds, genome): Promise<SvFusionEventImagesResult> {
	const arg = validArg(q.eventImages)
	const prefixes = arg.pair ? await prefixesByPair(q, arg, ds, genome) : await prefixesByEvent(q, arg, ds, genome)
	try {
		return await readImages(arg, prefixes, ds.queries.svfusion.eventImages.folder)
	} catch (e: any) {
		if (e.code) {
			console.log(e)
			throw 'unable to read event images'
		}
		throw e
	}
}

function validArg(arg): SvFusionEventImagesArg {
	if (!arg || typeof arg != 'object') throw 'eventImages{} not object'
	if (arg.file !== undefined && (typeof arg.file != 'string' || path.basename(arg.file) != arg.file))
		throw 'invalid image identifier'
	const p = arg.pair
	if (p !== undefined) {
		if (
			!p ||
			typeof p != 'object' ||
			typeof p.sample != 'string' ||
			!p.sample ||
			(p.dt !== dtfusionrna && p.dt !== dtsv) ||
			(p.strandA !== undefined && p.strandA !== '+' && p.strandA !== '-') ||
			(p.strandB !== undefined && p.strandB !== '+' && p.strandB !== '-') ||
			typeof p.chrA != 'string' ||
			typeof p.chrB != 'string' ||
			!Number.isSafeInteger(p.posA) ||
			!Number.isSafeInteger(p.posB) ||
			p.posA < 0 ||
			p.posB < 0
		)
			throw 'invalid breakpoint pair'
		return arg
	}
	if (typeof arg.ssm_id != 'string' || !arg.ssm_id) throw 'missing event identifier'
	if (typeof arg.chr != 'string' || !Number.isSafeInteger(arg.pos) || arg.pos < 0) throw 'invalid event position'
	const r = arg.range
	if (
		r != null &&
		(typeof r != 'object' ||
			typeof r.chr != 'string' ||
			!Number.isSafeInteger(r.start) ||
			!Number.isSafeInteger(r.stop) ||
			r.start < 0 ||
			r.stop < r.start)
	)
		throw 'invalid breakpoint range'
	return arg
}

async function readImages(
	arg: SvFusionEventImagesArg,
	prefixes: Map<string, string>,
	folderName: string
): Promise<SvFusionEventImagesResult> {
	const groupsByLabel = new Map<string, EventImageGroup>()
	let folder: string | undefined
	if (prefixes.size) {
		folder = await fs.realpath(path.resolve(serverconfig.tpmasterdir, folderName))
		const files = (await fs.readdir(folder, { withFileTypes: true }))
			.filter(f => f.isFile() && f.name.endsWith('.png'))
			.map(f => f.name)
			.sort()
		for (const [prefix, label] of prefixes) {
			const images = files
				.filter(file => file.startsWith(prefix + '_'))
				.map(file => ({ file, label: file.slice(prefix.length + 1, -4).replaceAll('_', ' ') }))
			if (!images.length) continue
			const group = groupsByLabel.get(label)
			if (group) {
				for (const image of images) {
					if (!group.images.some(i => i.file == image.file)) group.images.push(image)
				}
			} else groupsByLabel.set(label, { label, images })
		}
	}
	const groups = [...groupsByLabel.values()]
	if (arg.file === undefined) return { groups }
	if (!folder || !groups.some(g => g.images.some(i => i.file == arg.file)))
		throw 'image is not available for this event'
	const file = await fs.realpath(path.join(folder, arg.file))
	if (path.dirname(file) != folder) throw 'invalid image identifier'
	const data = await fs.readFile(file)
	if (imageSize(data).type != 'png') throw 'invalid PNG image'
	return { src: `data:image/png;base64,${data.toString('base64')}` }
}

async function querySamples(q, ds, genome, rglst) {
	const query = { ...q, rglst, addFormatValues: true }
	validateRglst(query, genome)
	return await ds.queries.svfusion.byrange.get(query)
}

async function prefixesByEvent(q, arg: SvFusionEventImagesArg, ds, genome) {
	const events = await querySamples(q, ds, genome, [{ chr: arg.chr, start: arg.pos, stop: arg.pos! + 1 }])
	const event = events.find(m => m.ssm_id == arg.ssm_id)
	const prefixes = new Map<string, string>()
	if (!event) return prefixes
	for (const sample of event.samples || []) {
		const pair = sample._pairlst?.[0]
		if (!pair) continue
		if (arg.range && !isPartnerBreakpointInRange({ pairlst: sample._pairlst, pairlstIdx: event.pairlstIdx }, arg.range))
			continue
		addPrefix(prefixes, sample, pair, ds)
	}
	return prefixes
}

async function prefixesByPair(q, arg: SvFusionEventImagesArg, ds, genome) {
	const p = arg.pair!
	const prefixes = new Map<string, string>()
	// the getter converts each sample name with sampleName2id(), so an unknown name matches no event
	const sampleId = ds.cohort?.termdb?.q?.sampleName2id?.(p.sample)
	if (sampleId === undefined) return prefixes
	// either breakend record may carry the attribute, so query both
	for (const [chr, pos] of [
		[p.chrA, p.posA],
		[p.chrB, p.posB]
	] as const) {
		const events = await querySamples(q, ds, genome, [{ chr, start: pos, stop: pos + 1 }])
		for (const event of events) {
			if (event.dt !== p.dt) continue
			for (const sample of event.samples || []) {
				if (sample.sample_id !== sampleId) continue
				const pair = sample._pairlst?.[0]
				if (
					pair?.a?.chr == p.chrA &&
					pair.a.pos == p.posA &&
					pair.a.strand === p.strandA &&
					pair.b?.chr == p.chrB &&
					pair.b.pos == p.posB &&
					pair.b.strand === p.strandB
				)
					addPrefix(prefixes, sample, pair, ds)
			}
		}
	}
	return prefixes
}

function addPrefix(prefixes: Map<string, string>, sample, pair, ds) {
	const prefix = sample.formatK2v?.[ds.queries.svfusion.eventImages.attrKey]
	if (prefix == null || prefix === '') return
	if (typeof prefix != 'string' || path.basename(prefix) != prefix || /[\\\0]/.test(prefix))
		throw 'invalid event image prefix'
	prefixes.set(prefix, `${breakendLabel(pair.a)} - ${breakendLabel(pair.b)}`)
}

function breakendLabel(p) {
	return `${p.name || p.chr} ${p.chr}:${p.pos + 1}${p.strand || ''}`
}
