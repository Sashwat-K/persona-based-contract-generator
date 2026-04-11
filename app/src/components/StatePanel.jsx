import React from 'react';
import { Tile } from '@carbon/react';
import { WarningAlt } from '@carbon/icons-react';

export const StatePanel = ({
  title,
  description,
  icon = null,
  className = '',
  action = null,
  children = null
}) => {
  const hasFollowupContent = Boolean(action || children);

  return (
    <Tile className={`app-state-panel ${className}`.trim()}>
      {icon && <div className="state-panel__icon">{icon}</div>}
      {title && <h3 className="state-panel__title">{title}</h3>}
      {description && (
        <p className={`state-panel__description${hasFollowupContent ? ' state-panel__description--spaced' : ''}`}>
          {description}
        </p>
      )}
      {children}
      {action}
    </Tile>
  );
};

export const ErrorStatePanel = ({ title = 'Something went wrong', description, action = null }) => (
  <StatePanel
    icon={<WarningAlt size={48} className="state-panel__error-icon" />}
    title={title}
    description={description}
    action={action}
  />
);

export default StatePanel;
