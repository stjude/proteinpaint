#!/usr/bin/python

"""CDD_extraction.py: Extract the CDD information for any species from NCBI refseq protein database and fromat the CDD file to be used for proteinpaint
		      The protein database from NCBI for CDD info extraction can be downloaded from ftp://ftp.ncbi.nih.gov/refseq/H_sapiens/mRNA_Prot/*.protein.gpff.gz
		      One example of protein annotation file from NCBI: "vertebrate_mammalian.12.protein.gpff.gz"
"""

__author__    =  "Jian  Wang"
__copyrigth__ = "Copyright 2020, St.Jude" 

import re,os,gzip,sys
import argparse
import json

parser = argparse.ArgumentParser(description='refSeq CDD annotation. Default species: Homo_sapiens')
parser.add_argument('-p','--path',help='The path to refseq protein database downloaded from NCBI')
parser.add_argument('-s','--species',help="Species name. Current supported species: human,mouse,zebrafish",default='human')
parser.add_argument('--isoform',help="prefered isoform list",default=None)
parser.add_argument('--cddid',help='Include domain without cdd id',action='store_true')

args = parser.parse_args()


#If no options were given by the user, print help and exit
if len(sys.argv) == 1:
	parser.print_help()
	exit(1)


if args.path:
	PATH = args.path
else:
	error("path to the protein database is required")


#Define functions
#extract all annotation content for each protein ID
#extract species info 
def GETPCON():
	con = ''
	CHE = True
	while CHE:
		newline = fh.readline().decode('utf-8')
		if newline.strip() == 'ORIGIN':
			CHE = False
		elif not newline:
			CHE = False
		else:
			con += ' ' + newline
	#extract species info
	spe = re.search('DEFINITION.*\[(.*?)\]\.\s*?ACCESSION',con,re.S).group(1)
	speL = [x.strip() for x in re.split('\s',spe) if x.strip()]
	spe = ' '.join(speL)
	return con,spe


#find RNA acc
def FINDRNAID(c):
	ID = re.search('DBSOURCE\s+.+((N|X)M_\d+)',c)
	if ID:
		return ID.group(1)
	else:
		return False

#Generate all region and site domain info

def GETDOMAIN(transid,annocontext):
	annocontext = re.search('FEATURES[\s\S]*',annocontext).group(0).strip().split('\n')
	alldomain = {'region':set(),'region_nocdd':set(),'site':set(),'site_nocdd':set()}
	#extract all regions and sites and 
	#formate:
	#
	domainidx = [i for i,x in enumerate(annocontext) if x.strip().startswith('Region') or x.strip().startswith('Site')]
	for i in domainidx:
		domain_cor,domain_dic = GETDOMAININFO(i,annocontext,transid)
		if 'note' not in domain_dic:
			continue
		if 'experiment' not in domain_dic and 'db_xref' not in domain_dic:
			continue
		if 'region_name' not in domain_dic and 'site_type' not in domain_dic:
			continue
		cate,dset = DOMAININFO(domain_cor,domain_dic)
		#if args.cddid and (cate == 'region_nocdd' or cate == 'site_nocdd'):
		#	continue
		alldomain[cate].update(dset)
	if args.cddid:
		alldomain.pop('region_nocdd')
		alldomain.pop('site_nocdd')
	return alldomain

