#!/usr/bin/python

"""CDD_extraction.py: Extract the CDD information for any species from NCBI refseq protein database and fromat the CDD file to be used for proteinpaint"""

__author__    =  "Jian  Wang"
__copyrith__ = "Copyright 2017, St.Jude" 


import re,os,gzip,sys
from optparse import OptionParser


parser = OptionParser()

parser.add_option("-p","--path", dest = "PATH", help="The path to refseq protein database downloaded from NCBI", metavar = "Protein_Path")
parser.add_option("-s", "--species", dest="SPECIES", help="Latin name of organism you are working on\
							   There should be a '_' between Latin name, like Homo_sapiens", metavar = "Name_latin",default="Homo sapiens")

(options,args) = parser.parse_args()

#If no options were given by the user, print help and exit
if len(sys.argv) == 1:
	parser.print_help()
	exit(0)

if options.SPECIES:
	ORG = ' '.join(options.SPECIES.split('_'))
else:
	error("name of organism is required")	

if options.PATH:
	PATH = options.PATH
else:
	error("path to the protein database is required")



#Define functions

def GET_note(): #Get full line of description
	global NN_R
	NN_R = NN_R + " " +fh.readline().decode("utf-8").strip()
	if re.search("\".*\"",NN_R):
		return 1
	else:
		GET_note()

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
		pass

def GET_coord(): #GET coordinate for site_order use only
	global COO
	COO = COO + fh.readline().decode("utf-8").strip()
	if re.search("Site\s+order\(.*\)",COO):
		return 1
	else:
		GET_coord()

def GET_ST():#GET coordinate for site_order use only
	global S_T
	S_T = S_T + " " + fh.readline().decode("utf-8").strip()
	if re.search("/site_type=\".*\"",S_T):
		return 1
	else:
		GET_ST()







#Define GLOBAL var

PID = "" #Protein ID
MID = "" #mRNA ID
CYCLE = False #Control var to make sure get human info
COORD = "" #CDD coordinate
RN = ""	#Region name
NN_R = "" #...
Dsc = "" #Description of CDD
CDD = "" #CDD ID
EVI = "" #CDD evidence
P_DIC = {} #DIC for current script...


COO = "" #Tem full coordinate
S_T = ""
P_site_DIC = {}
print(ORG)

#Extract CDD info for both region and site

