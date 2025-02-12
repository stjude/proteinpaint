import pykegg # Analyze and visualize KEGG information using network approach
import requests_cache # easily cache the responses from HTTP requests, which can significantly improve the performance of your code if you are making repeated requests to the same URLs
import json,sys
import pandas as pd
import re

if len(sys.argv) <= 1:
	print('python3 '+sys.argv[0]+' compoundJson: dictionary containg kegg id, color, width, and opacity per compound).\npathwaysID')
	sys.exit(1)

try:
	compoundJson = json.loads(sys.argv[1])
except Exception as e:
	print("An error occurred to the data generated from pathwayAnalysisId:",e)
pathwayID = sys.argv[2]

requests_cache.install_cache('pykegg_cache')
graph = pykegg.KGML_graph(pid=pathwayID)
nodes = graph.get_nodes()

# function to remove 'gl:', 'cpm:' or 'gl' from name column 
def modNam(x):
	xl = re.split('\s+',x)
	return ' '.join([x.split(':')[1] for x in xl])
# function to reform the coords
# [(3841, 1691), (3841, 1747)] -> [[3841, 1691], [3841, 1747]]
def modCor(x):
	return [[a[0],-a[1]] for a in x]

### compound and glycan
cpd_gl = nodes[nodes['name'].str.startswith(('cpd','gl'))]
# select the required columns
cpd_gl = cpd_gl.filter(items=['name','x','y','fgcolor'])
# modify the name column
cpd_gl['name'] = cpd_gl['name'].apply(modNam)
cpd_gl = cpd_gl.to_json(orient='records')

### KEGG Orthology
ko = nodes[nodes['name'].str.startswith('ko')]
# select required columns
ko = ko.filter(items=['name','coords','fgcolor'])
# modify the name column
ko['name'] = ko['name'].apply(modNam)
# modify the coords column
ko['coords'] = ko['coords'].apply(modCor)
ko = ko.to_json(orient='records')

### path
path = nodes[nodes['name'].str.startswith('path')]
# select required columns
path = path.filter(items=['x','y','graphics_name','fgcolor','width','height','xmin','xmax','ymin','ymax'])
path = path.to_json(orient='records')

#nodes['x'] = pd.to_numeric(nodes['x'], errors="coerce")
#nodes.dropna(subset=["x"],inplace=True)
#nodes['y'] = pd.to_numeric(nodes['y'], errors="coerce")
#nodes.dropna(subset=["y"],inplace=True)
#nodes.reset_index(drop=True,inplace=True)
#nodes = nodes.to_json(orient='records')
#coords = graph.get_coords()
#coords['x'] = pd.to_numeric(coords['x'], errors="coerce")
#coords.dropna(subset=["x"],inplace=True)
#coords['y'] = pd.to_numeric(coords['y'], errors="coerce")
#coords.dropna(subset=["y"],inplace=True)
#coords['xend'] = pd.to_numeric(coords['xend'], errors="coerce")
#coords.dropna(subset=["xend"],inplace=True)
#coords['yend'] = pd.to_numeric(coords['yend'], errors="coerce")
#coords.dropna(subset=["yend"],inplace=True)
#coords.reset_index(drop=True,inplace=True)
#coords = coords.to_json(orient='records')

sys.stdout.write(json.dumps([cpd_gl,ko,path]))

