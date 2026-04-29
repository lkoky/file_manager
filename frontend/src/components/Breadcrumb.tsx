import React from 'react';

interface BreadcrumbProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  rootName?: string;  // 根目录显示名称
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ currentPath, onNavigate, rootName }) => {
  // 将路径拆分为 segments
  const segments = currentPath ? currentPath.split('/') : [];

  const handleClick = (index: number) => {
    if (index === -1) {
      // 点击根目录
      onNavigate('');
    } else {
      const path = segments.slice(0, index + 1).join('/');
      onNavigate(path);
    }
  };

  const displayRootName = rootName || '根目录';

  return (
    <nav className="breadcrumb">
      <span
        className="breadcrumb-item"
        onClick={() => handleClick(-1)}
      >
        🏠 {displayRootName}
      </span>
      {segments.map((_, index) => (
        <span key={index} className="breadcrumb-separator">
          /
        </span>
      ))}
      {segments.map((segment, index) => (
        <span
          key={index}
          className={`breadcrumb-item ${index === segments.length - 1 ? 'current' : ''}`}
          onClick={() => handleClick(index)}
        >
          {segment}
        </span>
      ))}
    </nav>
  );
};

export default Breadcrumb;
