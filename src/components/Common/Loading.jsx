import React from 'react';
import './Common.css';

const Loading = ({ message = 'Loading...', fullscreen = false }) => {
  const content = (
    <div className="loading-container">
      <div className="loading-spinner">
        <div className="spinner-circle"></div>
        <div className="spinner-inner"></div>
      </div>
      <p className="loading-text">{message}</p>
    </div>
  );

  if (fullscreen) {
    return (
      <div className="loading-fullscreen">
        {content}
      </div>
    );
  }

  return content;
};

export default Loading;