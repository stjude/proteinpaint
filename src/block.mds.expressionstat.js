import * as client from './client'
import {event as d3event} from 'd3-selection'


/*
Yu's ase & outlier method and data
works for both native and custom track

common code shared by business modules

*/


export function init_config(cfg) {
	/*
	same config applied to both native and custom track

	the isgenenumeric query from a mds may not have such config
	and surely for a custom track submitted with file-only
	*/

	if(!cfg.datatype) cfg.datatype='FPKM'
	if(!cfg.itemcolor) cfg.itemcolor='green' // boxplot and outlier colors

	// ase and outlier part may be optional!!

	if(!cfg.ase) cfg.ase={}
	if(cfg.ase.qvalue==undefined) cfg.ase.qvalue=0.05
	if(cfg.ase.meandelta_monoallelic==undefined) cfg.ase.meandelta_monoallelic=0.3
	if(cfg.ase.asemarkernumber_biallelic==undefined) cfg.ase.asemarkernumber_biallelic=0
	//if(cfg.ase.meandelta_biallelic==undefined) cfg.ase.meandelta_biallelic=0.1
	if(!cfg.ase.color_noinfo) cfg.ase.color_noinfo='#858585'
	if(!cfg.ase.color_uncertain) cfg.ase.color_uncertain='#A8E0B5'
	if(!cfg.ase.color_biallelic) cfg.ase.color_biallelic='#40859C'
	if(!cfg.ase.color_monoallelic) cfg.ase.color_monoallelic='#d95f02'

	if(!cfg.outlier) cfg.outlier={}
	if(cfg.outlier.pvalue_cutoff==undefined) cfg.outlier.pvalue_cutoff=0.05
	if(cfg.outlier.rank_asehigh_cutoff==undefined) cfg.outlier.rank_asehigh_cutoff=0.1 // rank within 10% of the cohort
	if(!cfg.outlier.color_outlier) cfg.outlier.color_outlier='#FF8875'
	if(!cfg.outlier.color_outlier_asehigh) cfg.outlier.color_outlier_asehigh='blue'
}



export function measure(v, cfg) {
	/*
	liuyu's data & strategy for ase and outlier expression

	v: a json object loaded from gene expression track
	cfg: gene expression track config object

	the configs are only initiated by this track
	what happens if the expression boxplot is loaded not from svcnv track?
	must safeguard against missing configs
	*/
	if(!cfg) return
	v.estat={}

	if(v.ase && cfg.ase) {
		if(v.ase.qvalue <= cfg.ase.qvalue) {
			if(v.ase.mean_delta >= cfg.ase.meandelta_monoallelic) {
				v.estat.ase_monoallelic=true
			} else {
				v.estat.ase_uncertain=true
			}
		} else {
			if(v.ase.ase_markers == cfg.ase.asemarkernumber_biallelic) {
				// no longer post a min cutoff for mean_delta
				// v.ase.mean_delta <= cfg.ase.meandelta_biallelic
				v.estat.ase_biallelic=true
			} else {
				v.estat.ase_uncertain=true
			}
		}
	} else {
		v.estat.ase_noinfo=true
	}

	if(v.outlier && cfg.outlier) {
		/*
		old logic, no ase_high category
		if(v.outlier.test_whitelist && v.outlier.test_whitelist.pvalue<=cfg.outlier.pvalue) {
			v.estat.outlier=true
		} else if(v.outlier.test_biallelic && v.outlier.test_biallelic.pvalue<=cfg.outlier.pvalue) {
			v.estat.outlier=true
		} else if(v.outlier.test_entirecohort && v.outlier.test_entirecohort.pvalue<=cfg.outlier.pvalue) {
			v.estat.outlier=true
		}
		*/

		if(v.outlier.test_whitelist) {
			if(v.outlier.test_whitelist.pvalue <= cfg.outlier.pvalue_cutoff) {
				v.estat.outlier=true
			} else {
				// not significant pvalue
				if(v.estat.ase_monoallelic) {
					// is mono, then check rank in this group to decide ase_high
					if(Number.isInteger(v.outlier.test_whitelist.rank) &&
						Number.isInteger(v.outlier.test_whitelist.size) &&
						(v.outlier.test_whitelist.rank / v.outlier.test_whitelist.size <= cfg.outlier.rank_asehigh_cutoff)) {

						v.estat.outlier_asehigh=true
						v.outlier.test_whitelist.asehigh = true
					}
				}
			}
		} else if(v.outlier.test_biallelic) {
			if(v.outlier.test_biallelic.pvalue <= cfg.outlier.pvalue_cutoff) {
				v.estat.outlier=true
			} else {
				// not significant pvalue
				if(v.estat.ase_monoallelic) {
					// is mono, then check rank in this group to decide ase_high
					if(Number.isInteger(v.outlier.test_biallelic.rank) &&
						Number.isInteger(v.outlier.test_biallelic.size) &&
						(v.outlier.test_biallelic.rank / v.outlier.test_biallelic.size <= cfg.outlier.rank_asehigh_cutoff)) {

						v.estat.outlier_asehigh=true
						v.outlier.test_biallelic.asehigh=true
					}
				}
			}
		} else if(v.outlier.test_entirecohort) {
			if(v.outlier.test_entirecohort.pvalue <= cfg.outlier.pvalue_cutoff) {
				v.estat.outlier=true
			} else {
				// not significant pvalue
				if(v.estat.ase_monoallelic) {
					// is mono, then check rank in whilelist to decide ase_high
					if(Number.isInteger(v.outlier.test_entirecohort.rank) &&
						Number.isInteger(v.outlier.test_entirecohort.size) &&
						(v.outlier.test_entirecohort.rank / v.outlier.test_entirecohort.size <= cfg.outlier.rank_asehigh_cutoff)) {

						v.estat.outlier_asehigh=true
						v.outlier.test_entirecohort.asehigh=true
					}
				}
			}
		}
	}
}




