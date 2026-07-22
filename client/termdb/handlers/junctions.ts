export class SearchHandler {
	async init(opts) {
		if (!opts?.holder) throw new Error('opts.holder is required')
		opts.holder.append('div').text('the junction term is selectable from genome browser')
	}
}
