../../node_modules/.bin/webpack --entry=./annotatejunction.js --output-filename=bin2.js --target=node
../../node_modules/.bin/webpack --entry=./exonskip.mds.js --output-filename=bin.js --target=node

node bin.js --genome=/home/xzhou/data/tp/genomes/hg19.gz --gene=/home/xzhou/data/tp/anno/refGene.hg19 --genenames=/home/xzhou/proteinpaint/utils/findspliceevent/test/genes --mdsjunction=/home/xzhou/proteinpaint/utils/findspliceevent/test/junction.noevent.gz --readcountcutoff=1 --max-old-space-size=8192 > /home/xzhou/data/tp/hg19/PCGP/junction/test/tmp

sort -k1,1 -k2,2n /home/xzhou/data/tp/hg19/PCGP/junction/test/tmp > /home/xzhou/data/tp/hg19/PCGP/junction/test/tmp.sort

bgzip -f /home/xzhou/data/tp/hg19/PCGP/junction/test/tmp.sort
tabix -p bed -c '#' /home/xzhou/data/tp/hg19/PCGP/junction/test/tmp.sort.gz

node merge.js /home/xzhou/data/tp/hg19/PCGP/junction/test/rawmds /home/xzhou/data/tp/hg19/PCGP/junction/test/tmp.sort.gz > /home/xzhou/data/tp/hg19/PCGP/junction/test/tmp.events

node bin2.js /home/xzhou/data/tp/hg19/PCGP/junction/test/tmp.events /home/xzhou/data/tp/anno/refGene.hg19.gz > /home/xzhou/data/tp/hg19/PCGP/junction/test/new

bgzip -f /home/xzhou/data/tp/hg19/PCGP/junction/test/new
tabix -p bed -c '#' -f /home/xzhou/data/tp/hg19/PCGP/junction/test/new.gz


scp bin.js xzhou1@hpc:/home/xzhou1/gb_customTracks/tp/junction/annotate/annotate_spliceevent.js
scp bin2.js xzhou1@hpc:/home/xzhou1/gb_customTracks/tp/junction/annotate/annotate_junction.js
