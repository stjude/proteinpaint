/*
********************** EXPORTED
make_radios
make_one_checkbox
*/



export function make_radios ( arg ) {
/* makes radio buttons

******* Required
.holder
.options[ {} ]
	.label
	.value
	.checked
		only set for at most one option
.callback
	async

******* Optional
.styles{}
	css to be applied to each <div> of the options
	e.g. { "padding":"5px", "display":"inline-block" }
.inputName
	common Name of <input>, use random number if not given
*/
	const { holder, options, callback, styles} = arg
	const inputName = arg.inputName || Math.random().toString()

	const divs = holder.selectAll()
		.data(options, d => d.value)
		.enter()
		.append('div')
		.style('margin','5px')

	if(styles) {
		for(const k in styles) {
			divs.style(k, styles[k])
		}
	}

	const labels = divs
		.append('label')

	const inputs = labels
		.append('input')
		.attr('type', 'radio')
		.attr('name', inputName )
		.attr('value', d=>d.value)
		.on('input', async (d)=>{
			inputs.property('disabled',true)
			await callback( d.value )
			inputs.property('disabled',false)
		})
	inputs.filter(d=>d.checked).property('checked', true)

	labels.append('span')
		.html(d=>'&nbsp;'+d.label)
	return { divs, labels, inputs }
}




export function make_one_checkbox ( arg ) {
/* on/off switch

******* required
.holder
.labeltext
.callback()
	async
	one boolean argument corresponding to whether the box is checked or not
******* optional
.divstyle{}
.checked
	if set to true, box is checked by default
*/
	const { holder, labeltext, callback, checked, divstyle } = arg

	const div = holder.append('div')
	if(divstyle) {
		for(const k in divstyle) div.style(k, divstyle[k])
	}
	const label = div.append('label')
	const input = label.append('input')
		.attr('type','checkbox')
		.property('checked', checked)
		.on('input', async ()=>{
			input.property('disabled', true)
			await callback(input.property('checked'))
			input.property('disabled', false)
		})
	label.append('span').html('&nbsp;'+labeltext)
}

export function make_select_btn_pair( holder ){
	// a click button triggering a <select> menu
	const btn = holder.append('div')
		.attr('class','sja_filter_tag_btn')
		.style('position','absolute')
	const select = holder.append('select')
		.style('opacity',0)
		.on('mouseover',()=>{
			btn.style('opacity', '0.8')
			.style('cursor','default')
		})
		.on('mouseout',()=>{
			btn.style('opacity', '1')
		})
	return [select, btn]
}