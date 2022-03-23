#!/usr/bin/python3

import sys,os,re
import argparse
from argparse import RawTextHelpFormatter
import subprocess as sp
import string,random

####function
#test if required parameters are provided
def PARMTST(param):
	for p in param:
		if not vars(args)[p]:
			return False
	return True

#dependent parameter check for genotyping:
def GENOTYPDEPTST():
	if args.genotyping and (not args.ref or not args.alt):
		return False
	else:
		return True
#test if samtools is available
def SAMTOOLSTST():
	samtools_RT = sp.run('samtools',shell=True,stderr=sp.PIPE).stderr.decode('utf-8')
	if 'command not found' in samtools_RT:
		return False
	else:
		return True


############
#variant table
def VARTABLE():
	url = 'https://ppr.stjude.org/?genome='+args.genome+'&block=1'
	#bam table
	BAM = {x.strip().split('\t')[0]:x.strip().split('\t')[1] for x in open(args.bamtable)}
	bamOutPath = args.bamslicepath
	allBamName = set()

	###index of header names
	samColumn,chraColumn,posStartColumn = args.sample,args.chr,args.start	
	rHeader = [samColumn,chraColumn,posStartColumn]
	if args.stop:
		posStopColumn = args.stop
		rHeader.append(posStopColumn)
	if args.chr2:
		chrbColumn,posbColumn = args.chr2,args.pos2
		rHeader.extend([chrbColumn,posbColumn])
	if args.genotyping:
		refColumn,altColumn = args.ref,args.alt
		rHeader.extend([refColumn,altColumn])

	#output file
	out = open(args.output,'w')

	#generate url and sliced bam file
	fh = open(args.vartable)
	header = fh.readline().strip().split('\t')
	out.write('\t'.join(header+['link1','link2'])+'\n')

	#check if header names from parameter exist in variant table
	for h in rHeader:
		if not h in header:
			print('Error: there is no '+h+' in the variant table header!')
			sys.exit(1)
	rHeaderIdx = {x:header.index(x) for x in rHeader}
	for line in fh:
		URLL = [] #urls
		L = line.replace('\n','').split('\t')
		sample = L[rHeaderIdx[samColumn]]

		#if bam file of current sample exists
		if not sample in BAM:
			print('Error: there is no bam file for sample: '+sample)
			sys.exit(1)
		chra = L[rHeaderIdx[chraColumn]]
		chra = PARCHR(chra)
		posStar = int(L[rHeaderIdx[posStartColumn]])
		if args.stop:
			posStop = L[rHeaderIdx[posStopColumn]].strip()
		else:
			posStop = ''
		if args.genotyping:
			REF = L[rHeaderIdx[refColumn]].strip()
			ALT = L[rHeaderIdx[altColumn]].strip()
		else:
			REF = False
			ALT = False
		if posStop:
			URLL.extend(GENURL(sample,chra,posStar,bamOutPath,BAM[sample],url,pstop=int(posStop)))
		else:
			URLL.extend(GENURL(sample,chra,posStar,bamOutPath,BAM[sample],url))
			#support on the fly genotyping. reference and alternative alleles should be available for SNVindels
			if REF or ALT:
				NEWURLL = []
				VARIANT = '.'.join([chra,str(posStar),REF,ALT])
				for u in URLL:
					NEWURLL.append(u+'&variant='+VARIANT)
				URLL = NEWURLL
		if args.chr2:
			chrb = L[rHeaderIdx[chrbColumn]]
			if chrb:
				chrb = PARCHR(chrb)
				posb = int(L[rHeaderIdx[posbColumn]])
				URLL.extend(GENURL(sample,chrb,posb,bamOutPath,BAM[sample],url))
		if len(URLL) == 1:
			URLL.append('')
		out.write('\t'.join(L+URLL)+'\n')
	fh.close()
	out.close()

