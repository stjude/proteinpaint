import * as React from 'react'
import testWrapper from 'pp-react'
import { select } from 'd3-selection'

console.log('test ....')
console.log(5, 'portal/index.js', testWrapper)

export function portalInit(host = 'http://localhost:3000') {
	console.log(9, 'portalInit()', document)
	testWrapper.runproteinpaint({
		host,
		noheader: true,
		holder: select('body')
			.append('div')
			.node(),
		genome: 'hg38',
		//gene:'ENST00000389048',
		//gene:'ENST00000269305',
		gene: 'ENST00000407796', // AKT1
		nobox: true,

		tracks: [
			{
				type: 'mds3',
				dslabel: 'GDC'
				// gdc customizations
				//set_id: 'set_id:DDw3QnUB_tcD1Zw3Af72'
			}
		]
	})
}
