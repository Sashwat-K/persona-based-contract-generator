import React from 'react';
import { Button } from '@carbon/react';
import { Home, ArrowLeft } from '@carbon/icons-react';

const NotFound = ({ onNavigate }) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      textAlign: 'center',
      padding: '2rem'
    }}>
      <div style={{
        fontSize: '8rem',
        fontWeight: 700,
        color: 'var(--cds-text-secondary)',
        lineHeight: 1,
        marginBottom: '1rem'
      }}>
        404
      </div>

      <h1 style={{
        fontSize: '2rem',
        marginBottom: '1rem',
        color: 'var(--cds-text-primary)'
      }}>
        Page Not Found
      </h1>

      <p style={{
        fontSize: '1rem',
        color: 'var(--cds-text-secondary)',
        marginBottom: '2rem',
        maxWidth: '500px'
      }}>
        The page you're looking for doesn't exist or has been moved.
        Please check the URL or navigate back to the home page.
      </p>

      <div style={{
        display: 'flex',
        gap: '1rem',
        flexWrap: 'wrap',
        justifyContent: 'center'
      }}>
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

      <div style={{
        marginTop: '3rem',
        padding: '1.5rem',
        backgroundColor: 'var(--cds-layer-01)',
        borderRadius: '4px',
        maxWidth: '600px'
      }}>
        <h3 style={{ marginBottom: '0.5rem', fontSize: '1rem' }}>
          Need Help?
        </h3>
        <p style={{
          fontSize: '0.875rem',
          color: 'var(--cds-text-secondary)',
          margin: 0
        }}>
          If you believe this is an error, please contact your system administrator
          or check the application documentation.
        </p>
      </div>
    </div>
  );
};

export default NotFound;