##used in GETDOMAIN
#return category and a set of final domain info
#example of domain info:
#region_name@description#coordinate@CDD
def DOMAININFO(cor,domdic):
	NOTE = domdic['note'].replace('"','')
	EVI = ''
	CDD = ''
	RTSET = set()
	if 'region_name' in domdic:
		RegNam = domdic['region_name'].replace('"','')
		if 'experiment' in domdic:
			if '{' in RegNam:
				if'PubMed' in RegNam:
					RegNam,EVI = GET_PMID(RegNam)
				else:
					RegNam = re.search("(.*?)\.?\s*\{",RegNam).groups()[0]
			else:
				if RegNam.endswith('.'):
					RegNam = RegNam[:-1]
			if re.search("\{.*\}",NOTE):
				Description = re.search("\};?\s*(.*)",NOTE).groups()[0]
			else:
				Description = NOTE if not NOTE.endswith('.') else NOTE[:-1]
			category = 'region_nocdd'  
		elif 'db_xref' in domdic:
			CDD = domdic['db_xref'].replace('"','')
			if ';' in NOTE:
				Description = re.search('(.*);',NOTE).group(1).strip()
				S_P = re.search('.*;(.*)',NOTE).group(1).strip()
				EVI = GET_evi(S_P)
			else:
				Description = NOTE if not NOTE.endswith('.') else NOTE[:-1]
			category = 'region'  
	elif 'site_type' in domdic:
		RegNam = domdic['site_type'].replace('"','')
		if 'experiment' in domdic:
			if '{' in NOTE:
				if'PubMed' in NOTE:
					NOTE,EVI = GET_PMID(NOTE)
				else:
					NOTE = re.search("(.*?)\.?\s*\{",NOTE).groups()[0]
			Description = NOTE if not NOTE.endswith('.') else NOTE[:-1]
			category = 'site_nocdd'
		elif 'db_xref' in domdic:
			CDD = domdic['db_xref'].replace('"','')
			Description = NOTE if not NOTE.endswith('.') else NOTE[:-1]
			category = 'site'
	DOMAINLIST = [RegNam,Description]
	for c in cor:
		DL = DOMAINLIST+[c]
		if CDD and EVI:
			DL.extend([EVI,CDD])
		elif CDD:
			DL.append(CDD)
		elif EVI:
			DL.append(EVI)
		RTSET.add('@'.join(DL))
	return 	category,RTSET


### used in DOMAININFO
#get pubmed ID
def GET_PMID(c):
	pmid = re.search("PubMed:(\d+)",c).groups()[0]
	NAME = re.search("(.*?)\.?\s*\{",c).groups()[0]
	evi = 'pmid:'+pmid
	return NAME,evi

### used in DOMAININFO
#get evidence info
def GET_evi(line): #Get evidence
	if re.search("cd\d+",line):
		return("Curated_at_NCBI:"+line)
	elif re.search("PRK\d+",line):
		return("PRK:"+line)
	elif re.search("pfam\d+",line):
		return("Pfam:"+line)
	elif re.search("smart\d+",line):
		return("SMART:"+line)
	elif re.search("COG\d+",line):
		return("COG:"+line)
	elif re.search("TIGR\d+",line):
		return("TIGRFAM:"+line)
	else:
		return False

##used in function GETDOMAIN
#return list of coordinate and the dictionary of fetures
def GETDOMAININFO(idx,contextlist,tid):
	#coordinate is a list structure with a list of start and stop aa site
	COR,EXTIDX = GETCOR(idx, contextlist)
	#annotation information is a dictionary data structure with one or all of the following terms as keys and the detail of each term as value
	#(region_name,site_type,experiment,note,db_xref)
	ANNOINFO = GETFETURECONT(idx,contextlist,tid,EXTIDX)
	return COR,ANNOINFO


###used in GETDOMAININFO to get coordinate list
def GETCOR(i,c):
#return extidx to facilitate GETFETURECONT
	cor = []
	extidx = 0
	regionSite = c[i]
	if 'Region' in regionSite:
		if '..' in regionSite:
			cor.append('@'.join(re.search("Region\s+<?(\d+)\.\.>?(\d+)",regionSite).groups()[0:2]))
		else:
			regcor = re.search("Region\s+<?(\d+)",regionSite).group(1)
			cor.append('@'.join([regcor]*2))
	elif re.search("Site\s+order\(.*",regionSite):
		if not regionSite.endswith(')'):
			for i,a in enumerate(c[i+1:]):
				regionSite += a.strip()
				if a.strip().endswith(')'):
					extidx = i+1
					break
		COORD = re.search("Site\s+order\((.*)\)",regionSite).groups()[0].split(',')
		N = [cor.append('@'.join([x,x])) if '..' not in x else cor.append(x.replace('..','@')) for x in COORD]
	elif re.search("Site\s+\d+",regionSite):
		if '..' in regionSite:
			cor.append(re.search("Site\s+(\d+\.\.\d+)",regionSite).groups()[0].replace('..','@'))
		else:
			COORD = re.search("Site\s+(\d+)",regionSite).groups()[0]
			cor.append('@'.join([COORD]*2))
	return cor,extidx
