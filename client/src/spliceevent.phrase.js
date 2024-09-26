import { exoncolor, IN_frame, OUT_frame, spliceeventchangegmexon } from '#shared/common.js'
import * as client from './client'

export default function (evt) {
	const htmls = []
	if (evt.isaltexon || evt.isskipexon) {
		// sum which exon
		const exonstart = Math.min(...evt.skippedexon)
		const exonstop = Math.max(...evt.skippedexon)

		htmls.push(
			'<div style="display:inline-block">' +
				(exonstart == exonstop ? 'exon ' + (exonstart + 1) : 'exons ' + (exonstart + 1) + '-' + (exonstop + 1)) +
				' ' +
				(evt.isaltexon ? 'alternative usage' : 'skipping') +
				'</div>'
		)

		if (evt.isaltexon) {
			htmls.push(
				'<div class=sja_tinylogo_body>' +
					evt.gmB.isoform +
					', ' +
					evt.gmA.isoform +
					'</div><div class=sja_tinylogo_head>ISOFORMS</div>'
			)
		} else {
			htmls.push('<div class=sja_tinylogo_body>' + evt.gm.isoform + '</div><div class=sja_tinylogo_head>ISOFORM</div>')
		}

		// samples?
		if (evt.junctionB.data) {
			htmls.push(
				'<div class=sja_tinylogo_body>' +
					evt.junctionB.data.length +
					'</div><div class=sja_tinylogo_head>SAMPLE' +
					(evt.junctionB.data.length > 1 ? 'S' : '') +
					'</div>'
			)
		}
		// percentage
		htmls.push('<div class=sja_tinylogo_body>' + evt.percentage + ' %</div><div class=sja_tinylogo_head>PERCENT</div>')
		// frame
		if (evt.framenocheck) {
			if (evt.utr3) {
				htmls.push('<div class=sja_tinylogo_body style="background-color:#ededed">3\' UTR</div>')
			} else if (evt.utr5) {
				htmls.push('<div class=sja_tinylogo_body style="background-color:#ededed">5\' UTR</div>')
			}
		} else if (evt.frame == IN_frame) {
			htmls.push(
				'<div class=sja_tinylogo_body style="background-color:' +
					client.colorinframe +
					';color:white">IN</div><div class=sja_tinylogo_head>FRAME</div>'
			)
		} else if (evt.frame == OUT_frame) {
			htmls.push('<div class=sja_tinylogo_body>OUT</div><div class=sja_tinylogo_head>FRAME</div>')
		} else {
			htmls.push('<div class=sja_tinylogo_body>?</div><div class=sja_tinylogo_head>FRAME</div>')
		}
	} else {
		return 'unknown event type!!'
	}
	return htmls.join(' ')
}