for Pfile in os.listdir(PATH):
	if Pfile.endswith("gz"):
		file = os.path.join(PATH,Pfile)
		fh = gzip.open(file,'rb')
		fileout_region = re.search("(.*)\.protein",file).groups()[0]+".region"
		fileout_site = re.search("(.*)\.protein",file).groups()[0]+".site"
		fout_site = open(fileout_site,'w')
		fout = open(fileout_region,'w')
		for line in fh:
			i = line.decode("utf-8")
			if re.search("LOCUS\s+(N|X)P",i):
				if MID:
					if "@" in P_DIC[MID]:
						fout.write(MID+"\t"+P_DIC[MID]+"\n")
					else:
						pass
					if "@" in P_site_DIC[MID]:
						fout_site.write(MID+"\t"+P_site_DIC[MID]+"\n")
					else:
						pass
				PID = ""
				MID = ""
				CYCLE = False
				COORD = ""
				RN = ""
				Dsc = ""
				CDD = ""
				EVI = ""
				P_DIC = {}
				P_site_DIC = {}
				PID = re.search("LOCUS\s+((N|X)P_\d+)\s",i).groups()[0]
			elif re.search("LOCUS\s+YP",i):
				if MID:
					if "@" in P_DIC[MID]:
						fout.write(MID+"\t"+P_DIC[MID]+"\n")
					else:
						pass
					if "@" in P_site_DIC[MID]:
						fout_site.write(MID+"\t"+P_site_DIC[MID]+"\n")
					else:
						pass
				PID = ""
				MID = ""
				CYCLE = False
				COORD = ""
				RN = ""
				Dsc = ""
				CDD = ""
				EVI = ""
				P_DIC = {}
				P_site_DIC = {}
				continue
			elif re.search("DBSOURCE\s",i):
				if re.search("DBSOURCE\s+.+((N|X)M_\d+)",i):
					MID = re.search("DBSOURCE\s+.+((N|X)M_\d+)",i).groups()[0]
					P_DIC[MID] = PID
					P_site_DIC[MID] = PID
				else:
					continue
			elif re.search("SOURCE\s+(.*)\s+\(",i):
				if re.search("SOURCE\s+(.*)\s+\(",i).groups()[0] == ORG:
					CYCLE = True
				else:
					CYCLE = False
					PID = ""
					MID = ""
					P_DIC = {}
					P_site_DIC = {}
					continue
			elif re.search("\s+Region\s+",i) and CYCLE:
				if re.search("Region\s+<?(\d+)\.\.>?(\d+)\s",i):
					COORD = re.search("Region\s+<?(\d+)\.\.>?(\d+)\s",i).groups()[0]+"@"+re.search("Region\s+<?(\d+)\.\.>?(\d+)\s",i).groups()[1]
				else:
					continue
				N_R = fh.readline().decode("utf-8")
				if re.search("/region_name=\".*\"",N_R):
					#print(MID)
					RN = re.search("/region_name=\"(.*)\"",N_R).groups()[0]
				else:
					COORD = ""
					continue
				NN_R = fh.readline().decode("utf-8").strip()
				if re.search("/note=",NN_R):
					if re.search("\".*\"",NN_R):
						if not re.search(";",NN_R):
							Dsc = re.search("/note=\"(.*)\"",NN_R).groups()[0]
							db_xref = fh.readline().decode("utf-8").strip()
							if re.search("/db_xref=",db_xref):
								CDD = re.search("/db_xref=\"(CDD:\d+)\"",db_xref).groups()[0]
								content = RN + "@" + Dsc + "@" + COORD + "@" + CDD
								if not content in P_DIC[MID]:
									P_DIC[MID] = P_DIC[MID] + "\t" + content
								else:
									print("duplicated data",content)
									continue
							else:
								print(MID + "no CDD found")
								COORD = ""
								RN = ""
								Dsc = ""
								continue
						else:
							F_P = re.search("/note=\"(.*);",NN_R).groups()[0].strip()
							S_P = re.search("/note=\".*;(.*)\"",NN_R).groups()[0].strip()
							Dsc = F_P
							if GET_evi(S_P):
								EVI = GET_evi(S_P)
							else:
								EVI = ""
							db_xref = fh.readline().decode("utf-8").strip()
							if re.search("/db_xref=",db_xref):
								CDD = re.search("/db_xref=\"(CDD:\d+)\"",db_xref).groups()[0]
								if EVI:
									content = RN + "@" + Dsc + "@" + COORD + "@" + EVI + "@" + CDD
									if not content in P_DIC[MID]:
										P_DIC[MID] = P_DIC[MID] + "\t" + content
									else:
										print("duplicated data",content)
										continue
								else:
									content = RN + "@" + Dsc + "@" + COORD + "@"  + CDD
									if not content in P_DIC[MID]:
										P_DIC[MID] = P_DIC[MID] + "\t" + content
									else:
										print("duplicated data",content)
										continue
							else:
								COORD = ""
								RN = ""
								Dsc = ""
								EVI = ""
								continue
					else:
						GET_note()
						if re.search("\".*\"",NN_R):
							if not re.search(";",NN_R):
								Dsc = re.search("/note=\"(.*)\"",NN_R).groups()[0]
								db_xref = fh.readline().decode("utf-8").strip()
								if re.search("/db_xref=",db_xref):
									CDD = re.search("/db_xref=\"(CDD:\d+)\"",db_xref).groups()[0]
									content = RN + "@" + Dsc + "@" + COORD + "@" + CDD
									if not content in P_DIC[MID]:
										P_DIC[MID] = P_DIC[MID] + "\t" + content
									else:
										print("duplicated data",content)
										continue
								else:
									print(MID + "no CDD found")
									COORD = ""
									RN = ""
									Dsc = ""
									continue
							else:
								F_P = re.search("/note=\"(.*);",NN_R).groups()[0].strip()
								S_P = re.search("/note=\".*;(.*)\"",NN_R).groups()[0].strip()
								Dsc = F_P
								if GET_evi(S_P):
									EVI = GET_evi(S_P)
								else:
									EVI = ""
								db_xref = fh.readline().decode("utf-8").strip()
								if re.search("/db_xref=",db_xref):
									CDD = re.search("/db_xref=\"(CDD:\d+)\"",db_xref).groups()[0]
									if EVI:
										content = RN + "@" + Dsc + "@" + COORD + "@" + EVI + "@" + CDD
										if not content in P_DIC[MID]:
											P_DIC[MID] = P_DIC[MID] + "\t" + content
										else:
											print("duplicated data",content)
											continue
									else:
										content = RN + "@" + Dsc + "@" + COORD + "@"  + CDD
										if not content in P_DIC[MID]:
											P_DIC[MID] = P_DIC[MID] + "\t" + content
										else:
											print("duplicated data",content)
											continue
								else:
									COORD = ""
									RN = ""
									Dsc = ""
									EVI = ""
									continue
				
						else:
							continue	
				else:
					COORD = ""
					RN = ""
			elif re.search("Site\s+order\(",i) and CYCLE:
				if re.search("Site\s+order\(.*\)",i):
					COORD = re.search("Site\s+order\((.*)\)",i).groups()[0]
				else:
					COO = i.strip()
					GET_coord()
					COORD = re.search("Site\s+order\((.*)\)",COO).groups()[0]
					COO = ""
				N_R = fh.readline().decode("utf-8")
				if re.search("/site_type=\".*\"",N_R):
					RN = re.search("/site_type=\"(.*)\"",N_R).groups()[0]
				elif re.search("/site_type=\"",N_R):
					S_T = N_R.strip()
					RN = re.search("/site_type=\"(.*)\"",S_T).groups()[0]
					S_T = ""
				else:
					print(N_R)
					COORD = ""
					continue
				NN_R = fh.readline().decode("utf-8").strip()
				if re.search("/note=",NN_R):
					if re.search("\".*\"",NN_R):
						Dsc = re.search("/note=\"(.*)\"",NN_R).groups()[0]
						db_xref = fh.readline().decode("utf-8").strip()
						if re.search("/db_xref=",db_xref):
							CDD = re.search("/db_xref=\"(CDD:\d+)\"",db_xref).groups()[0]
							W_Z = COORD.split(',')
							for co in W_Z:
								if '.' in co:
									co = co.replace('..','@')
									content = RN + "@" + Dsc + "@" + co + "@" + CDD
									if not content in P_site_DIC[MID]:
										P_site_DIC[MID] = P_site_DIC[MID] + "\t" + content
									else:
										print("duplicated data",content)
										continue
								else:
									content = RN + "@" + Dsc + "@" + co + "@" + co + "@" + CDD
									if not content in P_site_DIC[MID]:
										P_site_DIC[MID] = P_site_DIC[MID] + "\t" + content
									else:
										print("duplicated data",content)
										continue
						else:
							print(MID + "no CDD found")
							COORD = ""
							RN = ""
							Dsc = ""
							continue
					elif re.search("\"",NN_R):
						GET_note()
						Dsc = re.search("/note=\"(.*)\"",NN_R).groups()[0]
						db_xref = fh.readline().decode("utf-8").strip()
						if re.search("/db_xref=",db_xref):
							CDD = re.search("/db_xref=\"(CDD:\d+)\"",db_xref).groups()[0]
							W_Z = COORD.split(',')
							for co in W_Z:
								if '.' in co:
									co = co.replace('..','@')
									content = RN + "@" + Dsc + "@" + co + "@" + CDD
									if not content in P_site_DIC[MID]:
										P_site_DIC[MID] = P_site_DIC[MID] + "\t" + content
									else:
										print("duplicated data",content)
										continue
								else:
									content = RN + "@" + Dsc + "@" + co + "@" + co + "@" + CDD
									if not content in P_site_DIC[MID]:
										P_site_DIC[MID] = P_site_DIC[MID] + "\t" + content
									else:
										print("duplicated data",content)
										continue
						else:
							print(MID + "no CDD found")
							COORD = ""
							RN = ""
							Dsc = ""
							continue
				else:
					COORD = ""
					RN=""
			elif re.search("Site\s+\d+",i) and CYCLE:
				if '..' in i:
					COORD = re.search("Site\s+(\d+\.\.\d+)",i).groups()[0].replace('..','@')
				else:
					COORD = re.search("Site\s+(\d+)",i).groups()[0]
				N_R = fh.readline().decode("utf-8")
				if re.search("/site_type=\".*\"",N_R):
					RN = re.search("/site_type=\"(.*)\"",N_R).groups()[0]
				elif re.search("/site_type=\"",N_R):
					S_T = N_R.strip()
					RN = re.search("/site_type=\"(.*)\"",S_T).groups()[0]
					S_T = ""
				else:
					print(N_R)
					COORD = ""
					continue
				NN_R = fh.readline().decode("utf-8").strip()
				if re.search("/note=",NN_R):
					if re.search("\".*\"",NN_R):
						Dsc = re.search("/note=\"(.*)\"",NN_R).groups()[0]
						db_xref = fh.readline().decode("utf-8").strip()
						if re.search("/db_xref=",db_xref):
							CDD = re.search("/db_xref=\"(CDD:\d+)\"",db_xref).groups()[0]
							if '@' in COORD:
								content = RN + "@" + Dsc + "@" + COORD + "@" + CDD
								if not content in P_site_DIC[MID]:
									P_site_DIC[MID] = P_site_DIC[MID] + "\t" + content
								else:
									print("duplicated data",content)
									continue
							else:
								content = RN + "@" + Dsc + "@" + COORD + "@" + COORD + "@" + CDD
								if not content in P_site_DIC[MID]:
									P_site_DIC[MID] = P_site_DIC[MID] + "\t" + content
								else:
									print("duplicated data",content)
									continue
						else:
							print(MID + "no CDD found")
							COORD = ""
							RN = ""
							Dsc = ""
							continue
					elif re.search("\"",NN_R):
						GET_note()
						Dsc = re.search("/note=\"(.*)\"",NN_R).groups()[0]
						db_xref = fh.readline().decode("utf-8").strip()
						if re.search("/db_xref=",db_xref):
							CDD = re.search("/db_xref=\"(CDD:\d+)\"",db_xref).groups()[0]
							if '@' in COORD:
								content = RN + "@" + Dsc + "@" + COORD + "@" + CDD
								if not content in P_site_DIC[MID]:
									P_site_DIC[MID] = P_site_DIC[MID] + "\t" + content
								else:
									print("duplicated data",content)
									continue
							else:
								content = RN + "@" + Dsc + "@" + COORD + "@" + COORD + "@" + CDD
								if not content in P_site_DIC[MID]:
									P_site_DIC[MID] = P_site_DIC[MID] + "\t" + content
								else:
									print("duplicated data",content)
									continue
						else:
							print(MID + "no CDD found")
							COORD = ""
							RN = ""
							Dsc = ""
							continue
				else:
					COORD = ""
					RN = ""
			else:
				continue
		#os.remove(Pfile)
		if MID and "@" in P_DIC[MID]:
			fout.write(MID+"\t"+P_DIC[MID])
		else:
			pass
		if MID and "@" in P_site_DIC[MID]:
			fout_site.write(MID+"\t"+P_site_DIC[MID])
		else:
			pass
		print("file"+file+"is done!")
		fh.close()
		fout.close()
		fout_site.close()
		if os.path.getsize(fileout_region) == 0:
			os.remove(fileout_region)
		else:
			pass
		if os.path.getsize(fileout_site) == 0:
			os.remove(fileout_site)
		else:
			pass
	else:
		continue
	

