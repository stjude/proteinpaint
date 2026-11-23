import { Menu } from '#dom'
import { getOutlierTool } from './sampleView.outliers.ts'
import { getBrainImagingSampleSet } from '../getBrainImagingSampleSet.ts'
import { dofetch3 } from '#common/dofetch'
import {
	renderDiscoFace,
	renderSwimmerFace,
	renderSsgqFace,
	renderBrainImagingFace,
	renderScatterFace,
	renderTrackFace,
	renderSingleCellFace,
	renderWsiFace
} from './sampleView.faces.ts'

/*********************************************************************
 * sampleView tool tiles
 *
 * One tile per tool that can show a sample's data, enabled by the
 * dataset's termdbConfig (.queries, .sampleView, .scatterplots). A tool loads its data once (null: no
 * data), then draws a cover of the tool on the card and, when the tile is
 * expanded, the full tool from the same data (faces: sampleView.faces.ts)
 *********************************************************************/

export type Sample = { sampleId: any; sampleName: string }

export type ToolContext = {
	termdbConfig: any
	vocab: { genome: string; dslabel: string }
	/** client-side genome object */
	genome: any
	app: any
	/** the plot config, for options passed by the plot that opened sample view */
	config: any
	/** registers cleanup of body-mounted elements, run when the drawing is discarded */
	onDestroy: (fn: () => void) => void
	/** the termdb filter of the sample view */
	filter: any
	/** mounts a child plot of sample view (created on first use, then kept alive) into holder; `key`
	 * identifies the child among those of sample view */
	mountChildPlot: (holder: any, key: string, config: any) => Promise<void>
}

type ToolBase = {
	key: string
	title: string
	/** 'sample': drawn for the chosen sample; 'patient': one drawing for all shown samples */
	scope: 'sample' | 'patient'
}

export type SampleTool<T = any> = ToolBase & {
	/** resolves to null when there is no data: the tile is then left out */
	load: (samples: Sample[], ctx: ToolContext) => Promise<T | null>
	/** `active` is the sample chosen in the switcher, one of `samples` for a patient-level tool */
	renderFace: (face: any, data: T, samples: Sample[], ctx: ToolContext, active: Sample) => void | Promise<void>
	renderExpanded: (holder: any, data: T, samples: Sample[], ctx: ToolContext, active: Sample) => void | Promise<void>
}

/** the full swimmer renderer of the lanes shown in an expanded tile, to destroy its body-mounted menus */
const swimmerRenderers = new WeakMap<object, { destroy: () => void }>()
/** destroys the disco app shown in an expanded tile, with its body-mounted menus */
const discoDestroyers = new WeakMap<object, () => void>()
/** width of the swimmer plot besides the lane area: sample names, legend (190px) and paddings */
const SWIMMER_SIDES_W = 440
/** width of the expanded scatter besides its chart: the tools column, axes, margins and a typical legend */
const SCATTER_SIDES_W = 700

