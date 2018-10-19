import {event as d3event} from 'd3-selection'
/*
for rnabam ase stuff shared with ase tk
*/




export function rnabamtk_initparam ( c ) {
	/*
	for svcnv, c is tk.checkrnabam
	for ase, c is tk
	*/
	if(!c.hetsnp_minallelecount ) c.hetsnp_minallelecount = 2
	if(!c.rna_minallelecount ) c.rna_minallelecount = 3
	if(!c.hetsnp_minbaf ) c.hetsnp_minbaf = 0.3
	if(!c.hetsnp_maxbaf ) c.hetsnp_maxbaf = 0.7
	if(c.rnapileup_q==undefined ) c.rnapileup_q = 0
	if(!c.rnapileup_Q ) c.rnapileup_Q = 13
	if(!c.binompvaluecutoff) c.binompvaluecutoff=0.05
}




export function configPanel_rnabam ( tk, block, loadTk ) {
	/* parameters for rna bam mode
	*/
	const c = tk.checkrnabam
	if( !c ) return

	const d = tk.tkconfigtip.d.append('div')
		.style('margin-bottom','15px')
	d.append('div')
		.style('opacity',.5)
		.style('font-size','.9em')
		.style('font-weight','bold')
		.text('Finding heterozygous SNPs in DNA')
	{
		const row = d.append('div')
			.style('margin-top','5px')
		row.append('span')
			.html('Minimum allele read count&nbsp;')
		row.append('input')
			.attr('type','number')
			.style('width','50px')
			.property('value', c.hetsnp_minallelecount)
			.on('keyup',()=>{
				if(d3event.code!='Enter' && d3event.code!='NumpadEnter') return
				let v=Number.parseInt(d3event.target.value)
				if(!v || v<=0) return // invalid value
				if( c.hetsnp_minallelecount == v ) {
					// same as current cutoff, do nothing
					return
				}
				c.hetsnp_minallelecount = v
				loadTk(tk, block)
			})
		row.append('div')
			.style('opacity','.5')
			.style('font-size','.8em')
			.text('If both alleles have read count below cutoff, then this SNP will be skipped.')
	}
	{
		const row = d.append('div')
			.style('margin-top','5px')
		row.append('span')
			.html('Heterozygous SNP BAF range&nbsp;&nbsp;')
		row.append('input')
			.attr('type','number')
			.style('width','50px')
			.property('value', c.hetsnp_minbaf)
			.on('keyup',()=>{
				if(d3event.code!='Enter' && d3event.code!='NumpadEnter') return
				let v=Number.parseFloat(d3event.target.value)
				if(!v || v<=0) return // invalid value
				if( c.hetsnp_minbaf == v ) {
					// same as current cutoff, do nothing
					return
				}
				c.hetsnp_minbaf = v
				loadTk(tk, block)
			})
		row.append('span')
			.style('opacity','.5')
			.style('font-size','.8em')
			.html('&nbsp;&leq; BAF &leq;&nbsp;')
		row.append('input')
			.attr('type','number')
			.style('width','50px')
			.property('value', c.hetsnp_maxbaf)
			.on('keyup',()=>{
				if(d3event.code!='Enter' && d3event.code!='NumpadEnter') return
				let v=Number.parseFloat(d3event.target.value)
				if(!v || v<=0) return // invalid value
				if( c.hetsnp_maxbaf == v ) {
					// same as current cutoff, do nothing
					return
				}
				c.hetsnp_maxbaf = v
				loadTk(tk, block)
			})
		row.append('div')
			.style('opacity','.5')
			.style('font-size','.8em')
			.text('If BAF (B-allele fraction) is within this range, the SNP can be considered heterzygous.')
	}

	d.append('div')
		.style('margin','20px 0px 10px 0px')
		.style('opacity',.5)
		.style('font-size','.9em')
		.style('font-weight','bold')
		.text('Counting alleles in RNA-seq BAM file')

	{
		const row = d.append('div')
			.style('margin-top','5px')
		row.append('span')
			.html('Skip alignments with mapQ smaller than&nbsp;')
		row.append('input')
			.attr('type','number')
			.style('width','50px')
			.property('value', c.rnapileup_q)
			.on('keyup',()=>{
				if(d3event.code!='Enter' && d3event.code!='NumpadEnter') return
				let v=Number.parseInt(d3event.target.value)
				if(!v || v<0) return // invalid value
				if( c.rnapileup_q == v ) {
					// same as current cutoff, do nothing
					return
				}
				c.rnapileup_q = v
				loadTk(tk, block)
			})
	}
	{
		const row = d.append('div')
			.style('margin-top','5px')
		row.append('span')
			.html('Skip bases with baseQ/BAQ smaller than&nbsp;')
		row.append('input')
			.attr('type','number')
			.style('width','50px')
			.property('value', c.rnapileup_Q)
			.on('keyup',()=>{
				if(d3event.code!='Enter' && d3event.code!='NumpadEnter') return
				let v=Number.parseInt(d3event.target.value)
				if(!v || v<=0) return // invalid value
				if( c.rnapileup_Q == v ) {
					// same as current cutoff, do nothing
					return
				}
				c.rnapileup_Q = v
				loadTk(tk, block)
			})
	}
}