del P_DIC
del P_site_DIC

#Combine all CDD file and Site file into one file

Fin_DIC_region = {}
Fin_DIC_site = {}

for Ffile in os.listdir(PATH):
	if Ffile.endswith(".region"):
		file = os.path.join(PATH,Ffile)
		fh = open(file)
		for line in fh:
			LList = line.strip().split('\t')
			ID = LList[0]
			Cont = LList[2:]
			Cont = list(set(Cont))
			if ID not in Fin_DIC_region:
				Fin_DIC_region[ID] = '\t'.join(Cont)
			else:
				for i in Cont:
					if i in Fin_DIC_region[ID]:
						Cont.remove(i)
					else:
						pass
				if Cont:
					Fin_DIC_region[ID] = Fin_DIC_region[ID]+"\t"+'\t'.join(Cont)
				else:
					pass
		os.remove(file)
	elif Ffile.endswith(".site"):
		file = os.path.join(PATH,Ffile)
		fh = open(file)
		for line in fh:
			LList = line.strip().split('\t')
			ID = LList[0]
			Cont = LList[2:]
			Cont = list(set(Cont))
			if ID not in Fin_DIC_site:
				Fin_DIC_site[ID] = '\t'.join(Cont)
			else:
				for i in Cont:
					if i in Fin_DIC_site[ID]:
						Cont.remove(i)
					else:
						pass
				if Cont:
					Fin_DIC_site[ID] = Fin_DIC_site[ID]+"\t"+'\t'.join(Cont)
				else:
					pass
		os.remove(file)
	else:
		continue