#single variant
def SINGVAR():
	url = 'https://ppr.stjude.org/?genome='+args.genome+'&block=1'
	bamOutDir = '/research/rgs01/resgen/legacy/gb_customTracks/tp/tempbamslice'
	sample = os.path.split(args.bampath)[1].split('.')[0]
	URLL = [] #url
	if ':' in args.variant:
		chra,posa,chrb,posb = [y for x in args.variant.split(':') for y in x.split('.')] 
		URLL.extend(GENURL(sample,chra,posa,bamOutDir,args.bampath,url))
		URLL.extend(GENURL(sample,chrb,posb,bamOutDir,args.bampath,url))
	else:
		L = args.variant.split('.')
		if len(L) == 3:
			chra,posStar,posStop = L
			URLL.extend(GENURL(sample,chra,posStar,bamOutDir,args.bampath,url,pstop=int(posStop)))
		else:
			chra,posStar = L[0:2]
			URLL.extend(GENURL(sample,chra,posStar,bamOutDir,args.bampath,url))
			if args.genotyping:
				if len(L) != 4:
					print('ref and alt allele needed for genotyping!')
					sys.exit(1)
				else:
					REF,ALT = L[2:4]
					VARIANT = '.'.join([chra,str(posStar),REF,ALT])
					URLL = [x+'&variant='+VARIANT for x in URLL]
	for u in URLL:
		print(u)

#data sharing
#generate new url link for working on different server
#variant table should include columns of link1 and link2 already
def DATASHARE():
	server = {'public':'https://proteinpaint.stjude.org','test':'https://pp-int-test.stjude.org'}
	SERRT = GENLINK(args.server,server[args.server],args.varianttable,args.output)
	if not SERRT:
		print('Error: Please check if there is link1 and link2 columns from the input table file!')


#generate url links
def GENURL(sam,chra,pstart,bop,bam,url,pstop=False):
        URLL = []
        pstart = int(pstart)
        if pstop:
                pstop = int(pstop)
        sam_bam = bam
        ranges = GETRANGE(pstart,pstop)
        for r in ranges:
                samtoolsRange = chra+':'+str(r[0])+'-'+str(r[1])
                highlightPos = str(pstart-1)
                highLightRange = chra+':'+'-'.join([highlightPos]*2)
                outbam = GENBAMNAM(bop)
                samtoolsRT = sp.run('samtools view -h -b -o '+outbam+' '+sam_bam+' '+samtoolsRange,shell=True,stderr=sp.PIPE).stderr.decode('utf-8')
                if 'unknown reference name' in samtoolsRT: #in case there is not 'chr' for chromosome name in bam file
                        sp.run('samtools view -h -b -o '+outbam+' '+sam_bam+' '+samtoolsRange[3:],shell=True)
                MANIPHEAD(outbam) #manipulate bam header
                if os.path.isfile(outbam):
                        sp.run('samtools index '+outbam,shell=True)
                else:
                        print('Error: '+outbam+' is not generaged!')
                        sys.exit(1)
                relBamPath = re.search('tp/(.*)',outbam).group(1)
                URLL.append(url+'&position='+samtoolsRange+'&hlregion='+highLightRange+'&bamfile='+sam+','+relBamPath)
        return URLL

###manipulate bam header to remove sample info
def MANIPHEAD(bam):
        sp.run('samtools view -H '+bam+ ' -o '+bam+'.header',shell=True)
        sp.run('sed "/^@PG/d; /^@RG/d" '+bam+'.header >'+bam+'.header.corrected',shell=True)
        sp.run('samtools reheader -P '+bam+'.header.corrected '+bam+' >'+bam+'.header.corrected.bam',shell=True)
        sp.run('mv '+bam+'.header.corrected.bam '+bam,shell=True)
        sp.run('rm -f '+bam+'.header*',shell=True)

#get random bam file name
#make sure bam file name is unique
def GENBAMNAM(bamoutpath):
	curBams = [x for x in os.listdir(bamoutpath) if x.endswith('.bam')]
	bamName = ''.join(random.choices(string.ascii_uppercase+string.digits,k=10))+'.bam'
	if bamName in curBams:
		while True:
			tmpname = ''.join(random.choices(string.ascii_uppercase+string.digits,k=10))+'.bam'
			if not tmpname in curBams:
				bamName = tmpname
				break
	return os.path.join(bamoutpath,bamName)

