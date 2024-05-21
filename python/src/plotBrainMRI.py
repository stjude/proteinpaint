import nibabel as nib
import matplotlib.pyplot as plt
import numpy as np
import sys
import io

if len(sys.argv) <= 1:
	print('python3 '+sys.argv[0]+' <path/to/template/file> <path/to/label/file> indexL indexF, indexT')
	sys.exit(1)

templateFile = sys.argv[1]
labelFile = sys.argv[2]

template = nib.load(templateFile).get_fdata()
labels = nib.load(labelFile).get_fdata()
labels = np.ma.masked_where(labels == 0, labels)

l = int(sys.argv[3]) if len(sys.argv) > 3 else 70
f = int(sys.argv[4]) if len(sys.argv) > 4 else 110
t = int(sys.argv[5]) if len(sys.argv) > 5 else 80

left_slice = template[l,:,:]
front_slice = template[:,f,:]
top_slice = template[:,:,t]

left_label = labels[l,:,:]
front_label = labels[:,f,:]
top_label = labels[:,:,t]

left_slice = np.rot90(left_slice)
left_label = np.rot90(left_label)

front_slice = np.flip(np.rot90(front_slice),axis=1)
front_label = np.flip(np.rot90(front_label),axis=1)

top_slice = np.flip(np.rot90(top_slice),axis=1)
top_label = np.flip(np.rot90(top_label),axis=1)

fig, ax = plt.subplots(1, 3)
vmin = 0
vmax = 100
alpha = 0.5
ax[0].imshow(left_slice, 'gray', filternorm=False, vmin=vmin, vmax=vmax)
ax[0].imshow(left_label, 'jet', alpha=alpha, filternorm=False,vmin=0,vmax=102)
ax[0].axis('off')
ax[0].text(0, 0.5, 'P', fontsize=12, color='white', ha='center', va='center', transform=ax[0].transAxes)
ax[0].text(0.5, 1, 'S', fontsize=12, color='white', ha='center', va='center', transform=ax[0].transAxes)

ax[1].imshow(front_slice, 'gray', filternorm=False, vmin=vmin, vmax=vmax)
ax[1].imshow(front_label, cmap='jet', alpha=alpha, filternorm=False,vmin=0,vmax=102)
ax[1].axis('off')
ax[1].text(0, 0.5, 'R', fontsize=12, color='white', ha='center', va='center', transform=ax[1].transAxes)
ax[1].text(0.5, 1, 'S', fontsize=12, color='white', ha='center', va='center', transform=ax[1].transAxes)

ax[2].imshow(top_slice, 'gray', filternorm=False, vmin=vmin, vmax=vmax)
ax[2].imshow(top_label, cmap='jet', alpha=alpha, filternorm=False,vmin=0,vmax=102)
ax[2].axis('off')
ax[2].text(0, 0.5, 'R', fontsize=12, color='white', ha='center', va='center', transform=ax[2].transAxes)
ax[2].text(0.5, 1, 'A', fontsize=12, color='white', ha='center', va='center', transform=ax[2].transAxes)

fig.subplots_adjust(wspace=0, hspace=0)
buf = io.BytesIO()
plt.savefig(buf, format='png', bbox_inches='tight', facecolor='k')
buf.seek(0)
sys.stdout.buffer.write(buf.getvalue())
plt.close()