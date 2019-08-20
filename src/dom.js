



export function make_radios ( arg ) {
/* makes radio buttons

******* Required
.holder
.options[ {} ]
	.label
	.value
.inputHandler

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
		.on('input', d=>{
			callback( d.value )
		})

	labels.append('span')
		.html(d=>'&nbsp;'+d.label)
	//return { divs, labels, inputs }
}
