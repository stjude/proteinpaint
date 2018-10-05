/*
to automate the install process to certain degree

Run this script under the ProteinPaint root diretory, as:

$ node utils/install.pp.js


Will install some dependencies, and download support files if not available on your system

Requires:

* Node.js 8 or higher
* npm
* curl


Optional:

* two-column config file, key \t value
  lines starting with # are ignored
  keys:

  MAC   - your system is mac, otherwise linux (no windows)
  TP    - full path of the TP directory
  CACHE - full path of the cache directory
  BIN   - full path to a directory for storing dependent binary files and programs
  URL   - the URL of your PP service
  GENOMES - prebuilt genomes to be installed on your system, join multiple by comma
            hg19
			hg38


*/

const fs = require('fs')
const exec =require('child_process').execSync

// user config
const uc = {}
// server config, to be exported as "serverconfig.json"
const sc = {}

if( process.argv[2] ) {
	// load installation instructions from external file, optional
	for(const line of fs.readFileSync(process.argv[2],{encoding:'utf8'}).trim().split('\n')) {
		if(!line) continue
		if(line[0]=='#') continue
		const l = line.split('\t')
		if(l.length != 2) continue
		uc[ l[0] ] = l[1]
	}
}


// replace url


// bin/
// get ucsc binaries


// tp

// tp/genomes/


// for each genome:
// 


// export to serverconfig.json
