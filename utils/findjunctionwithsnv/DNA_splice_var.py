#!/usr/bin/python

from optparse import OptionParser
import sys,gzip,re,os,json


if __name__ == '__main__':
	parser = OptionParser()
	parser.add_option("-r", "--ref_anno", dest="RefAnno", help="Provide your genome annotation file in json format", metavar="RefANNO")
	parser.add_option("-d", "--database", dest="database", help="Provide the prebuilt database instead of using json annotation file.\
							If both \"-r\" and \"-d\" provided, database will be used by default", metavar="DATABASE")
	parser.add_option("-s", "--SNV_vcf", dest="snvs", help="Input VCF file", metavar="FILE")	
	parser.add_option("-e", "--INEXON" , type = "int", dest = "NOEXON", help="how many base you want to check in exon beyond the splicing site", default = 2)
	parser.add_option("-i","--ININTRON", type = "int", dest = "NOINTRON" , help = "how many base you want to check in intron region beyond the splcing site", default = 0)
	parser.add_option("-b", "--BAM_PATH", dest = "BAM_PATH", help="the path where the bam files can be found", metavar="BAM_PATH")
	parser.add_option("-g", "--GENOME_PATH", dest = "G_P", help="the path where genome fasta file can be detected", metavar="GENOMESEQ")
	parser.add_option("-j", "--GATK", dest = "gatk", help="specify the executable GATK", metavar="String",default="GenomeAnalysisTK.jar")
	(options,args) = parser.parse_args()
	
	
	#if no options were given by the user, print help and exit
	if len(sys.argv) == 1:
		parser.print_help()
		exit(0)

	#Check parameters

	if options.RefAnno is not None and options.database is not None:
		Json_Database = os.path.expanduser(options.database)
	elif options.RefAnno is not None:
		Json_ref = os.path.expanduser(options.RefAnno)
	elif options.database is not None:
		Json_Database = os.path.expanduser(options.database)
	else:	
		error("Either Json annotation file or prebuilte database file shoule be  specified using \"-r\" or \"-d\"")

	if options.snvs:
		vcf_file = options.snvs
	else:
		error("You should provide VCF file")
	if options.NOEXON:
		ex_ck = options.NOEXON
	else:
		ex_ck = 0
		print("SNVs in exons will be skipped")
	if options.NOINTRON:
		in_ck = options.NOINTRON
	else:
		in_ck = 0
		print("SNVs in introns will be skipped")

	if not options.BAM_PATH:
		error("You must provide the path to bam files")
	else:
		pass
	if not options.G_P:
		error("Genome fasta file path must be provided")
	else:
		pass

	#____________________________________________________________________
	#Database building
	
	if 'Json_ref' in globals():
		GENE = {}
		TSS = {}
		if Json_ref.endswith(".gz"):
			anno_fh = gzip.open(Json_ref,'rb')
		else:
			anno_fh = open(Json_ref)
		for anno_line in anno_fh:
			if isinstance(anno_line,str):
				gene = anno_line.split('\t')
			else:
				gene = anno_line.decode("utf-8").split('\t')
			if re.search("name\":\"(.*?)\"",gene[3]):
				gene_name = re.search("name\":\"(.*?)\"",gene[3]).groups()[0]
			else:
				continue
			if gene_name in GENE and gene[0] == GENE[gene_name][1]:
				old_ex = GENE[gene_name][0]
				for n_ex in re.search("exon\":\[(.*?)\]\],\"",gene[3]).groups()[0].split('],'):
					if n_ex in old_ex:
						continue
					else:
						old_ex = old_ex + "," + n_ex+"]"
				GENE[gene_name] = [old_ex,gene[0]]
				if min(sorted(list(map(int,re.sub("(\[|\])",'',re.search("exon\":\[(.*?)\],\"",gene[3]).groups()[0]).split(','))))) in TSS[gene_name]:
					pass
				else:
					TSS[gene_name].append(min(sorted(list(map(int,re.sub("(\[|\])",'',re.search("exon\":\[(.*?)\],\"",gene[3]).groups()[0]).split(','))))))
				if max(sorted(list(map(int,re.sub("(\[|\])",'',re.search("exon\":\[(.*?)\],\"",gene[3]).groups()[0]).split(','))))) in TSS[gene_name]:
					pass
				else:
					TSS[gene_name].append(max(sorted(list(map(int,re.sub("(\[|\])",'',re.search("exon\":\[(.*?)\],\"",gene[3]).groups()[0]).split(','))))))
			elif gene_name in GENE and gene[0] != GENE[gene_name][1]:
				if (gene_name + "_" + gene[0]) not in  GENE and 'exon' in gene[3]:
					if re.search("exon\":\[(.*?)\]\],\"",gene[3]):
						new_id = gene_name + "_" + gene[0]
						GENE[new_id] = [re.search("exon\":\[(.*?)\],\"",gene[3]).groups()[0],gene[0]]
						TSS[new_id] = [min(sorted(list(map(int,re.sub("(\[|\])",'',re.search("exon\":\[(.*?)\],\"",gene[3]).groups()[0]).split(','))))),max(sorted(list(map(int,re.sub("(\[|\])",'',re.search("    exon\":\[(.*?)\],\"",gene[3]).groups()[0]).split(',')))))]
						print(new_id,"has same gene name on other chromosome")
					else:
						print("can not extract exon info",new_id)
				elif (gene_name + "_" + gene[0]) in  GENE and 'exon' in gene[3]:
					old_ex = GENE[gene_name + "_" + gene[0]][0]
					for n_ex in re.search("exon\":\[(.*?)\]\],\"",gene[3]).groups()[0].split('],'):
						if n_ex in old_ex:
							continue
						else:
							old_ex = old_ex + "," + n_ex+"]"
					GENE[gene_name + "_" + gene[0]] = [old_ex,gene[0]]
					if min(sorted(list(map(int,re.sub("(\[|\])",'',re.search("exon\":\[(.*?)\],\"",gene[3]).groups()[0]).split(','))))) in TSS[gene_name + "_" + gene[0]]:
						pass
					else:
						TSS[gene_name + "_" + gene[0]].append(min(sorted(list(map(int,re.sub("(\[|\])",'',re.search("exon\":\[(.*?)\],\"",gene[3]).groups()[0]).split(','))))))
					if max(sorted(list(map(int,re.sub("(\[|\])",'',re.search("exon\":\[(.*?)\],\"",gene[3]).groups()[0]).split(','))))) in TSS[gene_name + "_" + gene[0]]:
						pass
					else:
						TSS[gene_name + "_" + gene[0]].append(max(sorted(list(map(int,re.sub("(\[|\])",'',re.search("exon\":\[(.*?)\],\"",gene[3]).groups()[0]).split(','))))))
				else:
					print("no exon for___",gene_name)
			else:
				if 'exon' in gene[3]:
					if re.search("exon\":\[(.*?)\],\"",gene[3]):
						if re.search("exon\":\[(.*?)\],\"",gene[3]).groups()[0].count('[') <= 1:
							continue
						else:
							GENE[gene_name] = [re.search("exon\":\[(.*?)\],\"",gene[3]).groups()[0],gene[0]]
							TSS[gene_name] = [min(sorted(list(map(int,re.sub("(\[|\])",'',re.search("exon\":\[(.*?)\],\"",gene[3]).groups()[0]).split(','))))),max(sorted(list(map(int,re.sub("(\[|\])",'',    re.search("exon\":\[(.*?)\],\"",gene[3]).groups()[0]).split(',')))))]
					else:
						print("can not extract exon info",gene_name)
				else:
					print("no exon for",gene_name)
		anno_fh.close()

		#Transfer database formate
		CHRO_gene = {}
		for geneinfo in GENE:
			chron = re.search("chr(.*)",GENE[geneinfo][1]).groups()[0]
			if chron in CHRO_gene:
				CHRO_gene[chron].append([GENE[geneinfo][0],geneinfo])
			else:
				CHRO_gene[chron] = [[GENE[geneinfo][0],geneinfo]]
		del GENE
		Anno_Database = [CHRO_gene,TSS]
		print("Storing database")
		with open("Database_gene.json",'w') as fp:
			json.dump(Anno_Database,fp)
		del Anno_Database
	else:
		with open(Json_Database,'r') as fp:
			Anno_Database = json.load(fp)
		CHRO_gene = Anno_Database[0]
		TSS = Anno_Database[1]
		del Anno_Database



	#_____________________________________________________________________________________
	#Extract SNVs which locate around splicing site
	vcf_fh = open(vcf_file)
	C_F_N = re.search("(.*?)\.",options.snvs).groups()[0]
	vcf_out = open(C_F_N+"VCF_OUT",'w')
	os.system("samtools view -H " + options.BAM_PATH + C_F_N + ".bam  >"+C_F_N+"_header")
	for vcf_line in vcf_fh:
		if re.search("^#",vcf_line):
			continue
		else:
			vcf_l = vcf_line.strip().split('\t')
			CHR = vcf_l[0]
			chr_p = vcf_l[1]
			Che_Poi = True
			ex_l = 0
			ex_r = 0
			g_n = ""
			snv_po = ""
			snv_tss = "N"
			MUT = vcf_l[4]
			WIL = vcf_l[3]
			SNV = CHR+"-"+chr_p+"-"+WIL+"-"+MUT
			if CHR in CHRO_gene:
				for e_g in CHRO_gene[CHR]:
					for i in re.sub("\[|\]",'',re.sub("],","]\t",e_g[0])).split('\t'):
						EX_ed = i.split(',')
						if (int(EX_ed[0])-in_ck+1) <= int(chr_p) <= (int(EX_ed[0]) + ex_ck):
							ex_l = int(EX_ed[0]) + 1
							ex_r = int(EX_ed[1])
							g_n = e_g[1]
							snv_po = "L"
							Che_Poi = False
							if int(EX_ed[0]) in TSS[e_g[1]]:
								#vcf_out.write(vcf_line.strip()+"\t"+EX_ed[0]+"\t"+EX_ed[1]+"\t"+e_g[1]+"\tY\tL\n")
								snv_tss = "Y"
								#Che_Poi = False
							else:
								pass
								#vcf_out.write(vcf_line.strip()+"\t"+EX_ed[0]+"\t"+EX_ed[1]+"\t"+e_g[1]+"\tN\tL\n")
								#Che_Poi = False
						elif (int(EX_ed[1]) - ex_ck+1) <= int(chr_p) <= (int(EX_ed[1]) + in_ck):
							ex_l = int(EX_ed[0]) + 1
							ex_r = int(EX_ed[1])
							g_n = e_g[1]
							snv_po = "R"
							Che_Poi = False
							if int(EX_ed[1]) in TSS[e_g[1]]:
								#vcf_out.write(vcf_line.strip()+"\t"+EX_ed[0]+"\t"+EX_ed[1]+"\t"+e_g[1]+"\tY\tR\n")
								snv_tss = "Y"
								#Che_Poi = False
							else:
								pass
								#vcf_out.write(vcf_line.strip()+"\t"+EX_ed[0]+"\t"+EX_ed[1]+"\t"+e_g[1]+"\tN\tR\n")
								#Che_Poi = False
						else:
							continue
								
					if not Che_Poi:
						break
			else:
				print("No chromosome record for "+CHR+chr_p)									

			#vcf_fh.close()
			#vcf_out.close()

			#_______________________________________________________________________________
			#Counting of Spliced & nonspliced reads, as well as reads number supporting SNVs
			if ex_l and ex_r and snv_po:
				SAM_F = CHR+"_"+chr_p+"_"+MUT
				os.system("samtools view " + options.BAM_PATH +re.search("(.*?)\.",options.snvs).groups()[0] + ".bam " +CHR+":"+chr_p+"-"+chr_p+" >"+SAM_F+".sam")
	
				#Prepare header file for sam file
				HD = open(C_F_N+"_header")
				H_OUT = open(SAM_F+"_header",'w')
				for header in HD:
					if re.search("^@HD",header):
						H_OUT.write(header)
					elif re.search("^@SQ\tSN:"+CHR+"\s+",header):
						H_OUT.write(header)
					elif re.search("^@RG",header):
						H_OUT.write(header)
					else:
						continue
				HD.close()
				H_OUT.close()


				#Reads counting
				Mutated_Count_unspli = 0
				Mutated_Count_spli = 0
				Wild_Count_unspli = 0
				Wild_Count_spli = 0
				Splied_OUT = open(SAM_F+"SPLICED.sam",'w')
				NonSpliced_OUT = open(SAM_F+"NONSPLICED.sam",'w')
				sam_f = open(SAM_F+".sam")
				for read in sam_f:
					read_array = read.strip().split('\t')
					genome_co = int(read_array[3])
					read_co = 0
					SEQ = read_array[9]
					ge_ex_blo = []
					read_ex_blo = []
					pattern = re.findall("(\d+\w)",read_array[5])
					for pi in pattern:
						if 'M' in pi:
							base_c = int(pi.replace('M',''))
							ge_ex_blo.append([genome_co,(genome_co+base_c-1)])
							read_ex_blo.append([read_co,(read_co+base_c-1)])
							genome_co += base_c
							read_co += base_c
						elif 'N' in pi:
							base_c = int(pi.replace('N',''))
							genome_co += base_c
						elif 'S' in pi:
							base_c = int(pi.replace('S',''))
							read_co += base_c
						elif 'I' in pi:
							base_c = int(pi.replace('I',''))
							read_co += base_c
						elif 'D' in pi:
							base_c = int(pi.replace('D',''))
							genome_co += base_c
						elif re.search("[H,P,=,X]",pi):
							print("unrecognized CIGAR string",pi)

					#Spliting the sam file into two files(splicing and nonsplicing)
					if snv_po == "L":
						if ge_ex_blo[0][0] >= ex_l:
							continue
						else:
							for ORD,exon_box in enumerate(ge_ex_blo):
								if exon_box[0] <= int(chr_p) and exon_box[1] >= int(chr_p):
									if exon_box[0] == ex_l and SEQ[read_ex_blo[ORD][0] + (int(chr_p) - exon_box[0])] == MUT:
										Splied_OUT.write(read)
										Mutated_Count_spli += 1
									elif exon_box[0] == ex_l and SEQ[read_ex_blo[ORD][0] + (int(chr_p) - exon_box[0])] == WIL:
										Splied_OUT.write(read)
										Wild_Count_spli += 1
									elif exon_box[0] < ex_l and SEQ[read_ex_blo[ORD][0] + (int(chr_p) - exon_box[0])] == MUT:
										NonSpliced_OUT.write(read)
										Mutated_Count_unspli += 1
									elif exon_box[0] < ex_l and SEQ[read_ex_blo[ORD][0] + (int(chr_p) - exon_box[0])] == WIL:
										NonSpliced_OUT.write(read)
										Wild_Count_unspli += 1
									else:
										pass
								else:
									continue
					elif snv_po == "R": 
						if ge_ex_blo[-1][1] <= ex_r:
							continue
						else:	
							for ORD,exon_box in enumerate(ge_ex_blo):
								if exon_box[0] <= int(chr_p) and exon_box[1] >= int(chr_p):
									if exon_box[1] == ex_r and SEQ[read_ex_blo[ORD][0] + (int(chr_p) - exon_box[0])] == MUT:
										Splied_OUT.write(read)
										Mutated_Count_spli += 1
									elif exon_box[1] == ex_r and SEQ[read_ex_blo[ORD][0] + (int(chr_p) - exon_box[0])] == WIL:
										Splied_OUT.write(read)
										Wild_Count_spli += 1
									elif exon_box[1] > ex_r and SEQ[read_ex_blo[ORD][0] + (int(chr_p) - exon_box[0])] == MUT:
										NonSpliced_OUT.write(read)
										Mutated_Count_unspli += 1
									elif exon_box[1] > ex_r and SEQ[read_ex_blo[ORD][0] + (int(chr_p) - exon_box[0])] == WIL:
										NonSpliced_OUT.write(read)
										Wild_Count_unspli += 1
									else:
										pass
								else:
									continue
				Splied_OUT.close()
				NonSpliced_OUT.close()
				sam_f.close()
				
				#Computing SNV for unspliced reads
				Mu_unspli = 0
				Wi_unspli = 0
				Mu_spli = 0
				Wi_spli = 0
				Unarray = []
				Spliarray = []
				os.system("cat " + SAM_F + "_header " + SAM_F+"NONSPLICED.sam |samtools view -bS - >"+SAM_F+"NONSPLICED.bam")
				os.system("samtools index " + SAM_F+"NONSPLICED.bam")
				os.system("java -jar "+options.gatk + " -U ALLOW_N_CIGAR_READS -R "+ options.G_P + "chr"+CHR+".fa  -T UnifiedGenotyper -I " + SAM_F+"NONSPLICED.bam -o " + SAM_F+"NONSPLICED_gatk")
				gatk_out_UNSPLI = open(SAM_F+"NONSPLICED_gatk")
				for i in gatk_out_UNSPLI:
					if re.search("^#",i):
						continue
					else:
						Unarray = i.strip().split('\t')
						if len(Unarray) != 0:
							sam_snv = "-".join([Unarray[0],Unarray[1],Unarray[3],Unarray[4]])
							if sam_snv == SNV and len(Unarray) > 8 and  re.search("^GT:AD",Unarray[8]):
								Wi_unspli = int(re.search(".*?:(\d+),(\d+).*?:",Unarray[9]).groups()[0])
								Mu_unspli = int(re.search(".*?:(\d+),(\d+).*?:",Unarray[9]).groups()[1])
							else:
								continue
				gatk_out_UNSPLI.close()
				os.remove(SAM_F+"NONSPLICED_gatk")
				if Wi_unspli == 0 and Mu_unspli == 0:
					Wi_unspli = Wild_Count_unspli
					Mu_unspli = Mutated_Count_unspli
				else:
					pass
				os.remove(SAM_F+"NONSPLICED.bam")
				os.remove(SAM_F+"NONSPLICED.bam.bai")
				os.remove(SAM_F+"NONSPLICED.sam")
				os.remove(SAM_F+"NONSPLICED_gatk.idx")
				#Computing SNV for spliced reads
				os.system("cat " + SAM_F + "_header " + SAM_F+"SPLICED.sam |samtools view -bS - >"+SAM_F+"SPLICED.bam")
				os.system("samtools index " + SAM_F+"SPLICED.bam")
				os.system("java -jar "+options.gatk + " -U ALLOW_N_CIGAR_READS -R "+ options.G_P + "chr"+CHR+".fa  -T UnifiedGenotyper -I " + SAM_F+"SPLICED.bam -o " + SAM_F+"SPLICED_gatk")
				gatk_out_SPLI = open(SAM_F+"SPLICED_gatk")
				for i in gatk_out_SPLI:
					if re.search("^#",i):
						continue
					else:
						Spliarray = i.strip().split('\t')
						if len(Spliarray) != 0:
							sam_snv = "-".join([Spliarray[0],Spliarray[1],Spliarray[3],Spliarray[4]])
							if sam_snv == SNV and len(Spliarray) > 8 and re.search("^GT:AD",Spliarray[8]):
								Wi_spli = int(re.search(".*?:(\d+),(\d+).*?:",Spliarray[9]).groups()[0])
								Mu_spli = int(re.search(".*?:(\d+),(\d+).*?:",Spliarray[9]).groups()[1])
							else:
								continue
				gatk_out_SPLI.close()
				os.remove(SAM_F+"SPLICED_gatk")
				if Wi_spli == 0 and Mu_spli == 0 :
					Wi_spli = Wild_Count_spli
					Mu_spli = Mutated_Count_spli
				else:
					pass
				os.remove(SAM_F+"SPLICED.bam")
				os.remove(SAM_F+"SPLICED.bam.bai")
				os.remove(SAM_F+"SPLICED.sam")
				os.remove(SAM_F+"SPLICED_gatk.idx")
				os.remove(SAM_F+".sam")
				os.remove(SAM_F+"_header")
				if snv_tss == "Y" and (Wi_spli + Mu_spli) == 0:
					continue
				else:
					vcf_out.write(vcf_line.strip()+"\t"+str(ex_l)+"\t"+str(ex_r)+"\t"+g_n+"\t"+snv_tss+"\t"+str(Wi_unspli)+"\t"+str(Mu_unspli)+"\t"+str(Wi_spli)+"\t"+str(Mu_spli)+"\n")
			else:
				continue
	vcf_fh.close()
	vcf_out.close()
	os.remove(C_F_N+"_header")
