import { Alert } from '@OpsiMate/shared';
import { AlertCircle, BellOff } from 'lucide-react';
import React from 'react';

interface AlertCardIconProps {
	alert: Alert;
}

export const AlertCardIcon = ({ alert }: AlertCardIconProps) => {
	if (alert.isDismissed) {
		return <BellOff className="h-4 w-4 text-foreground" />;
	}
	return <AlertCircle className="h-4 w-4 text-destructive" />;
};