###used in GETDOMAININFO to get content of region_name, experiment, note, db_xref.
def GETFETURECONT(i,c,tid,extidx):
	feturedic = {}
	k = ''
	v = ''
	for f in c[i+1+extidx:]:
		f = f.strip()
		if not k and v:
			break
		if f.startswith('Region ') or f.startswith('Site ') or f.startswith('CDS ') or f.startswith('/'):
			 #Region          25..466
                    		#/region_name="LKR_SDH_like"
                     		#/note="bifunctional lysine ketoglutarate reductase
                     		#/saccharopine dehydrogenase enzyme; cd12189"
                     		#/db_xref="CDD:240665"
			if f.startswith('/') and f.endswith('"') and '=' not in f:
				v += ' '+f[1:]
				continue
			if k and v:
				if not v.endswith('"'):
					v += '"'
					#print("No double quotes for key: "+k, file=sys.stderr)
					#print('Add the missed double quotes in the file: '+Pfile)
					#print('TranscriptID: '+tid)
				feturedic.update({k:v})
				k = ''
				v = ''
			if f.startswith('Region') or f.startswith('Site') or f.startswith('CDS'):
				break
			elif f.startswith('/'):
				if '="' in f:
					k,v = re.search('/(.*?)=(".*)',f).groups()
				else:
					k,v = re.search('/(.*?)=(.*)',f).groups()
					v = '"' + v
				if v.endswith('"'):
					feturedic.update({k:v})
					k = ''
					v = ''
		elif f.endswith('"'):
			if k and v:
				v += ' ' + f
			feturedic.update({k:v})
			k = ''
			v = ''
		else:
			v += ' ' + f
	return feturedic




##protein ID
PID = '' 
##Domain dic data structure
DOMAIN = {'region':{},'region_nocdd':{},'site':{},'site_nocdd':{}}
## species info
ORG2LATIN = {"human":"Homo sapiens",
		"mouse":"Mus musculus",
		"zebrafish":"Danio rerio"}
ORG = ORG2LATIN[args.species]

#Extract CDD info for both region and site
for Pfile in os.listdir(PATH):
	if not Pfile.endswith("gz"):
		continue
	file = os.path.join(PATH,Pfile)
	fh = gzip.open(file,'rb')
	for line in fh:
		line = line.decode('utf-8')
		if re.search("LOCUS\s+(N|X)P",line):
			# New protein ID
			PID = re.search("LOCUS\s+((N|X)P_\d+)\s",line).groups()[0]
			#annotation context for the PID
			#DEFINITION  CD300c molecule-like isoform 2 precursor [Homo sapiens].
			#ACCESSION   NP_001311005 XP_005257965 XP_005276682
			#DBSOURCE    REFSEQ: accession NM_001324076.1
			annotation_context,SPE = GETPCON()
			#continue if species name not match
			if not SPE or SPE != ORG:
				continue
			#GET mRNA refseq accession ID
			mRNA_acc = FINDRNAID(annotation_context)
			if not mRNA_acc:
				continue
			RTDOMAIN = GETDOMAIN(mRNA_acc,annotation_context)
			if not RTDOMAIN:
				continue
			for c in RTDOMAIN:
				if RTDOMAIN[c]:
					if mRNA_acc not in DOMAIN[c]:
						DOMAIN[c][mRNA_acc] = RTDOMAIN[c]
					else:
						DOMAIN[c][mRNA_acc].update(RTDOMAIN[c])
		else:
			continue
	fh.close()

#When a site locate within a region and have same cdd id with this region, the site will be removed
#only apply to sites with cdd id
REG_DIC = {} #{mrnaID: [['473-525', '8-250', '298-338'], ['CDD:212757', 'CDD:153342', 'CDD:294066']]}
for mid in DOMAIN['region']:
	rang = []
	cdid = []
	for ele in DOMAIN['region'][mid]: #ele: 'SH3_Nostrin@Src homology 3 domain of Nitric Oxide Synthase TRaffic INducer@473@525@Curated_at_NCBI:cd11823@CDD:212757'
		tem_li = ele.split('@')
		rang.append('-'.join(map(str,tem_li[2:4])))
		cdid.append(tem_li[-1])
	REG_DIC[mid] = [rang,cdid]

