/*
stdin: log for uploading the new fileviewer

arguments:

*/


const readline=require('readline')


const rl = readline.createInterface( {input:process.stdin} )

let viewerid
let projectid


rl.on('line',line=> {
	const l = line.split(/\s+/)
	if(l[0]=='ID') {
		viewerid = l[1]
		return
	}
	if(l[0]=='Project') {
		projectid = l[1]
		return
	}
})

rl.on('close',()=>{
	//console.log('viewer',viewerid, 'project', projectid)
})
