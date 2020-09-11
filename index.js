/*
	This script is used programtically with
	require('@stjude/proteinpaiint').

	In contrast, bin.js is used via command-line.  
*/

function run(/*opts*/) {
	/*** to-do: support options? ***/
	require('../server.js')
}

exports.run = run
