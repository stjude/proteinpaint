const tape = require('tape')
const d3s = require('d3-selection')
const termsettingInit = require('../termsetting').termsettingInit


/*********
this is the direct functional testing of the component, without the use of runpp()
this currently doesn't work
will need to figure out how to allow node/browserify to work with import
*/

tape('\n',test=>{
	test.pass('-***- termsetting -***-')
	test.end()
})


const holder0 = d3s.select('body').append('div')

// testing special configurations, have to generate one pill instance in each test so pills are not reusable
test_disablereplaceremove()
test_usebinsless()

// general testing that can share a pill
test_menu()


function test_disablereplaceremove() {
	const pill = termsettingInit({
		holder0.append('div'),
		genome:'hg38',
		dslabel:'SJLife',
		disable_ReplaceRemove:true,
		debug: true,
		callback: (data)=>{
			// some logic here
		}
	})

	pill.main({
		term:{
			id:'dummy',
			name:'dummy',
			iscategorical:true,
			values:{
				cat1:{label:'Cat 1'}
			}
		},
		q:{ groupsetting:{ inuse:false } }
	})

	// trigger click on pill

	tape('disable_ReplaceRemove',test=>{
		// test if no Replace and Remove buttons in menu
	})
}


function test_usebinsless() {
	const pill = termsettingInit({
		holder0.append('div'),
		genome:'hg38',
		dslabel:'SJLife',
		use_bins_less: true,
		debug: true,
		callback: (data)=>{
			// some logic here
		}
	})

	pill.main({
		term:{
			id:'dummy',
			name:'dummy',
			iscategorical:true,
			values:{
				cat1:{label:'Cat 1'}
			}
		},
		q:{ groupsetting:{ inuse:false } }
	})

	// trigger click on pill

	tape('use_bins_less', test=>{
		// test to see 
	})
}


function test_menu() {
}
