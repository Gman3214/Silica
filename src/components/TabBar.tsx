import React from 'react';
import NoteTabs from './NoteTabs';
import './TabBar.css';

interface Tab {
  path: string;
  name: string;
}

interface TabBarProps {
  tabs: Tab[];
  activeTab: string | null;
  onTabSelect: (path: string) => void;
  onTabClose: (path: string) => void;
  onTabsReorder: (tabs: Tab[]) => void;
}

const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTab,
  onTabSelect,
  onTabClose,
  onTabsReorder,
}) => {
  if (tabs.length === 0) return null;

  return (
    <NoteTabs
      tabs={tabs}
      activeTab={activeTab}
      onTabSelect={onTabSelect}
      onTabClose={onTabClose}
      onTabsReorder={onTabsReorder}
    />
  );
};

export default TabBar;
