#!/usr/bin/python3

import argparse,json,os,sys

parser = argparse.ArgumentParser()
parser.add_argument('-f','--FileDir',help='The directory path where all sample files produced by sample splitter are located')
args = parser.parse_args()

#_________________________________________________________________________________
#functions
def VALIDATOR(js):
	if 'dt' not in js:
		return False,'Error: dt is not provided'
	if not isinstance(js['dt'],int):
		return False, 'Error: dt is not integer'
	if js['dt'] == 1:
		CK,ERROR = VALIEACH('snvindel',js)
	elif js['dt'] == 2 or js['dt'] == 5:
		if js['dt'] == 2 and 'fusiongene' not in js:
			return False,'Error: fusiongene is not provided for RNA fusion data'
		CK,ERROR = VALIEACH('svfusion',js)
	elif js['dt'] == 4:
		CK,ERROR = VALIEACH('cnv',js)
	elif js['dt'] == 10:
		CK,ERROR = VALIEACH('loh',js)
	elif js['dt'] == 6:
		CK,ERROR = VALIEACH('itd',js)
	if CK:
		return True,0
	else:
		return False,ERROR
		

def VALIEACH(vartype,varjs):
	if vartype == 'snvindel':
		KEYS = ['alt','chr','class','mname','position','ref']
	elif vartype == 'svfusion':
		KEYS = ['chrA','chrB','posA','posB','strandA','strandB']
	elif vartype == 'cnv':
		KEYS = ['chr','start','stop','value']
	elif vartype == 'loh':
		KEYS = ['chr','start','stop','segmean']
	elif vartype == 'itd':
		KEYS = ['chr','start','stop']
	for k in KEYS:
		if k not in varjs:
			return False,'Error: '+k+' is not provided'
		if k in ['position','posA','posB','start','stop']:
			if not isinstance(varjs[k],int):
				return False,'Error: '+k+' is not integer'
		elif k in ['value','segmean']:
			if not isinstance(varjs[k],int) and not isinstance(varjs[k],float):
				return False, 'Error: '+k+' is neither integer nor float'
		else:
			if not isinstance(varjs[k],str):
				return False,'Error: '+k+' is not string'
	return True,0  
						
BADVAR = 0
SampleFiles = os.listdir(args.FileDir)
for sam in SampleFiles:
	FilePath = os.path.join(args.FileDir,sam)
	if os.path.isdir(FilePath):
		continue
	elif sam.startswith('.'):
		continue
	fh = open(FilePath)
	AllVar = fh.read().replace('\n','')
	AllVarJS = json.loads(AllVar)
	for sjs in AllVarJS:
		FCK,FError = VALIDATOR(sjs)
		if not FCK:
			BADVAR += 1
			print('\n'.join([sam,FError,json.dumps(sjs)]),file = sys.stderr)
		else:
			continue
	
print('There are total '+str(BADVAR)+' variations have problem')
