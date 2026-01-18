import { Link, LinkProps, useLocation } from 'react-router-dom';

export const PreserveQueryLink = ({ to, ...props }: LinkProps) => {
	const location = useLocation();
	const toWithParams = typeof to === 'string' ? `${to}${location.search}` : { ...to, search: location.search };
	return <Link to={toWithParams} {...props} />;
};
