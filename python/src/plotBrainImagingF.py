import nibabel as nib  # Library for loading data from neuroimaging file formats such as NIfTI
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors
import matplotlib.cm as cm
import numpy as np
import sys
import io

if len(sys.argv) <= 1:
	print('python3 '+sys.argv[0]+' <path/to/template/file> indexL indexF, indexT, <path/to/sample/file>')
	sys.exit(1)
print(sys.argv)
templateFile = sys.argv[1]

# load data from nifti files 
template = nib.load(templateFile).get_fdata()


sampleFiles = sys.argv[5:]

# Load all sample files
sample_data = [nib.load(file_path).get_fdata() for file_path in sampleFiles]

# Initialize the result array with zeros
labels = np.zeros_like(sample_data[0])

# Sum all sample data
for data in sample_data:
    labels += data

labels = np.ma.masked_where(labels == 0, labels) # Mask labels where they are 0

#l = int(sys.argv[2]) if len(sys.argv) > 2 else 70
f = int(sys.argv[3]) if len(sys.argv) > 3 else 110
#t = int(sys.argv[4]) if len(sys.argv) > 4 else 80

# extract slices l (left, sagittal), f (front, coronal), t (top, axial) from the template and label data
#left_slice = template[l,:,:]
front_slice = template[:,f,:]
# top_slice = template[:,:,t]

#left_label = labels[l,:,:]
front_label = labels[:,f,:]
# top_label = labels[:,:,t]


# adjust the orientation of the plots by flipping and rotating
# left_slice = np.rot90(left_slice)
# left_label = np.rot90(left_label)

front_slice = np.flip(np.rot90(front_slice),axis=1)
front_label = np.flip(np.rot90(front_label),axis=1)

# top_slice = np.flip(np.rot90(top_slice),axis=1)
# top_label = np.flip(np.rot90(top_label),axis=1)


# create three subplots for sagittal, coronal and axial plane
fig, ax = plt.subplots(1,1)
vmin = 0
vmax = 100
vmaxSamples = len(sampleFiles)
alpha = 0.6
ax.imshow(front_slice, 'gray', filternorm=False, vmin=vmin, vmax=vmax)
ax.imshow(front_label, 'Reds', alpha=alpha, filternorm=False,vmin=0,vmax=vmaxSamples)
ax.axis('off')
# ax.text(0, 0.5, 'P', fontsize=12, color='white', ha='center', va='center', transform=ax[0].transAxes)
# ax.text(0.5, 1, 'S', fontsize=12, color='white', ha='center', va='center', transform=ax[0].transAxes)

# ax[1].imshow(front_slice, 'gray', filternorm=False, vmin=vmin, vmax=vmax)
# ax[1].imshow(front_label, cmap='Reds', alpha=alpha, filternorm=False,vmin=0,vmax=vmaxSamples)
# ax[1].axis('off')
# ax[1].text(0, 0.5, 'R', fontsize=12, color='white', ha='center', va='center', transform=ax[1].transAxes)
# ax[1].text(0.5, 1, 'S', fontsize=12, color='white', ha='center', va='center', transform=ax[1].transAxes)

# ax[2].imshow(top_slice, 'gray', filternorm=False, vmin=vmin, vmax=vmax)
# ax[2].imshow(top_label, cmap='Reds', alpha=alpha, filternorm=False,vmin=0,vmax=vmaxSamples)
# ax[2].axis('off')
# ax[2].text(0, 0.5, 'R', fontsize=12, color='white', ha='center', va='center', transform=ax[2].transAxes)
# ax[2].text(0.5, 1, 'A', fontsize=12, color='white', ha='center', va='center', transform=ax[2].transAxes)
#fig.subplots_adjust(wspace=0, hspace=0)



# Create the color bar
if vmaxSamples > 1:
	# Create a color bar without changing figure size
	norm = mcolors.Normalize(vmin=0, vmax=vmaxSamples)
	sm = plt.cm.ScalarMappable(cmap='Reds', norm=norm)

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