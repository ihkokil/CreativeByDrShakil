import React from 'react';
import styles from './Loader.module.css';

interface LoaderProps {
  text?: string;
  fullScreen?: boolean;
}

export default function Loader({ text = "Loading...", fullScreen = true }: LoaderProps) {
  return (
    <div className={`${styles.container} ${fullScreen ? styles.fullScreen : styles.inline}`}>
      <div className={styles.spinner}>
        <div className={styles.bounce1}></div>
        <div className={styles.bounce2}></div>
        <div className={styles.bounce3}></div>
      </div>
      {text && <div className={styles.text}>{text}</div>}
    </div>
  );
}
