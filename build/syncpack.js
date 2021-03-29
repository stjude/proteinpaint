const watch = require('node-watch')
const exec = require('child_process').exec

function handleChange(event, name) {
	console.log('%s changed.', name, event)
	if (event == 'update') {
		exec(`cp ${name} tmppack/package/`, console.err)
	}
}

const names = ['server.js', 'src/common.js', 'genome', 'dataset', 'public']

for (const name of names) {
	watch(`./${name}`, handleChange)
}

console.log('watching files to sync ...')
