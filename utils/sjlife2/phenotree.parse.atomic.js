if (process.argv.length != 3) {
	console.log('<input 5-column table> output termjson to stdout')
	process.exit()
}

/*
1. label
2. -
3. -
4. key
5. 1=Yes; 2=No; -1=Not responded;
*/

const fs = require('fs')

const key2terms = {}

const bins = {
	default: {
		type: 'regular',
		bin_size: 5,
		stopinclusive: true,
		first_bin: {
			start: 0,
			stop: 5,
			stopinclusive: true
		}
	}
}

for (const line of fs
	.readFileSync(process.argv[2], { encoding: 'utf8' })
	.trim()
	.split('\n')) {
	const [name, not1, not2, key, configstr] = line.split('\t')
	if (!name) throw 'label missing: ' + line
	if (!key) throw 'key missing: ' + line
	if (!configstr) throw 'configstr missing: ' + line

	const term = parseconfig(configstr)
	term.name = name
	key2terms[key] = term
}
console.log(JSON.stringify(key2terms, null, 2))

function parseconfig(str) {
	const term = {}
	const l = str.split(';')

	const f1 = l[0].trim() // special rule for 1st field
	if (f1 == 'integer') {
		term.type = 'integer'
		term.bins = JSON.parse(JSON.stringify(bins))
	} else if (f1 == 'float') {
		term.type = 'float'
		term.bins = JSON.parse(JSON.stringify(bins))
	} else {
		// must be categorical and key=value
		const [key, value] = f1.split('=')
		if (!value) throw 'first field is not integer/float, and not k=v: ' + f1
		term.type = 'categorical'
		term.groupsetting = { disabled: true }
		term.values = {}
		term.values[key] = { label: value }
	}

	for (let i = 1; i < l.length; i++) {
		const field = l[i].trim()
		const [key, value] = field.split('=')
		if (!value) throw 'field ' + (i + 1) + ' is not k=v: ' + field
		if (!term.values) term.values = {}
		term.values[key] = { label: value }
	}
	return term
}
