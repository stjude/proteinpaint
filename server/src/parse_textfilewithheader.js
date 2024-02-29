export function parse_textfilewithheader(text) {
	/*
    for sample annotation file, first line is header, skip lines start with #
    parse each line as an item
    */
	const lines = text.split(/\r?\n/)
	/*
        if(lines.length<=1) return ['no content']
        if(lines[0] == '') return ['empty header line']
        */

	// allow empty file
	if (lines.length <= 1 || !lines[0]) return [null, []]

	const header = lines[0].split('\t')
	const items = []
	for (let i = 1; i < lines.length; i++) {
		if (lines[i][0] == '#') continue
		const l = lines[i].split('\t')
		const item = {}
		for (let j = 0; j < header.length; j++) {
			const value = l[j]
			if (value) {
				item[header[j]] = value
			}
		}
		items.push(item)
	}
	return [null, items]
}