#define bam slice range
def GETRANGE(a,b=False):
        r = []
        if b:
                ss,st = GETBIG(a,b)
                if (st - ss + 1) <= 10000: #CNV with distance between two point < 10k. final bam slice will contain all reads between 2 points
                        r.append([ss-args.flank,st+args.flank])
                else:
                        r.append([ss-args.flank,ss+args.flank])
                        r.append([st-args.flank,st+args.flank])
        else:
                r.append([a-args.flank,a+args.flank])
        return r

#double check to make sure the position order
#smaller to bigger
def GETBIG(a,b):
        if a < b:
                return a,b
        else:
                return b,a
#parse chromosome name
def PARCHR(c):
        if c[0:3].lower() == 'chr':
                return 'chr'+c[3:]
        else:
                return 'chr'+c

###########
#functions used when --server is specified
#generate links to work on different server
def REPLINK(link,serurl):
	 return serurl+re.search('.*?(/\?.*)',link).group(1)
#extract link1 and/or link2 from variant table and generat new links with different server address
def GENLINK(serverkey,server,inputfile,outputfile):
	fh = open(inputfile)
	header = fh.readline().replace('\n','').split('\t')
	if not 'link1' in header or not 'link2' in header:
		return False
	header.extend([serverkey+'_link1',serverkey+'_link2'])
	out = open(outputfile,'w')
	out.write('\t'.join(header)+'\n')
	l1idx = header.index('link1')
	l2idx = header.index('link2')
	for line in fh:
		l = line.replace('\n','').split('\t')
		links = []
		links.append(REPLINK(l[l1idx],server))
		if l[l2idx]:
			links.append(REPLINK(l[l2idx],server))
		else:
			links.append('')
		out.write('\t'.join(l+links)+'\n')
	fh.close()
	out.close()
	return True


parser = argparse.ArgumentParser(description="slice_bam4pp")
subparsers = parser.add_subparsers(dest='command')

#Command: variant table
varianttable_descript="""
#Parameter: --varianttable=xx --bamtable=yy --bamslicepath=outbampath --flank=500 --sample=sampleHeaderName --chr=chrHeaderName --start=startheaderName --stop=stopHeadername --chr2=chr2headername --pos2=
#Parameter: --genome=hg19/hg38 --output=urlinkFile
#Bamtable has two columns 1. Sample ID, 2: full path to bam
#Flank is optional, default=500
#SNV: require -chr, -start (generate one link)
#CNV: require -chr, -start, -stop (generate two links if span > 10k, otherwise will only generate one link and retrieve reads from two ends)
#SV/fusion: require -chr, -start, -chr2, -pos2 (generate two links)
"""
parser_a = subparsers.add_parser('varianttable',help="generate bam sliced files and url for multiple variants from variant table",description=varianttable_descript,formatter_class=RawTextHelpFormatter)
required = parser_a.add_argument_group('required arguments')
required.add_argument('-v','--vartable',help='variant table')
required.add_argument('-b','--bamtable',help='Bam table with 2 columns: 1. sample ID, 2. full path to bam')
required.add_argument('--bamslicepath',help='output folder for sliced bam file (absolute path; under tp/)')
required.add_argument('-s','--sample',help='the header name of sample in variant table')
required.add_argument('--chr',help='the header name of chromosome in variant table')
required.add_argument('--start',help='the header name of start position in variant table. Position should be 1-based')
required.add_argument('-o','--output',help='output file')
optional = parser_a.add_argument_group('optional arguemnts')
optional.add_argument('--genotyping',help='on the fly genotyping to identify and group reads supporting either mutant or reference allele. False by default',action="store_true",required=False)
optional.add_argument('--ref',help='the header name of reference allele for SNVindel. required if --genotyping is specified',required=False)
optional.add_argument('--alt',help='the header name of mutant allele for SNVindel. required if --genotyping is specified',required=False)
optional.add_argument('--flank',help='flanking region upstream and downstream from variant position. 500 by default',type=int,default=500)
optional.add_argument('--stop',help='the header name of stop position in variant table. Optional and required only for CNV',required=False)
optional.add_argument('--chr2',help='the header name of chromosomeB in variant table. Optional and required only for SV and fusion',required=False)
optional.add_argument('--pos2',help='the header name of postion on chrommosomeB in variant table. Position should be 1-based. Optional and need to provided with --chr2',required=False)
optional.add_argument('-g','--genome',help='genome version. hg19 by default',default='hg19',type=str)

