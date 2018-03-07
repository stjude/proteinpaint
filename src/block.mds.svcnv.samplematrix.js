import * as common from './common'
import * as client from './client'


export function createbutton_addfeature( p ) {
	/*
	create a button for adding feature to samplematrix
	the feature is underlied by m (m.dt for datatype)
	*/

	const {m, tk, block, holder} = p

	if(!m) return

	// generate new feature beforehand
	let nf

	switch(m.dt) {
	case common.dtcnv:
		nf = {
			iscnv: 1,
			label: m.chr+' '+common.bplen(m.stop-m.start)+' CNV',
			querykey: ( tk.iscustom ? common.custommdstktype.svcnvitd : tk.querykey),
			chr: m.chr,
			start: m.start,
			stop: m.stop,
			valuecutoff: tk.valueCutoff,
			focalsizelimit: tk.bplengthUpperLimit,
			colorgain: tk.cnvcolor.gain.str,
			colorloss: tk.cnvcolor.loss.str
		}
		break
	case common.dtloh:
		nf = {
			isloh: 1,
			label: m.chr+' '+common.bplen(m.stop-m.start)+' LOH',
			querykey: ( tk.iscustom ? common.custommdstktype.svcnvitd : tk.querykey),
			chr: m.chr,
			start: m.start,
			stop: m.stop,
			valuecutoff: tk.segmeanValueCutoff,
			focalsizelimit: tk.lohLengthUpperLimit,
			color: tk.cnvcolor.loh.str,
		}
		break
	case common.dtgeneexpression:
		if(!tk.gene2coord) {
			holder.text('tk.gene2coord missing')
			return
		}
		const tmp =  tk.gene2coord[ m.genename ]
		if(!tmp) {
			holder.text('No position for '+m.genename)
			return
		}
		nf = {
			isgenevalue:1,
			querykey: ( tk.iscustom ? common.custommdstktype.geneexpression : tk.checkexpressionrank.querykey ),
			genename: m.genename,
			label: m.genename+' expression',
			chr: tmp.chr,
			start: tmp.start,
			stop: tmp.stop
		}
		break
	case common.dtsnvindel:
		nf = {
			isvcf:1,
			querykey: ( tk.iscustom ? common.custommdstktype.vcf : tk.checkvcf.querykey ),
			label: 'Mutation at '+m.chr+':'+m.pos,
			chr: m.chr,
			start: m.pos,
			stop: m.pos,
		}
		break
	case common.dtitd:
		nf = {
			isitd:1,
			querykey: ( tk.iscustom ? common.custommdstktype.svcnvitd : tk.querykey),
			label: 'ITD at '+m.chr+':'+(m.start+1)+'-'+(m.stop+1),
			chr:m.chr,
			start:m.start,
			stop:m.stop
		}
		break
	case common.dtsv:
	case common.dtfusionrna:
		// TODO hardcoded range +/- 1k
		nf = {
			issvfusion:1,
			querykey: ( tk.iscustom ? common.custommdstktype.svcnvitd : tk.querykey),
			label: 'SV/fusion around '+m._chr+':'+(m._pos+1),
			chr: m._chr,
			start: Math.max(0, m._pos-1000),
			stop: m._pos+1000
		}
		break
	default:
		console.log('createbutton_addfeature: unknown dt')
		return
	}


	const button = holder.append('div')
	.style('display','inline-block')
	.attr('class', 'sja_menuoption')
	.text('Add feature: '+nf.label)
	.on('click',()=>{

		if(p.pane) {
			// close old pane
			p.pane.pane.remove()
		}

		addnewfeature( nf, tk, block )
	})
}



function addnewfeature( nf, tk, block) {
	/*
	if samplematrix instance has already been created, add feature;
	otherwise, create instance with the new feature
	*/
	if(!tk.samplematrix) {

		// create new instance

		const pane = client.newpane({
			x:100,
			y:100, 
			close: ()=>{
				client.flyindi(
					pane.pane,
					tk.config_handle
				)
				pane.pane.style('display','none')
			}
		})
		pane.header.text(tk.name)

		const arg = {
			debugmode: block.debugmode,
			genome: block.genome,
			features: [ nf ],
			hostURL: block.hostURL,
			jwt:block.jwt,
			holder: pane.body.append('div').style('margin','20px'),
		}

		if(tk.iscustom) {

			arg.iscustom = 1
			arg.querykey2tracks = {}
			arg.querykey2tracks[ common.custommdstktype.svcnvitd ] = {
				file: tk.file,
				url: tk.url,
				indexURL: tk.indexURL
			}
			if(tk.checkexpressionrank) {
				arg.querykey2tracks[ common.custommdstktype.geneexpression ] = tk.checkexpressionrank
			}
			if(tk.checkvcf) {
				// hardcoded one single vcf file
				arg.querykey2tracks[ common.custommdstktype.vcf ] = {}
				for(const k in tk.checkvcf) {
					if(k=='stringifiedObj') continue
					arg.querykey2tracks[ common.custommdstktype.vcf ][ k ] = tk.checkvcf[ k ]
				}
			}

		} else {
			// official
			arg.dslabel = tk.mds.label
		}

		import('./samplematrix').then(_=>{
			tk.samplematrix = new _.Samplematrix( arg )
			tk.samplematrix._pane = pane
		})
		return
	}

	// already exists
	if(tk.samplematrix._pane.pane.style('display')=='none') {
		// show first
		tk.samplematrix._pane.pane.style('display','block').style('opacity',1)
	}
	// add new feature
	tk.samplematrix.features.push( nf )

	tk.samplematrix.validate_feature( nf )
	.then(()=>{
		return tk.samplematrix.get_features( [nf] )
	})
	.catch(err=>{
		tk.samplematrix.error( typeof(err)=='string' ? err : err.message )
		if(err.stack) console.log(err.stack)
	})
}




export function may_show_samplematrix_button(tk, block) {
	/*
	if samplematrix is hidden, show button in config menu
	*/
	if(!tk.samplematrix) return
	if(tk.samplematrix._pane.pane.style('display')!='none') {
		// already shown
		return
	}

	const row = tk.tkconfigtip.d.append('div')
		.style('margin-bottom','15px')

	row.append('div')
		.style('display','inline-block')
		.attr('class','sja_menuoption')
		.text('Show sample-by-attribute matrix')
		.on('click',()=>{
			tk.tkconfigtip.hide()
			tk.samplematrix._pane.pane
				.transition()
				.style('display','block')
		})
	row.append('div')
		.style('display','inline-block')
		.attr('class','sja_menuoption')
		.html('&times; delete')
		.on('click',()=>{
			row.remove()
			tk.samplematrix._pane.pane.remove()
			delete tk.samplematrix
		})
}
