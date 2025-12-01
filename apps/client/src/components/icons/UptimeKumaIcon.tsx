import { SVGProps } from 'react';

export const UptimeKumaIcon = (props: SVGProps<SVGSVGElement>) => (
	<svg xmlns="http://www.w3.org/2000/svg" xmlSpace="preserve" viewBox="0 0 622 622" {...props}>
		<defs>
			<linearGradient id="uptimekuma-gradient" x1="-82.404" x2="121.666" y1="38.077" y2="-157.263" gradientTransform="matrix(1 0 0 -1 .001 -16)" gradientUnits="userSpaceOnUse">
				<stop offset="0" style={{ stopColor: '#5cdd8b' }} />
				<stop offset="1" style={{ stopColor: '#86e6a9' }} />
			</linearGradient>
		</defs>
		<g transform="translate(320 320)">
			<path
				d="M161.4-93.4c53.7 122.7 53.7 199.7 0 230.9-80.5 46.7-290.4 61-350.9-10.9-40.3-47.9-40.3-121.2 0-220 41-67.5 99.2-101.2 174.6-101.2 75.5 0 134.3 33.8 176.3 101.2z"
				style={{ fill: 'url(#uptimekuma-gradient)', stroke: '#f2f2f2', strokeWidth: 200, strokeOpacity: 0.51 }}
			/>
		</g>
	</svg>
);
