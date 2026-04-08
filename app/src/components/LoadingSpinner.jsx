import React from 'react';
import { Loading, InlineLoading } from '@carbon/react';

/**
 * LoadingSpinner Component
 * Provides consistent loading indicators across the application
 * Supports full-page, inline, and skeleton loading states
 */

export const FullPageLoader = ({ description = 'Loading...' }) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        width: '100%'
      }}
    >
      <Loading description={description} withOverlay={false} />
    </div>
  );
};

export const InlineLoader = ({ 
  description = 'Loading...', 
  status = 'active',
  successDelay = 1500 
}) => {
  return (
    <InlineLoading
      description={description}
      status={status}
      successDelay={successDelay}
    />
  );
};

export const SkeletonLoader = ({ rows = 3, width = '100%' }) => {
  return (
    <div style={{ width }}>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          style={{
            height: '48px',
            backgroundColor: 'var(--cds-skeleton-background)',
            marginBottom: '0.5rem',
            borderRadius: '4px',
            animation: 'skeleton-loading 1.5s ease-in-out infinite'
          }}
        />
      ))}
      <style>{`
        @keyframes skeleton-loading {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.4;
          }
        }
      `}</style>
    </div>
  );
};

export const TableSkeletonLoader = ({ rows = 5, columns = 4 }) => {
  return (
    <div style={{ width: '100%' }}>
      {/* Header */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: '1rem',
        marginBottom: '1rem',
        padding: '1rem',
        backgroundColor: 'var(--cds-layer-01)'
      }}>
        {Array.from({ length: columns }).map((_, index) => (
          <div
            key={`header-${index}`}
            style={{
              height: '24px',
              backgroundColor: 'var(--cds-skeleton-background)',
              borderRadius: '4px'
            }}
          />
        ))}
      </div>
      
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={`row-${rowIndex}`}
          style={{ 
            display: 'grid', 
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: '1rem',
            marginBottom: '0.5rem',
            padding: '1rem',
            backgroundColor: 'var(--cds-layer-01)'
          }}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div
              key={`cell-${rowIndex}-${colIndex}`}
              style={{
                height: '20px',
                backgroundColor: 'var(--cds-skeleton-background)',
                borderRadius: '4px',
                animation: 'skeleton-loading 1.5s ease-in-out infinite',
                animationDelay: `${(rowIndex * columns + colIndex) * 0.05}s`
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

export const CardSkeletonLoader = ({ count = 3 }) => {
  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
      gap: '1rem',
      width: '100%'
    }}>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          style={{
            padding: '1.5rem',
            backgroundColor: 'var(--cds-layer-01)',
            borderRadius: '4px',
            minHeight: '200px'
          }}
        >
          {/* Title */}
          <div
            style={{
              height: '24px',
              width: '60%',
              backgroundColor: 'var(--cds-skeleton-background)',
              borderRadius: '4px',
              marginBottom: '1rem',
              animation: 'skeleton-loading 1.5s ease-in-out infinite'
            }}
          />
          
          {/* Content lines */}
          {Array.from({ length: 3 }).map((_, lineIndex) => (
            <div
              key={lineIndex}
              style={{
                height: '16px',
                width: lineIndex === 2 ? '40%' : '100%',
                backgroundColor: 'var(--cds-skeleton-background)',
                borderRadius: '4px',
                marginBottom: '0.5rem',
                animation: 'skeleton-loading 1.5s ease-in-out infinite',
                animationDelay: `${lineIndex * 0.1}s`
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

export default {
  FullPageLoader,
  InlineLoader,
  SkeletonLoader,
  TableSkeletonLoader,
  CardSkeletonLoader
};

// Made with Bob
