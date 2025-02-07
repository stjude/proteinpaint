import pykegg # Analyze and visualize KEGG information using network approach
import requests_cache # easily cache the responses from HTTP requests, which can significantly improve the performance of your code if you are making repeated requests to the same URLs
import json,sys
import pandas as pd

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
nodes['x'] = pd.to_numeric(nodes['x'], errors="coerce")
nodes.dropna(subset=["x"],inplace=True)
nodes['y'] = pd.to_numeric(nodes['y'], errors="coerce")
nodes.dropna(subset=["y"],inplace=True)
nodes.reset_index(drop=True,inplace=True)
nodes = nodes.to_json(orient='records')
coords = graph.get_coords()
coords['x'] = pd.to_numeric(coords['x'], errors="coerce")
coords.dropna(subset=["x"],inplace=True)
coords['y'] = pd.to_numeric(coords['y'], errors="coerce")
coords.dropna(subset=["y"],inplace=True)
coords['xend'] = pd.to_numeric(coords['xend'], errors="coerce")
coords.dropna(subset=["xend"],inplace=True)
coords['yend'] = pd.to_numeric(coords['yend'], errors="coerce")
coords.dropna(subset=["yend"],inplace=True)
coords.reset_index(drop=True,inplace=True)
coords = coords.to_json(orient='records')

sys.stdout.write(json.dumps([nodes,coords]))

with open('/Users/jwang7/Documents/Work/tmp.txt','w') as f:
	print(json.dumps([nodes,coords]),file=f)

