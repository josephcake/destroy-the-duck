import React from 'react';

export const Legend = ({ theme }) => {
	return (
		<div className={'legend'}>
			<div className={'legend__section'}>
				<div className={'legend__item'}>
					<label className={'legend__item-label'}>Arrow :</label>
					<img
						className={'legend__item-icon bullet'}
						src={require('../Images/feathered-arrow.png')}
						alt={'Bullet'}
					/>
				</div>
				<div className={'legend__item'}>
					<label className={'legend__item-label'}>Duck :</label>
					<img
						className={'legend__item-icon duck'}
						src={require('../Images/duck.png')}
						alt={'Duck'}
					/>
				</div>
			</div>
			<div className={'legend__section'}>
				<div className={'legend__item'}>
					<label className={'legend__item-label'}>Path :</label>
					<div className={`legend__item-icon ${theme}_visited`}></div>
				</div>
				<div className={'legend__item'}>
					<label className={'legend__item-label'}>Wall :</label>
					<div className={`legend__item-icon ${theme}_wall`}></div>
				</div>
				<div className={'legend__item'}>
					<label className={'legend__item-label'}>Unvisited :</label>
					<div className={`legend__item-icon ${theme}_unvisited`}></div>
				</div>
			</div>
			<div className={'legend__section'}>
				<div className={'legend__item'}>
					<label className={'legend__item-label'}>Goal :</label>
				</div>
				<div className={'legend__item'}>
					<div className={`legend__item-box ${theme}_visited`}>
						Hunt the Quack!!
					</div>
				</div>
			</div>
		</div>
	);
};
