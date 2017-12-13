if(process.argv.length!=4) {
	console.log('<in dir> <outdir>')
	process.exit()
}


const path=require('path')
const exec=require('child_process').execSync

const indir=process.argv[2]
const outdir=process.argv[3]

require('glob').glob(path.join(indir,'*.js'), (err,files)=>{
	if(err) {
		console.log(err)
		return
	}
	for(const file of files) {
		exec('./node_modules/babel-cli/bin/babel.js '+file+' | ./node_modules/uglify-js/bin/uglifyjs --compress --mangle > '+path.join(outdir,path.basename(file)))
	}
})
