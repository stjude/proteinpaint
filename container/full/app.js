const fs = require('fs')
const spawnSync = require('child_process').spawnSync

/*if (!fs.existsSync('./serverconfig.json')) {
	throw `missing serverconfig.json`
}*/

const serverconfig = require('./serverconfig.json')
if (!serverconfig.genomes) {
	serverconfig.genomes =  [
    {
      "name": "hg19",
      "species": "human",
      "file": "./genome/hg19.js",
      "datasets": [
        {
          "name": "ClinVar",
          "jsfile": "./dataset/clinvar.hg19.js"
        }
      ]
    },
    {
      "name": "hg38",
      "species": "human",
      "file": "./genome/hg38.js",
      "datasets": [
        {
          "name": "ClinVar",
          "jsfile": "./dataset/clinvar.hg38.js"
        }
      ]
    }
  ]
}

serverconfig.backend_only = false
fs.writeFileSync('./serverconfig.json', JSON.stringify(serverconfig, null, '   '), {charset: 'utf8'})

console.log(`generating public/bin for ${serverconfig.url}`)
spawnSync('npx', ['proteinpaint-front', serverconfig.url],  { encoding: 'utf-8' })

require('@stjude/proteinpaint-server')