SINGLE_OUT_Region = open("Single_out_region.txt",'w')
SINGLE_OUT_Site = open("Single_out_site.txt",'w')

for DI in Fin_DIC_region:
	SINGLE_OUT_Region.write(DI+"\t"+Fin_DIC_region[DI]+"\n")
SINGLE_OUT_Region.close()

for SDI in Fin_DIC_site:
	SINGLE_OUT_Site.write(SDI+"\t"+Fin_DIC_site[SDI]+'\n')
SINGLE_OUT_Site.close()

del Fin_DIC_region
del Fin_DIC_site


#Remove CDD ID for Site which locate whith region area and have same CDD id with this region

REG_DIC = {}
REF = open("Single_out_region.txt")
for i in REF:
	RLIS = i.strip().split('\t')
	rang = []
	cdid =[]
	for ele in RLIS[1:]:
		tem_li = ele.split('@')
		rang.append("-".join(map(str,tem_li[2:4])))
		cdid.append(tem_li[-1])
	REG_DIC[RLIS[0]] = [rang,cdid]
REF.close()





SEF = open("Single_out_site.txt")
SOUT = open("New_Single_out_site.txt",'w')
SEG_DIC={}
for i in SEF:
	SLIS = i.strip().split('\t')
	new_SLIS_con = []
	if SLIS[0] in REG_DIC:
		for sele in SLIS[1:]:
			tem_lis = sele.split('@')
			for R_ran in range(len(REG_DIC[SLIS[0]][0])):
				RRLIS = REG_DIC[SLIS[0]][0][R_ran].split('-')
				if int(tem_lis[2]) >= int(RRLIS[0]) and int(tem_lis[3]) <= int(RRLIS[1]) and tem_lis[-1] == REG_DIC[SLIS[0]][1][R_ran]:
					tem_lis.pop()
					#if SLIS[0] in SEG_DIC:
					#	SEG_DIC[SLIS[0]] = SEG_DIC[SLIS[0]]+"\t"+"@".join(tem_lis)
					#else:
					#	SEG_DIC[SLIS[0]] = "@".join(tem_lis)
					#new_SLIS_con.append("@".join(tem_lis))
					continue
				else:
					continue
			new_SLIS_con.append("@".join(tem_lis))
		#print(new_SLIS_con)
		SEG_DIC[SLIS[0]] = "\t".join(new_SLIS_con)
	else:
		SEG_DIC[SLIS[0]] = "\t".join(SLIS) 
			
