export const clusterMethodLst = [
	{
		label: 'Average',
		value: 'average',
		title: `Cluster by average value`
	},
	{
		label: `Complete`,
		value: 'complete',
		title: `Use the complete clustering method`
	},
	{
		label: `Single`,
		value: 'single',
		title: `Use the single clustering method`
	},
	{
		label: `Ward.D`,
		value: 'ward.D',
		title: `Use the ward.D clustering method`
	},
	{
		label: `Ward.D2`,
		value: 'ward.D2',
		title: `Use the ward.D2 clustering method`
	},
	{
		label: `Mcquitty`,
		value: 'mcquitty',
		title: `Use the Mcquity clustering method`
	}
	/* These methods are currently disabled because the dendrogram lines tend to cross one another.
	{
		label: `Centroid`,
		value: 'centroid',
		title: `Use the centroid clustering method`
	},
    	{
		label: `Median`,
		value: 'median',
		title: `Use the median clustering method`
	}
        */
]
export const distanceMethodLst = [
	{
		label: 'Euclidean',
		value: 'euclidean',
		title: `Calculate distance using euclidean method`
	},
	{
		label: 'Maximum',
		value: 'maximum',
		title: `Maximum distance between two components of x and y`
	},
	{
		label: 'Manhattan',
		value: 'manhattan',
		title: `Calculate distance using the absolute distance between the two vectors`
	},
	{
		label: 'Canberra',
		value: 'canberra',
		title: `Calculate distance using Canberra method`
	}
]