/** the tools enabled for a dataset */
export function getSampleTools(termdbConfig: any): SampleTool[] {
	const q = termdbConfig?.queries || {}
	const tools: SampleTool[] = []
	if (q.singleSampleMutation) {
		tools.push({
			key: 'disco',
			title: 'Disco plot',
			scope: 'sample',
			load: async ([sample], ctx) => {
				const { getSingleSampleMutation } = await import('../plot.disco.js')
				try {
					const data = await getSingleSampleMutation(
						ctx.termdbConfig,
						ctx.vocab.dslabel,
						toDiscoSample(sample),
						ctx.genome
					)
					return data.mlst.length ? data : null
				} catch (e) {
					// as before the tiles, a sample without a mutation file is reported as an error by the route
					console.error(e)
					return null
				}
			},
			renderFace: (face, data, [sample], ctx) => renderDiscoFace(face, data, toDiscoSample(sample), ctx),
			renderExpanded: async (holder, data, [sample], ctx) => {
				const { renderDisco } = await import('../plot.disco.js')
				const app = await renderDisco(
					ctx.termdbConfig,
					ctx.vocab.dslabel,
					toDiscoSample(sample),
					data,
					holder,
					ctx.genome
				)
				// one app per drawing: reopening the tile replaces the one of the previous opening
				discoDestroyers.get(data)?.()
				if (!app) return
				let destroyed = false
				const destroy = () => {
					if (destroyed) return
					destroyed = true
					app.destroy()
				}
				discoDestroyers.set(data, destroy)
				ctx.onDestroy(destroy)
			}
		})
	}
	for (const k in q.singleSampleGenomeQuantification || {}) {
		tools.push({
			key: 'ssgq:' + k,
			// MethylationArray → Methylation Array
			title: (k.match(/[A-Z][a-z]+|[0-9]+/g) || [k]).join(' '),
			scope: 'sample',
			load: async ([sample], ctx) => {
				const { getSingleSampleGenomeQuantification } = await import('../plot.ssgq.js')
				try {
					return await getSingleSampleGenomeQuantification(
						ctx.termdbConfig,
						ctx.vocab.dslabel,
						k,
						toSsgqSample(sample),
						ctx.genome
					)
				} catch (e) {
					// as for disco, a sample without a data file is reported as an error by the route
					console.error(e)
					return null
				}
			},
			renderFace: (face, data) => renderSsgqFace(face, data),
			renderExpanded: async (holder, data, [sample], ctx) => {
				const { renderSingleSampleGenomeQuantification } = await import('../plot.ssgq.js')
				await renderSingleSampleGenomeQuantification(
					ctx.termdbConfig,
					ctx.vocab.dslabel,
					k,
					toSsgqSample(sample),
					data,
					holder,
					ctx.genome,
					null // geneName
				)
			}
		})
	}
	if (q.NIdata) {
		// the first template is the default, as the full brainImaging plot offers the others
		const refKey = Object.keys(q.NIdata.references || {})[0]
		if (refKey) {
			tools.push({
				key: 'brainImaging',
				title: 'Brain imaging',
				scope: 'sample',
				load: async ([sample], ctx) => {
					// only the samples with imaging files are drawn
					const available = await getBrainImagingSampleSet(ctx.vocab.genome, ctx.vocab.dslabel, refKey)
					if (!available.has(sample.sampleName)) return null
					// the face is one axial slice; expanding draws the full plot with all three views
					const { getDefaultSlices } = await import('../brainImaging.ts')
					const slice = getDefaultSlices(q.NIdata.references[refKey]).t
					const data = await dofetch3('termdb/brainImaging', {
						body: {
							genome: ctx.vocab.genome,
							dslabel: ctx.vocab.dslabel,
							refKey,
							t: slice,
							selectedSampleFileNames: [sample.sampleName + '.nii']
						}
					})
					// the route sends errors as a plain string
					if (!data || typeof data == 'string' || data.error) throw data?.error || data || 'no brain imaging data'
					const url = (Object.values(data.brainImage || {})[0] as any)?.url
					return url ? { url, slice } : null
				},
				renderFace: (face, data) => renderBrainImagingFace(face, data),
				renderExpanded: async (holder, _data, [sample], ctx) => {
					const brainImaging = await import('../plot.brainImaging.js')
					await brainImaging.default(
						ctx.termdbConfig,
						ctx.vocab.dslabel,
						refKey,
						{ sample_id: sample.sampleName },
						holder,
						ctx.genome
					)
				}
			})
		}
	}
	if (q.swimmer) {
		tools.push({
			key: 'swimmer',
			title: 'Swimmer plot',
			scope: 'patient',
			load: async (samples, ctx) => {
				const { fetchSwimmerLanes } = await import('../swimmer.ts')
				// no user filter: the samples are already chosen; the route still applies access control
				const result = await fetchSwimmerLanes({
					genome: ctx.vocab.genome,
					dslabel: ctx.vocab.dslabel,
					samples: samples.map(s => s.sampleName),
					// set when opened from a swimmer plot, to show the same time reference; unset: the ds default
					timeReference: ctx.config.swimmerTimeReference
				})
				return result.lanes.length ? result : null
			},
			renderFace: (face, data, _samples, ctx, active) => renderSwimmerFace(face, data, ctx, active.sampleName),
			renderExpanded: async (holder, data, _samples, ctx, active) => {
				const { SwimmerRenderer, getDefaultSwimmerSettings } = await import('../swimmer.ts')
				const div = holder.append('div').attr('data-testid', 'sjpp-sampleview-swimmer')
				const renderer = new SwimmerRenderer(ctx.app, {
					plotDiv: div.append('div').style('padding', '10px'),
					noteDiv: div.append('div').style('padding', '0 20px').style('font-size', '.9em').style('opacity', 0.7),
					tip: new Menu({ padding: '5px' })
				})
				// one renderer per drawing: reopening the tile replaces the one of the previous opening
				swimmerRenderers.get(data)?.destroy()
				swimmerRenderers.set(data, renderer)
				ctx.onDestroy(() => renderer.destroy())
				// fit the expanded card: its width less the sample names (about 200px), the legend and paddings
				const settings = getDefaultSwimmerSettings()
				const width = holder.node().clientWidth
				if (width) settings.plotWidth = Math.max(300, Math.min(settings.plotWidth, width - SWIMMER_SIDES_W))
				renderer.update({
					swimmer: ctx.termdbConfig.queries.swimmer,
					settings,
					lanes: data.lanes,
					timeReference: data.timeReference,
					// the chosen sample's linked events (e.g. its CSF collection) stand out
					highlightSample: active.sampleName
				})
			}
		})
	}
	if (q.trackLst?.facets?.length) tools.push(getTrackTool())
	if (q.singleCell) tools.push(getSingleCellTool())
	if (q.w2) tools.push(getWsiTool())
	// genes and gene sets outlying in the sample; termdb.config sets each flag only with its data file
	const outliers = termdbConfig?.sampleView?.outliers
	if (outliers?.ssGSEA) tools.push(getOutlierTool('ssGSEA', 'ssGSEA'))
	if (outliers?.geneExpression) tools.push(getOutlierTool('geneExpression', 'Gene expression'))
	for (const plot of termdbConfig?.scatterplots || []) {
		// per-sample plots (bySample) are named by their sample: added below as one tile for the chosen sample
		if (termdbConfig.scatterplotsBySample) break
		tools.push(getScatterTool(plot))
	}
	if (termdbConfig?.scatterplotsBySample) tools.push(getBySampleScatterTool())
	return tools
}

