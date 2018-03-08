const readline=require('readline')


const rl = readline.createInterface( {input:process.stdin})

let ID
let Project


rl.on('line',line=> {
	const l = line.split(/\s+/)
	if(l[0]=='ID') {
		ID = l[1]
		return
	}
	if(l[0]=='Project')
		Project = l[1]
		return
	}
})

rl.on('close',()=>{
})
