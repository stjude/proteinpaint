/*
take a set of input files, convert each to a SQLite db

input files must have 3 columns:

1. gene symbol, must be in lower case
2. expression value, float
3. sample name

*/


if(process.argv.length<=3) {
	console.log(process.argv[1]+' <output directory> <input file1> <input file2> ... no wildcard please')
	process.exit()
}

const path=require('path')
const exec=require('child_process').execSync
const fs=require('fs')

const outdir=process.argv[2]


const sqlscript=path.join(outdir,'db.sql')

for(let i=3; i<process.argv.length; i++) {
	const file=process.argv[i]
	const fn=path.basename(file)

	fs.writeFileSync(sqlscript,`
	drop table if exists data;
	create table data (
		gene varchar(255) not null,
		value float not null,
		sample varchar(255) not null
	);
	create index data_gene on data (gene);
.mode tabs
.import ${file} data`)

	const cmd='sqlite3 '+path.join(outdir,fn)+' < '+sqlscript
	exec(cmd)
	console.log(cmd)
}

exec('rm -f '+sqlscript)