/** the sample's tracks in the genome browser's track table (queries.trackLst), e.g. its DNA methylation
 * array signal. The face is a static cover; expanded is the genome browser as when launched from the charts,
 * as a child plot of sample view with a fixed, hidden local filter of the sample. Left out when the sample has no track */
function getTrackTool(): SampleTool<{ tracks: any[] }> {
	return {
		key: 'genomeBrowser',
		title: 'Genome browser',
		scope: 'sample',
		load: async ([sample], ctx) => {
			const tracks = (await getFacetTracks(ctx)).filter(t => t.sample == sample.sampleName)
			return tracks.length ? { tracks } : null
		},
		renderFace: (face, data) => renderTrackFace(face, data.tracks),
		renderExpanded: async (holder, _data, [sample], ctx) => {
			const { getSampleFilter } = await import('#mass/groups')
			// as a child plot keyed by the sample, each sample keeps its own browser; its local filter of only the
			// sample is not shown, so the plot cannot be widened beyond it
			return ctx.mountChildPlot(holder, 'genomeBrowser:' + sample.sampleName, {
				chartType: 'genomeBrowser',
				hidePlotFilter: true,
				filter: getSampleFilter(sample.sampleId),
				// the cohort methylation track, of the samples of the filter, does not start on after a gene search
				noDefaultMethylationTrack: true
			})
		}
	}
}

/** the sample's single-cell data (queries.singleCell). The face is a static cover; expanded is the single-cell
 * app opened on the sample, as from the omnisearch "Single cell" button, as a child plot of sample view with a
 * fixed local filter of the sample, so its sample table lists only the sample. Left out when the sample has
 * no single-cell data */
function getSingleCellTool(): SampleTool<{ item: { sID: string; eID?: string } }> {
	return {
		key: 'singleCell',
		title: 'Single cell',
		scope: 'sample',
		load: async ([sample], ctx) => {
			const item = (await getSingleCellItems(ctx)).get(sample.sampleName)
			return item ? { item } : null
		},
		renderFace: face => renderSingleCellFace(face),
		renderExpanded: async (holder, data, [sample], ctx) => {
			const { getSampleFilter } = await import('#mass/groups')
			// as a child plot keyed by the sample, each sample keeps its own app; its local filter of only the
			// sample is not shown
			return ctx.mountChildPlot(holder, 'sc:' + sample.sampleName, {
				chartType: 'sc',
				// no sample table: the app is fixed to the sample
				settings: { sc: { item: data.item, hideItemTable: true } },
				hidePlotFilter: true,
				filter: getSampleFilter(sample.sampleId)
			})
		}
	}
}

/** the single-cell selection of each sample by its name, by app, requested once for all samples */
const singleCellItems = new WeakMap<object, Promise<Map<string, { sID: string; eID?: string }>>>()

/** the selection of the single-cell app ({sID, eID}) by sample name, as the omnisearch makes it
 * (server/src/chat/search.ts getSingleCellSamples()) but matching names exactly: a sample, with its first
 * experiment, and each experiment by its own sample name. Combined results (isMetaResult, e.g. all leukemic
 * cells) are not samples */
