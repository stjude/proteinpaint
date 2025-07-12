import * as d3 from 'd3'
import FullArcRenderer from '#plots/disco/arc/FullArcRenderer.ts'
import type Fusion from './Fusion.ts'
import MenuProvider from '#plots/disco/menu/MenuProvider.ts'
import FusionColorProvider from '#plots/disco/fusion/FusionColorProvider.ts'
import { table2col } from '#dom/table2col'
import { dofetch3 } from '#common/dofetch'

// dynamically load svgraph when user clicks on a fusion arc
type Genome = any

export default class FusionRenderer {
	private genome: Genome

	constructor(genome: Genome) {
		this.genome = genome
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
		let pinned = false

		// Override menu.hide() to unset pinned
		const originalHide = menu.hide.bind(menu)
		menu.hide = () => {
			pinned = false
			return originalHide()
		}

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
			.on('mouseover', (mouseEvent: MouseEvent, fusion: Fusion) => {
				if (pinned) return
				const table = table2col({ holder: menu.d })
				this.createTooltip(table, fusion)
				menu.show(mouseEvent.x, mouseEvent.y)
			})
			.on('click', async (mouseEvent: MouseEvent, fusion: Fusion) => {
				pinned = true
				menu.clear()
				const div = menu.d.append('div')
				menu.show(mouseEvent.x, mouseEvent.y)
				await makeSvgraph(fusion, div, this.genome)
			})
			.on('mouseout', () => {
				if (!pinned) {
					menu.clear()
					menu.hide()
				}
			})
	}

	createTooltip(table: any, fusion: Fusion) {
		{
			const [td1, td2] = table.addRow()
			td1.text('Data type')
			td2.append('span').style('margin-left', '5px').text('Fusion transcript')
		}
		{
			const positionInChromosomeSource = fusion.source.positionInChromosome
			const positionInChromosomeTarget = fusion.target.positionInChromosome

			const [td1, td2] = table.addRow()
			td1.text('Position')
			td2
				.append('span')
				.style('margin-left', '5px')
				.text(
					` ${fusion.source.gene || ''} ${positionInChromosomeSource.chromosome}:${
						positionInChromosomeSource.position
					} ${fusion.source.strand === '+' ? 'forward' : 'reverse'} > ` +
					` ${fusion.target.gene || ''} ${positionInChromosomeTarget.chromosome}:${
						positionInChromosomeTarget.position
					} ${fusion.target.strand === '+' ? 'forward' : 'reverse'} `
				)
		}
	}
}

async function makeSvgraph(fusion: Fusion, div: any, genome: Genome) {
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

	await getGm(svpair.a, { genome: { name: genome.name } }, fusion.source.gene)
	await getGm(svpair.b, { genome: { name: genome.name } }, fusion.target.gene)

	wait.remove()

	const _ = await import('#src/svgraph')
	_.default({
		pairlst: [svpair],
		genome,
		holder: div
	})
}

async function getGm(p: any, block: any, name: string) {
	const d = await dofetch3('isoformbycoord', {
		body: { genome: block.genome.name, chr: p.chr, pos: p.position }
	})
	if (d.error) throw d.error
	const u = d.lst.find((i: any) => i.isdefault && name === i.name) || d.lst[0]
	if (u) {
		p.name = u.name
		p.gm = { isoform: u.isoform }
	}
}
