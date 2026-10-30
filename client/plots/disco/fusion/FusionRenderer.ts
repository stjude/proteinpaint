import * as d3 from 'd3'
import FullArcRenderer from '#plots/disco/arc/FullArcRenderer.ts'
import type Fusion from './Fusion.ts'
import MenuProvider from '#plots/disco/menu/MenuProvider.ts'
import FusionColorProvider from '#plots/disco/fusion/FusionColorProvider.ts'
import { table2col } from '#dom/table2col'
import { dofetch3 } from '#common/dofetch'
import { renderEventImages } from '#dom/eventImages'
import type { ClientGenome } from '../../../types/clientGenome.ts'

export type FusionContext = {
	dslabel?: string
	eventImages?: { label: string }
}

export default class FusionRenderer {
	private genome: ClientGenome
	private context: FusionContext

	constructor(genome: ClientGenome, context: FusionContext = {}) {
		this.genome = genome
		this.context = context
	}

	render(holder: any, fusions: Array<Fusion>, opacity = 1) {
		let radius = 0
		const fusionsWithTarget = fusions.filter(f => f.target)
		if (fusionsWithTarget.length > 0) {
			radius = fusionsWithTarget[0].target.radius
			const fullArcRenderer = new FullArcRenderer(radius, 2, '#6464641A')
			fullArcRenderer.render(holder)
		} else return

		const ribbon = d3.ribbon().radius(radius)
		const ribbons = holder.selectAll('.chord').data(fusions)

		const menu = MenuProvider.create()
		const createTooltip = this.createTooltip.bind(this)
		const showEvents = this.showEvents.bind(this)

		ribbons
			.enter()
			.append('path')
			.attr('class', 'chord')
			.attr('d', ribbon)
			.attr('fill', (fusion: Fusion) => {
				return FusionColorProvider.getColor(
					fusion.source.positionInChromosome.chromosome,
					fusion.target.positionInChromosome.chromosome
				)
			})
			.style('opacity', opacity)
			.each(function (this: any, d: Fusion) {
				const path = d3.select(this)
				// Keep the clicked graph open independently of hover tooltips.
				const tip = MenuProvider.create()

				path.on('click', function (event: MouseEvent) {
					menu.clear().hide()
					tip.clear().show(event.x, event.y)
					showEvents(tip.d.append('div'), getOverlappingFusions(fusions, d))
				})
			})
			.on('mouseover', function (mouseEvent: MouseEvent, fusion: Fusion) {
				const table = table2col({ holder: menu.d })
				createTooltip(table, getOverlappingFusions(fusions, fusion))
				menu.show(mouseEvent.x, mouseEvent.y)
			})
			.on('mouseout', () => {
				menu.clear()
				menu.hide()
			})
	}

	createTooltip(table: any, events: Fusion[]) {
		{
			const [td1, td2] = table.addRow()
			td1.text('Data type')
			td2.append('span').style('margin-left', '5px').text('Fusion transcript')
		}
		for (const fusion of events) {
			const [td1, td2] = table.addRow()
			td1.text('Position')
			td2.append('span').style('margin-left', '5px').text(fusionText(fusion))
		}
	}

	showEvents(holder: any, events: Fusion[]) {
		if (events.length == 1) return this.showEvent(holder, events[0])
		holder.selectAll('*').remove()
		holder
			.append('div')
			.style('padding', '5px')
			.style('font-size', '0.85em')
			.style('opacity', 0.7)
			.text(`${events.length} fusion events, select one:`)
		for (const fusion of events) {
			holder
				.append('div')
				.attr('class', 'sja_menuoption')
				.attr('data-testid', 'sjpp-disco-fusion-option')
				.text(fusionText(fusion))
				.on('click', () => this.showEvent(holder, fusion, () => this.showEvents(holder, events)))
		}
	}

	async showEvent(holder: any, fusion: Fusion, back?: () => void) {
		holder.selectAll('*').remove()
		if (back) {
			holder
				.append('div')
				.attr('class', 'sja_menuoption')
				.style('display', 'inline-block')
				.text('« All events')
				.on('click', back)
		}
		holder.append('div').style('padding', '5px').text(fusionText(fusion))
		const graph = holder.append('div')
		if (this.context.eventImages && this.context.dslabel && fusion.eventImageValue) {
			const section = holder.append('div').attr('data-testid', 'sjpp-disco-event-images').style('margin', '10px 5px')
			section.append('div').style('font-weight', 'bold').text(this.context.eventImages!.label)
			// not awaited, so that the fusion graph is rendered without waiting for the image list
			this.showEventImages(section, fusion)
		}
		try {
			await makeSvgraph(fusion, graph, this.genome)
		} catch (e: any) {
			graph.text('Error: ' + (e.message || e))
		}
	}

	private async showEventImages(section: any, fusion: Fusion) {
		const content = section.append('div').text('Loading...')
		try {
			const body = { genome: this.genome.name, dslabel: this.context.dslabel, eventImage: fusion.eventImageValue }
			const data = await dofetch3('termdb/mds3', { body })
			if (data.error) throw data.error
			const images = data.eventImages?.images
			if (!Array.isArray(images)) throw 'images[] not array from return'
			if (!images.length) return section.remove()
			renderEventImages(content, images)
		} catch (e: any) {
			content.text('Error: ' + (e.message || e))
		}
	}
}

function fusionText(fusion: Fusion) {
	return `${sideText(fusion.source)} > ${sideText(fusion.target)}`
}

function sideText(side: Fusion['source']) {
	const p = side.positionInChromosome
	return `${side.gene || ''} ${p.chromosome}:${p.position} ${side.strand === '+' ? 'forward' : 'reverse'}`
}

/** fusions drawn on top of the given one, i.e. both ribbon ends overlap in either orientation */
export function getOverlappingFusions(fusions: Fusion[], fusion: Fusion) {
	if (!fusion.target) return [fusion]
	const overlaps = (x, y) => x.startAngle < y.endAngle && y.startAngle < x.endAngle
	return fusions.filter(
		f =>
			f == fusion ||
			(f.target &&
				((overlaps(f.source, fusion.source) && overlaps(f.target, fusion.target)) ||
					(overlaps(f.source, fusion.target) && overlaps(f.target, fusion.source))))
	)
}

async function makeSvgraph(fusion: Fusion, div: any, genome: ClientGenome) {
	const wait = div.append('div').text('Loading...')
	const svpair = {
		a: {
			chr: fusion.source.positionInChromosome.chromosome,
			position: fusion.source.positionInChromosome.position,
			strand: fusion.source.strand
		},
		b: {
			chr: fusion.target.positionInChromosome.chromosome,
			position: fusion.target.positionInChromosome.position,
			strand: fusion.target.strand
		}
	}

	await getGm(svpair.a, genome.name, fusion.source.gene)
	await getGm(svpair.b, genome.name, fusion.target.gene)

	wait.remove()

	const _ = await import('#src/svgraph')
	_.default({
		pairlst: [svpair],
		genome,
		holder: div
	})
}

async function getGm(p: any, genome: string, name: string) {
	const d = await dofetch3('isoformbycoord', {
		body: { genome, chr: p.chr, pos: p.position }
	})
	if (d.error) throw d.error
	const u = d.lst.find((i: any) => i.isdefault && name === i.name) || d.lst[0]
	if (u) {
		p.name = u.name
		p.gm = { isoform: u.isoform }
	}
}