for sid in SEG_DIC:
	SOUT.write(sid+"\t"+SEG_DIC[sid]+"\n")
SEF.close()
SOUT.close()

#Remove nonuseful var and file
del REG_DIC
del SEG_DIC
os.remove("Single_out_site.txt")



#Combine and output formated DATA

FDIC = {}
FR = open("Single_out_region.txt")
FS = open("New_Single_out_site.txt")

for fr in FR:
	nfr = fr.strip().split('\t')
	FDIC[nfr[0]] = '\t'.join(nfr[1:])
FR.close()

for fs in FS:
	nfs = fs.strip().split('\t')
	if nfs[0] in FDIC:
		FDIC[nfs[0]] = FDIC[nfs[0]] + "\t" + '\t'.join(nfs[1:])
	else:
		FDIC[nfs[0]] = '\t'.join(nfs[1:])
FS.close()


#OUTPUT formated data

MISSOUT = open("Missed"+"_"+options.SPECIES,'w')
FINAL_OUT = open(options.SPECIES+"_CDD.Json",'w')
for cdd in FDIC:
	A_CON = FDIC[cdd].split('\t')
	for i in A_CON:
		indiv_cdd = i.split('@')
		if len(indiv_cdd) == 4:
			FINAL_OUT.write(cdd+"\t"+"{"+"\"name\":"+"\""+indiv_cdd[0]+"\","+"\"description\":"+"\""+indiv_cdd[1]+"\","+"\"start\":"+str(indiv_cdd[2])+","+"\"stop\":"+str(indiv_cdd[3])+"}\n")
		elif len(indiv_cdd) == 5:
			LAST = indiv_cdd[4].split(':')
			FINAL_OUT.write(cdd+"\t"+"{"+"\"name\":"+"\""+indiv_cdd[0]+"\","+"\"description\":"+"\""+indiv_cdd[1]+"\","+"\"start\":"+str(indiv_cdd[2])+","+"\"stop\":"+str(indiv_cdd[3])+","+"\"CDD\":"+"\""+str(LAST[1])+"\"}\n")
		elif len(indiv_cdd) == 6:
			LAST1 = indiv_cdd[4].split(':')
			LAST2 = indiv_cdd[5].split(':')
			FINAL_OUT.write(cdd+"\t"+"{"+"\"name\":"+"\""+indiv_cdd[0]+"\","+"\"description\":"+"\""+indiv_cdd[1]+"\","+"\"start\":"+str(indiv_cdd[2])+","+"\"stop\":"+str(indiv_cdd[3])+","+"\""+LAST1[0]+"\":"+"\""+str(LAST1[1])+"\","+"\"CDD\":"+"\""+str(LAST2[1])+"\"}\n")
		else:
			MISSOUT.write(cdd)

MISSOUT.close()
FINAL_OUT.close()
