import * as client from './client'


/*
this is only a quick fix

places from tp that call blockinit()
- tp.gene
- tp.hm2.handlers

in the context of pecan, when showing a study view for a disease cohort, blockinit() will show variants of a gene
in this case, also need to show expression from Pediatric for this gene

however: study view is not connected to the *Pediatric* official dataset, and the mutations from that cohort are stored on client
thus need to explicitly indicate in the study config, that when launching blockinit() for a gene, need to query official ds to get gene data
*/




export default function tp_getgeneexpression(arg) {

/*
arg
	.x
	.y
		position for pane
	.gene
		gene name
	.genome str
	.loadgeneexpressionfromofficialds
	.hostURL
*/


Promise.resolve()
.then(()=>{

	if(!arg.gene) throw({message:'gene name missing'})
	if(!arg.genome) throw({message:'genome name missing'})
	if(arg.hostURL==undefined) throw({message:'no hostURL'})
	if(!arg.loadgeneexpressionfromofficialds) throw({message:'loadgeneexpressionfromofficialds missing'})
	if(!arg.loadgeneexpressionfromofficialds.dataset) throw({message:'dataset missing from loadgeneexpressionfromofficialds'})
	const par={
		genome:arg.genome,
		dsname:arg.loadgeneexpressionfromofficialds.dataset,
		expressiononly:1,
		genename:arg.gene,
		jwt:arg.jwt
	}
	return fetch( new Request(arg.hostURL+'/dsdata',{
		method:'POST',
		body:JSON.stringify(par)
	}))
	.then(data=>{return data.json()})
	.then(data=>{
		if(data.error) throw({message:data.error})
		if(!data.data) throw({message:'cannot get data'})
		return data.data
	})

})

.then(data=>{

	for(let i=0; i<data.length; i++) {
		const par={
			data:data[i].lst,
			expp:data[i].config,
			genename:arg.gene,
			presize:{
				x:(arg.x+40*i),
				y:(arg.y+40*i),
				width:350,
				height:650
			}
		}
		import('./ep').then(p=>{
			new p.default(par)
		})
	}
})

.catch(err=>{
	const pane = client.newpane({x:(arg.x || 600), y:(arg.y || 80)})
	pane.body.append('p').text('Error getting gene expression: '+err)
})
}
