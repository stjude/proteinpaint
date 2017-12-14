if(process.argv.length!=4) {
	console.log('<input js file to be uglified > <outdir>')
	process.exit()
}


const path=require('path')
const exec=require('child_process').execSync

const infile=process.argv[2]
const outdir=process.argv[3]

exec('./node_modules/babel-cli/bin/babel.js '+infile+' | ./node_modules/uglify-js/bin/uglifyjs --compress --mangle > '+path.join(outdir,path.basename(infile)))
