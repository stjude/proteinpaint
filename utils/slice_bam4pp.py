#!/usr/bin/python3

import sys,os,re
import argparse
from argparse import RawTextHelpFormatter
import subprocess as sp
import string,random

####function
#generate url links
def GENURL(sam,chra,pstart,bop,pstop=False):
        URLL = []
        sam_bam = BAM[sam]
        ranges = GETRANGE(pstart,pstop)
        for r in ranges:
                samtoolsRange = chra+':'+str(r[0])+'-'+str(r[1])
                highlightPos = str(pstart-1)
                highLightRange = chra+':'+'-'.join([highlightPos]*2)
                bamNam = GENBAMNAM()+'.bam'
                outbam = os.path.join(bop,bamNam)
                samtoolsRT = sp.run('samtools view -h -b -o '+outbam+' '+sam_bam+' '+samtoolsRange,shell=True,stderr=sp.PIPE).stderr.decode('utf-8')
                if 'unknown reference name' in samtoolsRT:
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
def GENBAMNAM():
        bamName = ''.join(random.choices(string.ascii_uppercase+string.digits,k=10))
        if bamName in allBamName:
                while True:
                        tmpname = ''.join(random.choices(string.ascii_uppercase+string.digits,k=10))
                        if not tmpname in allBamName:
                                bamName = tmpname
                                break
        allBamName.add(bamName)
        return bamName

#define bam slice range
def GETRANGE(a,b=False):
        r = []
        if b:
                ss,st = GETBIG(a,b)
                if (st - ss + 1) <= 10000: #CNV with distance between two point < 10k. 2 means that final bam reads will contain all between 2 points
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

script_descript="""
#Python script, put at tp/utils/slice_bam.py
#Parameter: --varianttable=xx --bamtable=yy --bampath=outbampath -flank=500 --sample=sampleHeaderName --chr=chrHeaderName --start=startheaderName --stop=stopHeadername --chr2=chr2headername --pos2=
#Parameter: --genome=hg19/hg38 --output=urlinkFile
#Bamtable has two columns 1. Sample ID, 2: full path to bam
#Flank is optional, default=500
#SNV: require -chr, -start (generate one link)
#CNV: require -chr, -start, -stop (generate two links if span>10k, otherwise will only generate one link and retrieve reads from two ends)
#SV/fusion: require -chr, -start, -chr2, -pos2 (generate two links)
"""

parser = argparse.ArgumentParser(description=script_descript,formatter_class=RawTextHelpFormatter,add_help=False)
required = parser.add_argument_group('required arguments')
required.add_argument('-v','--varianttable',help='variant table')
required.add_argument('-b','--bamtable',help='Bam table with 2 columns: 1. sample ID, 2. full path to bam')
required.add_argument('--bampath',help='the absolute path pointing to somewhere under tp/ where you want to put the sliced bam file')
required.add_argument('-s','--sample',help='the header name of sample in variant table')
required.add_argument('--chr',help='the header name of chromosome in variant table')
required.add_argument('--start',help='the header name of start position in variant table')
required.add_argument('-o','--output',help='output file')
optional = parser.add_argument_group('optional arguemnts')
optional.add_argument('--flank',help='flanking region upstream and downstream from variant position. 500 by default',type=int,default=500)
optional.add_argument('--stop',help='the header name of stop position in variant table. Optional and required only for CNV',required=False)
optional.add_argument('--chr2',help='the header name of chromosomeB in variant table. Optional and required only for SV and fusion',required=False)
optional.add_argument('--pos2',help='the header name of postion on chrommosomeB in variant table. Optional and need to provided with --chr2',required=False)
optional.add_argument('-g','--genome',help='genome version. hg19 by default',default='hg19',type=str)
optional.add_argument('-h','--help',action='help',help='show this help message and exit')
args = parser.parse_args()

if len(sys.argv) == 1:
        parser.print_help()
        sys.exit(1)

#########################
#required parameter check:
for p in [args.varianttable,args.bamtable,args.chr,args.start,args.output]:
        if not p:
                parser.print_help()
                parser.error('required parameters need to be provided')
if args.chr2 and not args.pos2:
        parser.error('--chr2 requires --pos2.')


#########################
#test if samtools is available
samtools_RT = sp.run('samtools',shell=True,stderr=sp.PIPE).stderr.decode('utf-8')
if 'command not found' in samtools_RT:
        print('Please load samtools using module load command')
        sys.exit(1)


#########################
#URL
url = 'https://ppr.stjude.org/?genome='+args.genome+'&block=1'


#########################
###bam table
BAM = {x.strip().split('\t')[0]:x.strip().split('\t')[1] for x in open(args.bamtable)}
bamOutPath = args.bampath
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

#output file
out = open(args.output,'w')

#generate url and sliced bam file
fh = open(args.varianttable)
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
        if posStop:
                URLL.extend(GENURL(sample,chra,posStar,bamOutPath,pstop=int(posStop)))
        else:
                URLL.extend(GENURL(sample,chra,posStar,bamOutPath))
        if args.chr2:
                chrb = L[rHeaderIdx[chrbColumn]]
                if chrb:
                        chrb = PARCHR(chrb)
                        posb = int(L[rHeaderIdx[posbColumn]])
                        URLL.extend(GENURL(sample,chrb,posb,bamOutPath))
        out.write('\t'.join(L+URLL)+'\n')
fh.close()

