import React, { memo } from 'react';
import { ToastContainer } from './styles/toast.styles';

export const Toast = memo(({ isToastVisible, resetToast, theme }) => {
	return (
		<ToastContainer
			onClick={() => resetToast('click')}
			theme={theme}
			isToastVisible={isToastVisible}>
			Cannot find Duck!
		</ToastContainer>
	);
});
