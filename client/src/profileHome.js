import { select } from 'd3-selection'

/*
holder: html dom
getDatasetAccessToken()
*/
export function init(arg) {
	const holder = select(arg.holder)
	holder.append('div').text('profile abbreviated')
	holder.append('div').text('profile full')
}
