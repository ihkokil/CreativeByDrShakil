import React from 'react';
import styles from './Loader.module.css';

interface LoaderProps {
  text?: string;
  fullScreen?: boolean;
  variant?: 'fullscreen' | 'inline' | 'button';
}

export default function Loader({ text = "Loading...", fullScreen = false, variant }: LoaderProps) {
  // Backwards compatibility for fullScreen prop
  const currentVariant = variant || (fullScreen ? 'fullscreen' : 'inline');
  
  if (currentVariant === 'button') {
    return (
      <div className={`${styles.spinner} ${styles.buttonSpinner}`}>
        <div className={styles.bounce1}></div>
        <div className={styles.bounce2}></div>
        <div className={styles.bounce3}></div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${currentVariant === 'fullscreen' ? styles.fullScreen : styles.inline}`}>
      <div className={styles.spinner}>
        <div className={styles.bounce1}></div>
        <div className={styles.bounce2}></div>
        <div className={styles.bounce3}></div>
      </div>
      {text && <div className={styles.text}>{text}</div>}
    </div>
  );
}
