import nibabel as nib  # Library for loading data from neuroimaging file formats such as NIfTI
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors
import matplotlib.cm as cm
import numpy as np
import sys
import io
import json


# read input data from stdin
try:
	# Read raw input from stdin
	input_data = sys.stdin.read()
	print("python3 input_data")
	print(input_data)

	# Check if input is empty
	if not input_data.strip():
		print("Error: No input provided", file=sys.stderr)
		sys.exit(1)
	# Parse the input as JSON
	parsed_data = json.loads(input_data)

	# Check if parsed_data is a dictionary
	if not isinstance(parsed_data,dict):
		print("Error: Input JSON must be an object (dictionary)", file=sys.stderr)
		sys.exit(1)

	# Assign variables
	try:
		templateFile = parsed_data["refFile"]
		plane = parsed_data["plane"]
		index = parsed_data["index"]
		vmaxSamples = parsed_data["maxLength"]
		sampleFiles = json.loads(parsed_data["filesByCat"])
	except KeyError as e:
		print(f"Error: Missing required key in JSON - {str(e)}", file=sys.stderr)
		sys.exit(1)
	# type checking or validation
	if not isinstance(index, int):
		print("Error: 'index' must be an integer", file=sys.stderr)
		sys.exit(1)
	if not isinstance(vmaxSamples, int):
		print("Error: 'maxLength' must be an integer", file=sys.stderr)
		sys.exit(1)
	if not isinstance(sampleFiles, dict):
		print("Error: 'filesByCat' must be an object (dictionary)", file=sys.stderr)
		sys.exit(1)
except json.JSONDecodeError as e:
	# Handle invalid JSON
	print(f"Error: Invalid JSON format - {str(e)}", file=sys.stderr)
	sys.exit(1)
except Exception as e:
	# Catch any other unexpected errors
	print(f"Error: An unexpected error occurred - {str(e)}", file=sys.stderr)
	sys.exit(1)

if(plane != 'L' and plane != 'F' and plane != 'T'):
	print('Invalid plane', file=sys.stderr)
	sys.exit(1)

# load data from nifti files 
template = nib.load(templateFile).get_fdata()

vmaxSamples = int(vmaxSamples)



index = int(index)
#  (left, sagittal), f (front, coronal), t (top, axial) 
if plane == 'L':
	slice = template[index,:,:]
	slice = np.rot90(slice)
elif plane == 'F':
	slice = template[:,index,:]
	slice = np.flip(np.rot90(slice),axis=1)

else:# plane == 'T'
	slice = template[:,:,index]
	slice = np.flip(np.rot90(slice),axis=1)

fig, ax = plt.subplots(1, 1)
ax.imshow(slice, 'gray', filternorm=False, vmin=0, vmax=100)

for key, value in sampleFiles.items():
	if(len(value["samples"]) == 0) :
		continue
	# Load all sample files
	sample_data = [nib.load(file_path).get_fdata() for file_path in value["samples"]]

	# Initialize the result array with zeros
	labels = np.zeros_like(sample_data[0])

	# Sum all sample data
	for data in sample_data:
		labels += data

	labels = np.ma.masked_where(labels == 0, labels) # Mask labels where they are 0


	index = int(index)
	#  (left, sagittal), f (front, coronal), t (top, axial) 
	if plane == 'L':
		label = labels[index,:,:]
		label = np.rot90(label)
	elif plane == 'F':
		label = labels[:,index,:]
		label = np.flip(np.rot90(label),axis=1)
	else:# plane == 'T'
		label = labels[:,:,index]
		label = np.flip(np.rot90(label),axis=1)
		


	# create three subplots for sagittal, coronal and axial plane
	vmin = 0
	vmax = 100
	alpha = 0.6

	color = value['color']
	print(color)
	cmap = mcolors.LinearSegmentedColormap.from_list('my_cmap', ['white', color])
	ax.imshow(label, cmap, alpha=alpha, filternorm=False,vmin=0,vmax=vmaxSamples)
	ax.axis('off')

# Create the color bar
# if showLegend == 1:
# 	# Create a color bar without changing figure size
# 	norm = mcolors.Normalize(vmin=0, vmax=vmaxSamples)
# 	sm = plt.cm.ScalarMappable(cmap=cmap, norm=norm)

# 	cbar = plt.colorbar(sm, ax=ax, orientation='vertical', fraction=0.01, pad=0.05, alpha=alpha)
# 	cbar.set_label('Combined Intensity', color='white', fontsize=6, labelpad=-10)
# 	cbar.ax.text(0.5, 1.0001, vmaxSamples, ha='center', va='bottom', transform=cbar.ax.transAxes, color='white', fontsize=6)
# 	cbar.ax.text(0.5, -0.0001, 0, ha='center', va='top', transform=cbar.ax.transAxes, color='white', fontsize=6)

# Output the image data to stdout
buf = io.BytesIO()
plt.savefig(buf, format='png', bbox_inches='tight', facecolor='k')
buf.seek(0)
sys.stdout.buffer.write(buf.getvalue())
plt.close()