import React from 'react';
import { Button } from '@carbon/react';
import { Home, ArrowLeft } from '@carbon/icons-react';

const NotFound = ({ onNavigate }) => {
  return (
    <div className="app-page app-page--padded not-found-page">
      <div className="not-found-page__code">
        404
      </div>

      <h1 className="not-found-page__title">
        Page Not Found
      </h1>

      <p className="not-found-page__description">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
        Please check the URL or navigate back to the home page.
      </p>

      <div className="not-found-page__actions">
        <Button
          renderIcon={Home}
          onClick={() => onNavigate('HOME')}
        >
          Go to Home
        </Button>

        <Button
          kind="secondary"
          renderIcon={ArrowLeft}
          onClick={() => window.history.back()}
        >
          Go Back
        </Button>
      </div>

      <div className="not-found-page__help">
        <h3 className="not-found-page__help-title">
          Need Help?
        </h3>
        <p className="not-found-page__help-copy">
          If you believe this is an error, please contact your system administrator
          or check the application documentation.
        </p>
      </div>
    </div>
  );
};

export default NotFound;
