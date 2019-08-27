import * as common from './common'
import * as client from './client'


/*
********************** EXPORTED
may_render_ld
********************** INTERNAL

*/





export function may_render_ld ( data, tk, block ) {
/*
*/
	if( !tk.ld ) return 0
	if( !data.ld ) return 0

	let rowheightsum = 0

	for(const name in data.ld) {
		const lddata = data.ld[name]

		let rowheight = 0 // height of this tk row

		for(const r of lddata.rglst) {

			tk.gleft_ldrow.append('text')
				.text(name+' LD')
				.attr('x', block.tkleftlabel_xshift)
				.attr('y', data.connheight)
				.attr('text-anchor','end')
				.each(function(){
					tk.leftLabelMaxwidth = Math.max( tk.leftLabelMaxwidth, this.getBBox().width )
				})

			const g = tk.g_ldrow.append('g')
				.attr('transform','translate('+r.xoff+','+rowheightsum+')')

			if( r.rangetoobig ) {
				r.text_rangetoobig = g.append('text')
					.text( r.rangetoobig )
					.attr('text-anchor','middle')
					.attr('dominant-baseline','central')
					.attr('x', r.width/2 )
					// set y after row height is decided
				rowheight = Math.max( rowheight, 50 )
				continue
			}

			if( r.img ) {
				g.append('image')
					.attr('width',  r.width)
					.attr('height', r.imgheight)
					.attr('xlink:href', r.img.src)
				rowheight = Math.max( rowheight, r.img.height )
				continue
			}
		}

		// row height set
		for(const r of lddata.rglst) {
			if(r.rangetoobig) {
				r.text_rangetoobig.attr('y', rowheight/2 )
			}
		}

		rowheightsum += rowheight
	}

	return rowheightsum
}
