import React from 'react';

const Placeholder = ({ title, icon, description, children }) => {
  return (
    <div className="card">
      <div className="text-center p-8">
        <div className="text-5xl mb-4">{icon || '🚧'}</div>
        <h2 className="text-2xl font-bold mb-3">{title}</h2>
        <p className="text-muted mb-6">{description || 'This feature is coming soon!'}</p>
        
        {children || (
          <div className="inline-flex items-center gap-2 text-sm text-primary">
            <span className="animate-pulse">●</span>
            <span>Under Development</span>
            <span className="animate-pulse">●</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Placeholder;