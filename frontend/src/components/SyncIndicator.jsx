import { useEffect, useState } from 'react';
import { MdCloudDone, MdCloudSync, MdCloudOff, MdCloudQueue } from 'react-icons/md';
import { useData } from '../data.jsx';

const LABELS = {
  loading: { text: 'Loading…', title: 'Loading your data', Icon: MdCloudQueue },
  syncing: { text: 'Syncing', title: 'Saving changes to the cloud', Icon: MdCloudSync },
  offline: { text: 'Offline', title: 'No connection — changes will sync when you’re back online', Icon: MdCloudOff },
  synced: { text: 'Synced', title: 'Up to date across your devices', Icon: MdCloudDone },
};

export default function SyncIndicator() {
  const { status } = useData();
  // Hold the 'syncing' label briefly so quick acks are still visible.
  const [display, setDisplay] = useState(status);
  useEffect(() => {
    if (status === 'syncing') {
      setDisplay('syncing');
      return;
    }
    if (display === 'syncing') {
      const t = setTimeout(() => setDisplay(status), 400);
      return () => clearTimeout(t);
    }
    setDisplay(status);
  }, [status, display]);

  const { text, title, Icon } = LABELS[display] || LABELS.synced;

  return (
    <span
      className={`sync-indicator sync-${display}`}
      title={title}
      aria-live="polite"
      aria-label={title}
    >
      <Icon aria-hidden />
      <span className="sync-indicator-text">{text}</span>
    </span>
  );
}
