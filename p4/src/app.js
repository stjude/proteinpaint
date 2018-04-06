import {select as d3select} from 'd3-selection'
import 'normalize.css'



window.runproteinpaint = (arg) => {

	const holder = d3select( arg.holder || document.body )

	holder.append('p').text('P4')
}
