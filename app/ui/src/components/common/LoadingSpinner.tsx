import React from "react";

interface LoadingSpinnerProps {
  size?: number;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 20 }) => (
  <span
    className="spinner"
    style={{ width: size, height: size }}
    role="status"
    aria-hidden="true"
  />
);

export default LoadingSpinner;