newSite = {}
for smid in DOMAIN['site']:
	newSite[smid] = set()
	if smid not in REG_DIC:
		newSite[smid] = DOMAIN['site'][smid]
	else:
		for sele in DOMAIN['site'][smid]:
			tem_lis = sele.split('@')
			for R_ran in range(len(REG_DIC[smid][0])):
				RRLIS = REG_DIC[smid][0][R_ran].split('-')
				#test if a site is located within a region and has same cdd id with the region
				if int(tem_lis[2]) >= int(RRLIS[0]) and int(tem_lis[3]) <= int(RRLIS[1]) and tem_lis[-1] == REG_DIC[smid][1][R_ran]:
					tem_lis.pop()
					continue
				else:
					continue
			newSite[smid].add('@'.join(tem_lis))
DOMAIN['site'] = newSite


#Combine and output formated DATA
FDIC = {}

for d in DOMAIN:
	for mid in DOMAIN[d]:
		if mid not in FDIC:
			FDIC[mid] = DOMAIN[d][mid]
		else:
			FDIC[mid].update(DOMAIN[d][mid])

#protein domain from manually curated in Computational Biology Department from St. JUDE
#only apply to human
if args.species == 'human':
	if os.path.isfile('protein_manuallyCurated.json'):
		modifh = open('protein_manuallyCurated.json')
	else:
		print('Missed manually curated protein domain file "protein_manuallyCurated.json"',file=sys.stderr)
		sys.exit(1)
	MODIDATA = {}
	for line in modifh:
		L = line.strip().split('\t')
		if L[0] in MODIDATA:
			MODIDATA[L[0]].append(L[1])
		else:
			MODIDATA[L[0]] = [L[1]]
	modifh.close()

#ISO list selected for the final proteindomain.json file
if args.isoform:
	ISOLIST = {x.strip() for x in open(args.isoform)}
else:
	#CKISO = input('You want the all isoforms from NCBI into your final CDD proteindomain json file? y for yes!\n')
	#if CKISO == 'y':
	ISOLIST = False
	#else:
	#	print('Please provide your prefered isoform accession ID file with one id each row...',file=sys.stderr)
	#	sys.exit(1)

#OUTPUT formated data
FINAL_OUT = open(args.species+"_CDD.Json",'w')
for mid in FDIC:
	if ISOLIST and mid not in ISOLIST: #select prefered isoform
		continue
	if args.species == 'human':
		if mid in MODIDATA: #output manually curated protein domain
			for m in MODIDATA[mid]:
				FINAL_OUT.write('\t'.join([mid,m])+'\n')
		if mid == 'NM_006206':
			continue
	for i in FDIC[mid]:
		indiv_cdd = i.split('@')
		outdic = {'name':indiv_cdd[0],'description':indiv_cdd[1],'start':int(indiv_cdd[2]),'stop':int(indiv_cdd[3])}
		if len(indiv_cdd) == 4:
			FINAL_OUT.write('\t'.join([mid,json.dumps(outdic,sort_keys=True)])+'\n')
		elif len(indiv_cdd) == 5:
			LAST = indiv_cdd[4].split(':')
			if 'CDD' in indiv_cdd[4]:
				outdic['CDD'] = str(LAST[1])
			elif 'pmid' in indiv_cdd[4]:
				outdic[LAST[0]] = str(LAST[1])
			FINAL_OUT.write('\t'.join([mid,json.dumps(outdic,sort_keys=True)])+'\n')
		elif len(indiv_cdd) == 6:
			LAST1 = indiv_cdd[4].split(':')
			LAST2 = indiv_cdd[5].split(':')
			outdic[LAST1[0]] = str(LAST1[1])
			outdic['CDD'] = str(LAST2[1])
			FINAL_OUT.write('\t'.join([mid,json.dumps(outdic,sort_keys=True)])+'\n')
		else:
			continue
			
FINAL_OUT.close()






