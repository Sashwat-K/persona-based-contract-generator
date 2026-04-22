import React from 'react';
import {
  Loading,
  InlineLoading,
  DataTableSkeleton,
  SkeletonText,
  SkeletonPlaceholder
} from '@carbon/react';

/**
 * LoadingSpinner Component
 * Provides consistent loading indicators across the application
 * Supports full-page, inline, and skeleton loading states
 */

export const FullPageLoader = ({ description = 'Loading...' }) => {
  return (
    <div className="loading-spinner-full-page">
      <Loading description={description} withOverlay={false} />
    </div>
  );
};

export const DataTableSkeletonLoader = ({
  rows = 5,
  columns = 4,
  showHeader = true,
  showToolbar = true,
  compact = false
}) => {
  return (
    <DataTableSkeleton
      columnCount={columns}
      rowCount={rows}
      headers={showHeader}
      showHeader={showHeader}
      showToolbar={showToolbar}
      compact={compact}
    />
  );
};

export const ContentSkeletonLoader = ({
  lines = 3,
  heading = false,
  paragraph = false,
  width = '100%'
}) => {
  return (
    <div style={{ width }}>
      {heading && (
        <SkeletonText heading style={{ marginBottom: '1rem' }} />
      )}
      <SkeletonText
        paragraph={paragraph}
        lineCount={lines}
      />
    </div>
  );
};

export const TileSkeletonLoader = ({ count = 1 }) => {
  return (
    <div className="tile-skeleton-container">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="tile-skeleton-item">
          <SkeletonPlaceholder style={{ width: '100%', height: '200px' }} />
        </div>
      ))}
    </div>
  );
};

export const InlineLoader = ({
  description = 'Loading...',
  message,
  status = 'active',
  successDelay = 1500,
  ...rest
}) => {
  const resolvedDescription = message || description;

  return (
    <InlineLoading
      description={resolvedDescription}
      status={status}
      successDelay={successDelay}
      {...rest}
    />
  );
};

const getSkeletonWidthClass = (width) => {
  if (width === '25%') return 'loading-skeleton--quarter';
  if (width === '50%') return 'loading-skeleton--half';
  if (width === '75%') return 'loading-skeleton--three-quarter';
  return 'loading-skeleton--full';
};

const getTableSkeletonColumnClass = (columns) => {
  const normalized = Number.isFinite(Number(columns))
    ? Math.max(1, Math.min(8, Number(columns)))
    : 4;
  return `loading-table-skeleton--cols-${normalized}`;
};

export const SkeletonLoader = ({ rows = 3, width = '100%' }) => {
  return (
    <div className={`loading-skeleton ${getSkeletonWidthClass(width)}`}>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="loading-skeleton__row" />
      ))}
    </div>
  );
};

export const TableSkeletonLoader = ({ rows = 5, columns = 4 }) => {
  const columnClass = getTableSkeletonColumnClass(columns);

  return (
    <div className={`loading-table-skeleton ${columnClass}`}>
      <div className="loading-table-skeleton__row loading-table-skeleton__row--header">
        {Array.from({ length: columns }).map((_, index) => (
          <div key={`header-${index}`} className="loading-table-skeleton__cell loading-table-skeleton__cell--header" />
        ))}
      </div>

      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={`row-${rowIndex}`} className="loading-table-skeleton__row">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div key={`cell-${rowIndex}-${colIndex}`} className="loading-table-skeleton__cell" />
          ))}
        </div>
      ))}
    </div>
  );
};

export const CardSkeletonLoader = ({ count = 3 }) => {
  return (
    <div className="loading-card-skeleton">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="loading-card-skeleton__item">
          <div className="loading-card-skeleton__title" />

          {Array.from({ length: 3 }).map((_, lineIndex) => (
            <div
              key={lineIndex}
              className={`loading-card-skeleton__line${lineIndex === 2 ? ' loading-card-skeleton__line--short' : ''}`}
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
  CardSkeletonLoader,
  DataTableSkeletonLoader,
  ContentSkeletonLoader,
  TileSkeletonLoader
};