function getSingleCellItems(ctx: ToolContext): Promise<Map<string, { sID: string; eID?: string }>> {
	let items = singleCellItems.get(ctx.app)
	if (!items) {
		items = (async () => {
			// no user filter: the samples are already chosen
			const body = { genome: ctx.vocab.genome, dslabel: ctx.vocab.dslabel }
			const data = await dofetch3('termdb/singlecellSamples', { body })
			if (data.error) throw data.error
			return getSingleCellItemMap(data.samples || [])
		})()
		// a failed request is made again for the next sample
		items.catch(() => singleCellItems.delete(ctx.app))
		singleCellItems.set(ctx.app, items)
	}
	return items
}

/** the single-cell app selection by sample name from the termdb/singlecellSamples response, see
 * getSingleCellItems() */
export function getSingleCellItemMap(samples: any[]): Map<string, { sID: string; eID?: string }> {
	const map = new Map<string, { sID: string; eID?: string }>()
	for (const s of samples) {
		if (s.sample == null || s.isMetaResult) continue
		const experiments = Array.isArray(s.experiments) ? s.experiments : []
		const eID = experiments[0]?.experimentID
		map.set(String(s.sample), { sID: String(s.sample), ...(eID ? { eID: String(eID) } : {}) })
		for (const e of experiments) {
			if (e?.sampleName == null) continue
			map.set(String(e.sampleName), {
				sID: String(e.sampleName),
				...(e.experimentID ? { eID: String(e.experimentID) } : {})
			})
		}
	}
	return map
}

/** the sample's plain whole-slide images (queries.w2 wsiFolder; its spatial images are reached through the
 * single-cell tile). The face is the thumbnail of its first slide; expanded is the slide viewer fixed to the
 * sample, as from the omnisearch "Whole Slide Images" button. Left out when the sample has no plain slide */
function getWsiTool(): SampleTool<{ images: { fileName: string; thumbnail: string }[] }> {
	return {
		key: 'wsi',
		title: 'Whole slide images',
		scope: 'sample',
		load: async ([sample], ctx) => {
			if (!(await getWsiSamples(ctx)).has(sample.sampleName)) return null
			const body = { genome: ctx.vocab.genome, dslabel: ctx.vocab.dslabel, sample_id: sample.sampleName }
			const data = await dofetch3('termdb/wsiBySample', { body })
			if (data.error) throw data.error
			const images = (data.images || []).filter(i => i.type == 'wsi')
			return images.length ? { images } : null
		},
		renderFace: (face, data) => renderWsiFace(face, data.images),
		renderExpanded: (holder, _data, [sample], ctx) =>
			// as a child plot keyed by the sample, each sample keeps its own viewer
			ctx.mountChildPlot(holder, 'wsi:' + sample.sampleName, {
				chartType: 'wsi',
				sample: { sID: sample.sampleName },
				imageType: 'wsi'
			})
	}
}

/** the names of the samples with plain whole-slide images, by app, requested once for all samples */
const wsiSamples = new WeakMap<object, Promise<Set<string>>>()

/** the samples with plain whole-slide images on disk, listed by termdb/wsiBySample without a sample */
function getWsiSamples(ctx: ToolContext): Promise<Set<string>> {
	let samples = wsiSamples.get(ctx.app)
	if (!samples) {
		samples = (async () => {
			const body = { genome: ctx.vocab.genome, dslabel: ctx.vocab.dslabel }
			const data = await dofetch3('termdb/wsiBySample', { body })
			if (data.error) throw data.error
			return new Set<string>((data.samples || []).map(s => String(s.sampleId)))
		})()
		// a failed request is made again for the next sample
		samples.catch(() => wsiSamples.delete(ctx.app))
		wsiSamples.set(ctx.app, samples)
	}
	return samples
}

/** the tracks of all facets of queries.trackLst by app, requested once for all samples */
const facetTracks = new WeakMap<object, Promise<any[]>>()

/** the tracks of all facets, as the genome browser requests them for its track table; no user filter, the
 * samples are already chosen */
function getFacetTracks(ctx: ToolContext): Promise<any[]> {
	let tracks = facetTracks.get(ctx.app)
	if (!tracks) {
		tracks = (async () => {
			const vocabApi = ctx.app.vocabApi
			const headers = await vocabApi.mayGetAuthHeaders('termdb')
			const lst = await Promise.all(
				ctx.termdbConfig.queries.trackLst.facets.map(async facet => {
					const body = { genome: ctx.vocab.genome, dslabel: ctx.vocab.dslabel, facetname: facet.name }
					const data = await vocabApi.dofetch3('termdb/facet', { headers, body }, vocabApi.opts.fetchOpts)
					if (data.error) throw data.error
					return data.tracks || []
				})
			)
			return lst.flat()
		})()
		// a failed request is made again for the next sample
		tracks.catch(() => facetTracks.delete(ctx.app))
		facetTracks.set(ctx.app, tracks)
	}
	return tracks
}

