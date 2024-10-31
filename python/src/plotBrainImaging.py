import nibabel as nib  # Library for loading data from neuroimaging file formats such as NIfTI
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors
import matplotlib.cm as cm
import numpy as np
import sys
import io

if len(sys.argv) <= 1:
	print('python3 '+sys.argv[0]+' <path/to/template/file> plane index, <path/to/sample/file>\nParameter plane options: L (left, sagittal), F (front, coronal), T (top, axial)')
	sys.exit(1)

plane = sys.argv[2]
if(plane != 'L' and plane != 'F' and plane != 'T'):
	print('Invalid plane')
	sys.exit(1)
index = sys.argv[3]

if(len(index) == 0):
	print('Need to provide index')
	sys.exit(1)

templateFile = sys.argv[1]

# load data from nifti files 
template = nib.load(templateFile).get_fdata()

color = sys.argv[4]

sampleFiles = sys.argv[5:]

# Load all sample files
sample_data = [nib.load(file_path).get_fdata() for file_path in sampleFiles]

# Initialize the result array with zeros
labels = np.zeros_like(sample_data[0])

# Sum all sample data
for data in sample_data:
    labels += data

labels = np.ma.masked_where(labels == 0, labels) # Mask labels where they are 0


index = int(index)
#  (left, sagittal), f (front, coronal), t (top, axial) 
if plane == 'L':
	slice = template[index,:,:]
	label = labels[index,:,:]
	# adjust the orientation of the plots by flipping and rotating

	slice = np.rot90(slice)
	label = np.rot90(label)
elif plane == 'F':
	slice = template[:,index,:]
	label = labels[:,index,:]
	# adjust the orientation of the plots by flipping and rotating

	slice = np.flip(np.rot90(slice),axis=1)
	label = np.flip(np.rot90(label),axis=1)
else:# plane == 'T'
	slice = template[:,:,index]
	label = labels[:,:,index]
	# adjust the orientation of the plots by flipping and rotating

	slice = np.flip(np.rot90(slice),axis=1)
	label = np.flip(np.rot90(label),axis=1)
	


# create three subplots for sagittal, coronal and axial plane
fig, ax = plt.subplots(1, 1)
vmin = 0
vmax = 100
vmaxSamples = len(sampleFiles)
alpha = 0.6

if color == 'none':
	cmap = 'Reds'
else:
	cmap = mcolors.LinearSegmentedColormap.from_list('my_cmap', ['white', color])


ax.imshow(slice, 'gray', filternorm=False, vmin=vmin, vmax=vmax)
ax.imshow(label, cmap, alpha=alpha, filternorm=False,vmin=0,vmax=vmaxSamples)
ax.axis('off')




# Create the color bar
if vmaxSamples > 1:
	# Create a color bar without changing figure size
	norm = mcolors.Normalize(vmin=0, vmax=vmaxSamples)
	sm = plt.cm.ScalarMappable(cmap=cmap, norm=norm)

	cbar = plt.colorbar(sm, ax=ax, orientation='vertical', fraction=0.01, pad=0.05, alpha=alpha)
	cbar.set_label('Combined Intensity', color='white', fontsize=6, labelpad=-10)
	cbar.ax.text(0.5, 1.0001, vmaxSamples, ha='center', va='bottom', transform=cbar.ax.transAxes, color='white', fontsize=6)
	cbar.ax.text(0.5, -0.0001, 0, ha='center', va='top', transform=cbar.ax.transAxes, color='white', fontsize=6)

# Output the image data to stdout
buf = io.BytesIO()
plt.savefig(buf, format='png', bbox_inches='tight', facecolor='k')
buf.seek(0)
sys.stdout.buffer.write(buf.getvalue())
plt.close()