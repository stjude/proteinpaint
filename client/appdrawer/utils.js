export function makeButton(arg) {
	const button = arg.div
		.append('button')
		.attr('type', 'submit')
		.style('background-color', arg.backgroundColor ? arg.backgroundColor : '#cfe2f3')
		.style('margin', arg.margin ? arg.margin : '20px 20px 0px 20px')
		.style('padding', '8px')
		.style('border', 'none')
		.style('border-radius', '3px')
		.style('display', 'inline-block')
		.text(arg.text)

	return button
}

//TODO function to choose black or white text per background to increase contrast
