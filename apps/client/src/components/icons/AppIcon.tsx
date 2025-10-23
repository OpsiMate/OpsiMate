import { ImgHTMLAttributes } from 'react';

export const AppIcon = (props: ImgHTMLAttributes<HTMLImageElement>) => {
	return <img src='/images/logo.png' alt='OpsiMate Logo' {...props} />;
};