/** data of a scatter tile: the plot and its sampleScatter response */
type ScatterTileData = { plot: any; result: any }

/** a prebuilt scatter plot containing any of the shown samples (patient-level): the face is the plot's
 * dots, expanded is the full scatter plot as a child plot
 * of sample view, highlighting the same samples. Plots without any of the samples get no tile */
function getScatterTool(plot: any): SampleTool<ScatterTileData> {
	return {
		key: 'scatter:' + plot.name,
		title: plot.name,
		scope: 'patient',
		load: async (samples, ctx) => {
			const data = await loadScatter(plot, ctx)
			const names = new Set(samples.map(s => s.sampleName))
			return scatterSamples(data.result).some(c => names.has(c.sample)) ? data : null
		},
		renderFace: (face, data) => renderScatterFace(face, data.result),
		renderExpanded: async (holder, data, samples, ctx, active) =>
			ctx.mountChildPlot(holder, 'scatter:' + plot.name, {
				...(await getScatterChildConfig(data.plot, holder)),
				highlightSamples: samples.map(s => s.sampleName),
				emphasizedSample: active.sampleName
			})
	}
}

/** a per-sample (bySample) plot: one plot per sample, named by it, where the sample is the only cohort
 * dot among a reference cloud. One tile for the chosen sample, left out when it has no plot */
function getBySampleScatterTool(): SampleTool<ScatterTileData> {
	return {
		key: 'scatter:bySample',
		title: 'Sample scatter',
		scope: 'sample',
		load: async ([sample], ctx) => {
			const plot = ctx.termdbConfig.scatterplots.find(p => p.name == sample.sampleName)
			return plot ? await loadScatter(plot, ctx) : null
		},
		renderFace: (face, data) => renderScatterFace(face, data.result),
		renderExpanded: async (holder, data, [sample], ctx) =>
			// the plot labels its own sample; as a child plot keyed by the sample, each sample keeps its own
			ctx.mountChildPlot(
				holder,
				'scatter:bySample:' + sample.sampleName,
				await getScatterChildConfig(data.plot, holder)
			)
	}
}

async function loadScatter(plot: any, ctx: ToolContext): Promise<ScatterTileData> {
	const config = await getScatterChildConfig(plot)
	// as in the scatter getPlotConfig(): a ds term wrapper such as { id } is filled before requesting data
	const { fillTermWrapper } = await import('#termsetting')
	if (config.colorTW) await fillTermWrapper(config.colorTW, ctx.app.vocabApi)
	if (config.shapeTW) await fillTermWrapper(config.shapeTW, ctx.app.vocabApi)
	const result = await ctx.app.vocabApi.getScatterData({
		name: plot.name,
		colorTW: config.colorTW,
		colorColumn: config.colorColumn,
		shapeTW: config.shapeTW,
		filter: ctx.filter,
		chartType: 'sampleScatter'
	})
	if ('error' in result || !result.result) throw result.error || 'No scatter data received'
	return { plot, result: result.result }
}

/** the dots of all charts of a sampleScatter response */
function scatterSamples(result: any): any[] {
	return Object.values(result).flatMap((chart: any) => chart.samples || [])
}

/** sampleScatter config of a prebuilt plot as a child plot of sample view, which has no filter of its own.
 * Given the holder of an expanded tile, the chart is sized to about fit it: its width less the tools, axes and
 * a typical legend. A wider legend or the opened settings make the tile scroll sideways */
async function getScatterChildConfig(plot: any, holder?: any) {
	const { getScatterPlotConfig } = await import('../scatter/scatter.ts')
	const config: any = { ...getScatterPlotConfig(plot), hidePlotFilter: true }
	const width = holder?.node().clientWidth
	if (width) {
		const size = Math.round(Math.max(300, Math.min(600, width - SCATTER_SIDES_W)))
		config.settings = {
			...config.settings,
			sampleScatter: { ...config.settings?.sampleScatter, svgw: size, svgh: size }
		}
	}
	return config
}

/** the sample argument of plot.ssgq.js */
function toSsgqSample(sample: Sample) {
	return { sample_id: sample.sampleName }
}

/** the sample argument of plot.disco.js */
function toDiscoSample(sample: Sample) {
	return { sample_id: sample.sampleName }
}