export function showsingleitem_table(v, cfg, table) {
	// in mouseover tootip
	// add to the table made by make_table_2col

	if(!v.estat) return

	if(v.ase) {
		const tr=table.append('tr')
		tr.append('td')
			.attr('colspan',2)
			.style('background', ase_color(v, cfg) )
			.style('color','white')
			.html( (v.estat.ase_monoallelic ? 'Mono-allelic' : ( v.estat.ase_biallelic ? 'Bi-allelic' : 'ASE uncertain') )
				+'<br>(allele-specific expression)'
			)

		const lst=[]
		for(const k in v.ase) {
			lst.push({k:k, v:v.ase[k]})
		}
		const td=tr.append('td')
		client.make_table_2col(td, lst)

	} else {

		const tr=table.append('tr')
		tr.append('td')
			.attr('colspan',3)
			.style('background', cfg.ase.color_noinfo)
			.style('color','white')
			.text('No info on allele-specific expression')
	}

	if(v.outlier) {
		if(v.outlier.test_whitelist) {
			const tr=table.append('tr')
			tr.append('td')
				.attr('colspan',2)
				.text('Outlier (white list)')
			const lst=[]
			for(const k in v.outlier.test_whitelist) {
				lst.push({k:k, v:v.outlier.test_whitelist[k]})
			}

			const td=tr.append('td')
			client.make_table_2col(td, lst)

			if(v.outlier.test_whitelist.asehigh) {
				td.append('div')
					.style('background', cfg.outlier.color_outlier_asehigh)
					.style('padding','2px 10px')
					.style('color','white')
					.text('ASE high')
			}
		}
		if(v.outlier.test_biallelic) {
			const tr=table.append('tr')
			tr.append('td')
				.attr('colspan',2)
				.text('Outlier (biallelic)')
			const lst=[]
			for(const k in v.outlier.test_biallelic) {
				lst.push({k:k, v:v.outlier.test_biallelic[k]})
			}
			const td=tr.append('td')
			client.make_table_2col(td, lst)

			if(v.outlier.test_biallelic.asehigh) {
				td.append('div')
					.style('background', cfg.outlier.color_outlier_asehigh)
					.style('padding','2px 10px')
					.style('color','white')
					.text('ASE high')
			}
		}
		if(v.outlier.test_entirecohort) {
			const tr=table.append('tr')
			tr.append('td')
				.attr('colspan',2)
				.text('Outlier (all samples)')
			const lst=[]
			for(const k in v.outlier.test_entirecohort) {
				lst.push({k:k, v:v.outlier.test_entirecohort[k]})
			}
			const td=tr.append('td')
			client.make_table_2col(td, lst)

			if(v.outlier.test_entirecohort.asehigh) {
				td.append('div')
					.style('background', cfg.outlier.color_outlier_asehigh)
					.style('padding','2px 10px')
					.style('color','white')
					.text('ASE high')
			}
		}
	}
}



export function ase_color(v, cfg) {
	if(!v.estat) return cfg.ase.color_noinfo
	if(v.estat.ase_monoallelic) return cfg.ase.color_monoallelic
	if(v.estat.ase_biallelic) return cfg.ase.color_biallelic
	if(v.estat.ase_uncertain) return cfg.ase.color_uncertain
	return cfg.ase.color_noinfo
}




