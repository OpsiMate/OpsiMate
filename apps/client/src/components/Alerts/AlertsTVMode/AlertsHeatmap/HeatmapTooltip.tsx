import React from 'react';

export const HeatmapTooltip = ({ active, payload }: any) => {
	if (active && payload && payload.length) {
		const data = payload[0].payload;
		return (
			<div className="bg-background border border-border p-2 rounded shadow-md text-sm">
				<p className="font-semibold">{data.name}</p>
				{data.nodeType === 'leaf' && data.alert && (
					<>
						<p>Status: {data.alert.isDismissed ? 'Dismissed' : 'Firing'}</p>
						<p>Tag: {data.alert.tag}</p>
						{data.alert.summary && <p>Summary: {data.alert.summary}</p>}
						<p className="text-xs text-muted-foreground mt-1">
							Started: {new Date(data.alert.startsAt).toLocaleString()}
						</p>
					</>
				)}
				{data.nodeType === 'group' && <p>Count: {data.value}</p>}
			</div>
		);
	}
	return null;
};
