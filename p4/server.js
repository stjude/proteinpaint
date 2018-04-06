
const express = require('express'),
	http = require('http'),
	https = require('https'),
	compression = require('compression'),
	sqlite = require('sqlite'),
	Canvas = require('canvas'),
	jsonwebtoken = require('jsonwebtoken')





const serverconfigfile = './config.json'

const serverconfig = require( serverconfigfile )







const app = express()

app.use( bodyParser.json({}) )
app.use( bodyParser.text({limit:'1mb'}) )
app.use(bodyParser.urlencoded({ extended: true })) 

app.use((req, res, next)=>{
	res.header("Access-Control-Allow-Origin", "*")
	res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
	next()
})


app.use(express.static(__dirname+'/public'))
app.use(compression())


if(serverconfig.jwt) {
	console.log('JWT is activated')
	app.use( (req,res,next)=>{
		if(!req.headers || !req.headers.jwt) {
			res.send({error:'No authorization'})
			return
		}
		jsonwebtoken.verify( req.headers.jwt, serverconfig.jwt, (err, decode)=>{
			if(err) {
				res.send({error:'Not authorized'})
				return
			}
			next()
		})
	})
}



app.get('/genomes',handle_genomes)




function handle_genomes(req,res) {
}