#Command: single variant
singlevariant_descript = """
#Parameter: 
--variant: single variant input as string. SNVindel: chr.pos.ref.alt; CNV: chr.start_pos.stop_pos; svfusion: chra.posa:chrb.posb.
--bampath: absolute path of bam file for single sample.
--genotyping: on the fly genotyping. False by default.
--genome: genome version. hg19 by default.
"""
parser_b = subparsers.add_parser('singlevariant',help="generate bam sliced file and url for single variant",description=singlevariant_descript,formatter_class=RawTextHelpFormatter)
parser_b.add_argument('-v','--variant',help='single variant: chr.pos(SNVindels);chr.pos.ref.alt(SNVindels when realtime genotyping is required); chr.start_pos.stop_pos(CNV); chra.posa:chrb.posb(svfusion)')
parser_b.add_argument('-b','--bampath',help='absolute path to single sample bam file')
parser_b.add_argument('--flank',help='flanking region upstream and downstream from variant position. 500 by default',type=int,default=500)
parser_b.add_argument('--genotyping',help='on the fly genotyping to identify and group reads supporting either mutant or reference allele. False by default.',action="store_true",required=False)
parser_b.add_argument('-g','--genome',help='genome version. hg19 by default',default='hg19',type=str)

#Command: data sharing
datashare_descript = """
#Parameter: 
replace url link host for sharing data on other server including public server
--varianttable: output variant table with columns link1 and link2 at the end
--server: URL link will be made for the specified server (public/test)
	public: https://proteinpaint.stjude.org/
	test: https://pp-int-test.stjude.org/
"""
parser_c = subparsers.add_parser('datashare',help="replace host web for data sharing",description=datashare_descript,formatter_class=RawTextHelpFormatter)
parser_c.add_argument('-v','--varianttable',help='variant table with columns link1 and link2 at the end')
parser_c.add_argument('-o','--output',help='output file')
parser_c.add_argument('--server',help='URL link will be made for the specified server (public/test). The variant table should already have columns of link1 and link2.',required=False)
args = parser.parse_args()


if not args.command:
	parser.print_help()
	sys.exit(1)


####################################3
if args.command == 'varianttable': #variant table
	parmTest = PARMTST(['vartable','bamtable','bamslicepath','sample','chr','start','output'])
	genotypParmTest = GENOTYPDEPTST()
	if not parmTest or not genotypParmTest:
		parser_a.print_help()
		sys.exit(1)
	if args.chr2 and not args.pos2:
		parser_a.error('--chr2 requires --pos2.')
	samtoolsTst = SAMTOOLSTST()
	if not samtoolsTst: #test if samtools if available
		print('Please load samtools using module load command')
		sys.exit(1)
	VARTABLE()
elif args.command == 'singlevariant': #single variant
	parmTest = PARMTST(['variant','bampath'])
	if not parmTest:
		parser_b.print_help()
		sys.exit(1)
	samtoolsTst = SAMTOOLSTST()
	if not samtoolsTst: #test if samtools if available
		print('Please load samtools using module load command')
		sys.exit(1)
	SINGVAR()
elif args.command == 'datashare': #data sharing
	parmTest = PARMTST(['varianttable','output'])
	if not parmTest:
		parser_c.print_help()
		sys.exit(1)
	DATASHARE()
else:
	parser.print_help()
	sys.exit(1)


