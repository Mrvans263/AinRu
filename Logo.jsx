// Logo.jsx - Main Logo Component
import React from 'react';
import './Logo.css';

const Logo = ({ size = 'medium', variant = 'full', className = '' }) => {
  const sizes = {
    small: 'h-8 w-8',
    medium: 'h-12 w-12',
    large: 'h-16 w-16',
    xlarge: 'h-20 w-20'
  };

  return (
    <div className={`logo-container ${className}`}>
      {variant === 'icon' ? (
        <div className="logo-icon-wrapper">
          {/* Icon-only logo */}
          <div className="logo-icon-animated">
            <div className="logo-icon-circle">
              <div className="logo-icon-africa">
                <span className="icon-star">⭐</span>
                <span className="icon-wave">🌊</span>
              </div>
              <div className="logo-icon-russia">
                <span className="icon-snow">❄️</span>
                <span className="icon-star">⭐</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        {/* Full logo with text */}
        <div className="logo-full">
          <div className="logo-icon-wrapper">
            <div className="logo-icon-animated">
              <div className="logo-icon-circle">
                <div className="logo-icon-africa">
                  <span className="icon-star">⭐</span>
                  <span className="icon-wave">🌊</span>
                </div>
                <div className="logo-icon-russia">
                  <span className="icon-snow">❄️</span>
                  <span className="icon-star">⭐</span>
                </div>
              </div>
            </div>
          </div>
          <div className="logo-text">
            <span className="logo-text-ain">Ain</span>
            <span className="logo-text-ru">Ru</span>
            <div className="logo-tagline">Africans in Russia</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Logo;