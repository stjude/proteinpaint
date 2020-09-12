/*
	This script is used programatically with
	require('@stjude/proteinpaint').

	In contrast, bin.js is used via command-line.  
*/

function run(/*opts*/) {
	/*** to-do: support options? ***/
	require('../server.js')
}

exports.run = run