export function ui_config(holder, cfg, call) {
	// ase
	const indent=30
	{
		const row=holder.append('div')
			.style('margin-bottom','5px')
		row.append('span').html('If Q-VALUE &le;&nbsp;')
		row.append('input')
			.attr('type','number')
			.style('width','50px')
			.property('value', cfg.ase.qvalue)
			.on('keyup',()=>{
				if(d3event.code!='Enter' && d3event.code!='NumpadEnter') return
				let v=Number.parseFloat(d3event.target.value)
				if(!v || v<=0) {
					// invalid value
					return
				}
				if(cfg.ase.qvalue==v) {
					// same as current value
					return
				}
				cfg.ase.qvalue=v
				call()
			})
		row.append('span').html('&nbsp;:')
	}
	{
		const row=holder.append('div')
			.style('margin','0px 5px 5px '+indent+'px')
		row.append('span').html('If MEAN_DELTA &ge;&nbsp;')
		row.append('input')
			.attr('type','number')
			.style('width','50px')
			.property('value', cfg.ase.meandelta_monoallelic)
			.on('keyup',()=>{
				if(d3event.code!='Enter' && d3event.code!='NumpadEnter') return
				let v=Number.parseFloat(d3event.target.value)
				if(!v || v<=0) {
					// invalid value
					return
				}
				if(cfg.ase.meandelta_monoallelic==v) {
					// same as current value
					return
				}
				cfg.ase.meandelta_monoallelic=v
				call()
			})
		row.append('span').html('&nbsp;:&nbsp;')
	}
	holder.append('div')
		.style('margin','0px 5px 5px '+(indent*2)+'px')
		.html('Is <span style="background:'+cfg.ase.color_monoallelic+';padding:1px 5px;color:white;">mono-allelic expression</span>')
	holder.append('div')
		.style('margin','0px 5px 5px '+(indent)+'px')
		.html('Else:')
	holder.append('div')
		.style('margin','0px 5px 5px '+(indent*2)+'px')
		.html('Is <span style="background:'+cfg.ase.color_uncertain+';padding:1px 5px;color:white;">ASE uncertain</span>')
	holder.append('div')
		.style('margin','0px 5px 5px 0px')
		.html('Else:')
	{
		const row=holder.append('div')
			.style('margin','0px 5px 5px '+indent+'px')
		row.append('span').html('If number of ASE markers &le;&nbsp;')
		row.append('input')
			.attr('type','number')
			.style('width','50px')
			.property('value', cfg.ase.asemarkernumber_biallelic)
			.on('keyup',()=>{
				if(d3event.code!='Enter' && d3event.code!='NumpadEnter') return
				let v=Number.parseInt(d3event.target.value)
				if(v<0) {
					// invalid value
					return
				}
				if(cfg.ase.asemarkernumber_biallelic==v) {
					// same as current value
					return
				}
				cfg.ase.asemarkernumber_biallelic=v
				call()
			})
			/*
		row.append('span').html('&nbsp;AND&nbsp;MEAN DELTA &le;&nbsp;')
		row.append('input')
			.attr('type','number')
			.style('width','50px')
			.property('value', cfg.ase.meandelta_biallelic)
			.on('keyup',()=>{
				if(d3event.code!='Enter' && d3event.code!='NumpadEnter') return
				let v=Number.parseFloat(d3event.target.value)
				if(v<0) {
					// invalid value
					return
				}
				if(cfg.ase.meandelta_biallelic==v) {
					// same as current value
					return
				}
				cfg.ase.meandelta_biallelic=v
				call()
			})
			*/
		row.append('span').html('&nbsp;:&nbsp;')
	}
	holder.append('div')
		.style('margin','0px 5px 5px '+(indent*2)+'px')
		.html('Is <span style="background:'+cfg.ase.color_biallelic+';padding:1px 5px;color:white;">bi-allelic expression</span>')
	holder.append('div')
		.style('margin','0px 5px 5px '+(indent)+'px')
		.html('Else:')
	holder.append('div')
		.style('margin','0px 5px 5px '+(indent*2)+'px')
		.html('Is <span style="background:'+cfg.ase.color_uncertain+';padding:1px 5px;color:white;">ASE uncertain</span>')
	holder.append('div')
		.style('margin','10px')
		.append('button')
		.text('Default ASE parameters')
		.on('click',()=>{
			cfg.ase.qvalue=0.05
			cfg.ase.meandelta_monoallelic=0.3
			cfg.ase.asemarkernumber_biallelic=0
			//cfg.ase.meandelta_biallelic=0.1
			call()
		})
}
