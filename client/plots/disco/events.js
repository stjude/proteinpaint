import { tooltip } from './helper'
import { select, selectAll } from 'd3-selection'

export default function DtDiscoEvents(viz, VueApp) {
	const tip = tooltip({ offsetX: 20, offsetY: 20, maxWidth: 300, hideXmute: 4, hideYmute: 4 })
	let activeDonut, activeParent
	let chrLayer

	return {
		mouseClick: () => {
			tip.hide()
			const t = event.target
			const d = event.target.__data__
			const layer = t.parentNode.parentNode.__data__
			let data = t.parentNode.parentNode.parentNode.__data__
			if (!data) data = {}

			if (t.className.baseVal == 'chord-text' && isNaN(d.label) && (!d.layerType || d.layerType != 'chromosome')) {
				//VueApp.$router.go('/proteinpaint/'+d.label);
				if (viz.opts.callbacks) {
					if (typeof viz.opts.callbacks.geneLabelClick == 'function') {
						viz.opts.callbacks.geneLabelClick({
							position: 'chr' + d.d.poslabel
						})
					} else if (typeof viz.opts.callbacks.geneLabelClick == 'object') {
						const c = viz.opts.callbacks.geneLabelClick
						if (c.type == 'genomepaint') {
							const discoHolder = viz.holder
							discoHolder.style('display', 'none')
							const div = select(viz.holder.node().parentNode).append('div')
							const button = div
								.append('button')
								.text('Loading ...')
								.property('disabled', true)
								.style('margin', '5px')
								.style('padding', '3px')
								.on('click', () => {
									div.remove()
									discoHolder.style('display', 'block')
								})
							const holder = div.append('div')
							window.runproteinpaint({
								// replace 'localhost' only when testing in dev machine
								// since ppr will have all the required data for tracks
								host: c.hostURL ? c.hostURL : window.location.hostname == 'localhost' ? 'https://ppr.stjude.org' : '',
								noheader: true,
								holder: holder.node(),
								parseurl: true,
								nobox: 1,
								block: 1,
								genome: c.genome,
								nativetracks: 'refgene',
								positionbygene: d.gene,
								position: d.poslabel ? 'chr' + d.poslabel : undefined,
								datasetqueries: [
									{
										dataset: c.dslabel,
										querykey: viz.opts.querykey ? viz.opts.querykey : 'svcnv',
										singlesample: { name: c.sample },
										getsampletrackquickfix: true
									}
								]
							})

							const i = setInterval(() => {
								if (holder.selectAll('svg > *').size()) {
									clearInterval(i)
									button.property('disabled', false).html('&lt;&lt; Disco plot')
								}
							}, 100)
						}
					}
				}
			} else if (d && d.layerType && d.layerType == 'chromosome') {
				//const s=VueApp.$store.getters.disco;
				//s.clickedChromosome=s.clickedChromosome==d.chromosome?0:d.chromosome;
				//viz.disco.main(s)
			}
			/*else {
				currScale = currScale==1 ? 0.25 : 1
				viz.disco.rescale(currScale)
			}*/
		},
		mouseOver: () => {
			const dxy = tip.hide(event)
			const t = event.target
			const d = t.__data__
			const cls = t.className ? t.className.baseVal : ''
			const pCls = t.parentNode.className ? t.parentNode.className.baseVal : ''
			const layer = t.parentNode.parentNode.__data__
			let data = t.parentNode.parentNode.parentNode.__data__

			if (activeDonut && t.parentNode.parentNode != activeParent) {
				activeDonut.style('fill', 'rgba(100,100,100,0.1)')
			}
			if (chrLayer && dxy < 0) {
				chrLayer.style('fill-opacity', 1)
			}
			selectAll('.chord')
				.transition()
				.duration(200)
				.style('opacity', 1)

			if (!data) data = {}

			if (d && d.data && d.data.segmean) {
				tip.show(
					event,
					'Loss of Heterozygosity' +
						'<br/>' +
						d.data.chr +
						':' +
						d.data.start +
						'-' +
						d.data.stop +
						'<br/>segmean: ' +
						d.data.segmean
				)
			} else if (d && d.gain) {
				tip.show(
					event,
					'Copy Number Variation' +
						'<br/>' +
						d.data.chr +
						':' +
						d.data.start +
						'-' +
						d.data.stop +
						'<br/>log2 ratio: ' +
						d.gain
				)
			} else if (layer && layer.type == 'snv' && d.class) {
				const color = d.signature ? d.signature.color : d.fill ? d.fill : ''
				const cls = d.class in viz.mlabel ? viz.mlabel[d.class].label : d.class
				const position = d.data.position ? d.data.position : d.data.start + '-' + d.data.stop
				const gene = d.gene ? d.gene : d.data.chr + ' ' + position
				const aachange = d.aachange ? ' (' + d.aachange + ')' : d.mname ? ' (' + d.mname + ')' : ''
				const signature = d.signature ? d.signature.name : ''

				if (d.poscls && d.poscls.byGene) {
					let text = ''
					for (const gene in d.poscls.byGene) {
						if (gene && gene != 'undefined') text += gene + ' (' + d.poscls.byGene[gene].length + ')<br/>'
					}
					tip.show(
						event,
						"<span style='color:" +
							color +
							"'>" +
							' ' +
							(signature ? signature : cls) +
							'<br/>' +
							'chr' +
							d.poslabel +
							'<br/>' +
							' ' +
							text +
							'</span>'
					)
				} else {
					tip.show(
						event,
						"<span style='color:" + color + "'>" + ' ' + gene + '<br/>' + ' ' + cls + aachange + '</span>'
					)
				}

				if (chrLayer) {
					chrLayer.style('fill-opacity', c => ('chr' + c.chromosome == d.chromosome ? 0.6 : 1))
				}
			} else if (cls == 'chord') {
				select(t.parentNode)
					.selectAll('.chord')
					.transition()
					.duration(200)
					.style('opacity', function(c) {
						return t == this ? 1 : d.endpts == c.endpts ? 1 : 0.01
					})

				/*if (data.dottexts) {
		     	data.dottexts.forEach(s=>{
			     	s.transition().duration(200)
				      .style('opacity',function (c) {
				        return d.source.genes && d.source.genes.includes(c.label) ? 1 
				        	: d.source.chromosomes.includes(c.chromosome) ? 1
				        	: c.chromosome==d.source.chromosome ? 1
				        	: c.chromosome==d.target.chromosome ? 1
				        	: 0.1
				      })
				      //.style('font-size',c=>{
				      	//return (endLabels.includes(c.label) ? 2 : 1)*settings.fontSize[c.layerNum]+'px'
				      //})
			     })
		     }*/

				const html = layer.tipHtml ? layer.tipHtml(d) : ''
				if (html) {
					tip.show(event, html)
				}
			} else if (cls == 'disco-text') {
				const color = !layer.labelFill
					? '#000'
					: typeof layer.labelFill == 'string'
					? layer.labelFill
					: layer.labelFill(d)
				const html = layer.tipHtml ? layer.tipHtml(d) : ''
				if (html) {
					tip.show(event, html)
				}
			} else if (cls == 'chord-donut' && d.layerType == 'snv') {
				tip.hide(event)
				activeDonut = select(t)
				activeDonut.style('fill', '#fff') //'rgba(255,255,0,0.5)')
				activeParent = t.parentNode.parentNode
			} else if (cls == 'chord-layer-arc' && d.aachange) {
				activeDonut = select(t.parentNode.parentNode).selectAll('.chord-donut')
				activeDonut.style('fill', '#fff') //'rgba(255,255,0,0.5)')
				activeParent = t.parentNode.parentNode
			} else if (!t || pCls != 'group') {
				/*if (layer && data.dotchord) {
		     	data.dotchord.filter(matchedChords)
			      .transition().duration(200)
			      .style('opacity',1)
			  }

			 if (data.dottexts) {
			     data.dottexts.forEach(s=>{
			     	s.transition().duration(200)
				      .style('opacity',1)
				      //.style('font-size',d=>settings.fontSize[d.layerNum]+'px')
				 })
			 }*/
			} else {
				/*if (layer && data.dotchord) {
		    	data.dotchord
			      .transition().duration(200)
			      .style('opacity', function (c){
			        return clicked.includes(this) ? 1
			        	: !clicked.length && c.source.index==d.index ? 1
			        	: !clicked.length && c.target.index==d.index ? 1 
			        	: 0.1
			      })
			}*/
			}
		},
		mouseOut: () => {
			const layer = event.target.parentNode.parentNode.__data__
			let data = event.target.parentNode.parentNode.parentNode.__data__
			if (!data) data = {}

			const dxy = tip.hide(event)
			if (chrLayer && dxy < 0) {
				chrLayer.style('fill-opacity', 1)
			}
			//if (activeDonut) activeDonut.style('fill','rgba(100,100,100,0.1)')
			/*if (layer && data.dotchord) {
			  data.dotchord.filter(matchedChords)
			  	.transition().duration(200)
			  	.style('opacity',1)
		  }

		  if (data.dottexts) {
			  data.dottexts.forEach(s=>{
		     	s.transition().duration(200)
			      .style('opacity',1)
			      //.style('font-size',d=>settings.fontSize[d.layerNum])
		     })
		  }*/
		},

		mouseMove: () => {
			const dxy = tip.getPosChange(event)
			if (chrLayer && dxy < 0) {
				chrLayer.style('fill-opacity', 1)
			}
		},

		setElems() {
			chrLayer = selectAll('.chord-layer-arc').filter(c => {
				return c.layerType == 'chromosome'
			})
		}
	}
}
