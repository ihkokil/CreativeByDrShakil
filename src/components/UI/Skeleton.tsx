import React from 'react';
import styles from './Skeleton.module.css';

interface SkeletonProps {
    width?: string | number;
    height?: string | number;
    borderRadius?: string | number;
    className?: string;
    style?: React.CSSProperties;
}

export default function Skeleton({ 
    width = '100%', 
    height = '20px', 
    borderRadius = '4px',
    className = '',
    style = {}
}: SkeletonProps) {
    return (
        <div 
            className={`${styles.skeleton} ${className}`}
            style={{
                width,
                height,
                borderRadius,
                ...style
            }}
        />
    );
}

// A pre-built skeleton for a standard card
export function CardSkeleton() {
    return (
        <div style={{ padding: '20px', border: '1px solid var(--glass-border)', borderRadius: '8px', background: 'var(--card-bg)' }}>
            <Skeleton height="150px" borderRadius="8px" style={{ marginBottom: '16px' }} />
            <Skeleton height="24px" width="70%" style={{ marginBottom: '12px' }} />
            <Skeleton height="16px" width="100%" style={{ marginBottom: '8px' }} />
            <Skeleton height="16px" width="90%" style={{ marginBottom: '16px' }} />
            <div style={{ display: 'flex', gap: '10px' }}>
                <Skeleton height="36px" width="100px" borderRadius="18px" />
                <Skeleton height="36px" width="100px" borderRadius="18px" />
            </div>
        </div>
    );
}

// A pre-built skeleton for a list item
export function ListItemSkeleton() {
    return (
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--glass-border)' }}>
            <Skeleton width="48px" height="48px" borderRadius="50%" style={{ marginRight: '16px', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
                <Skeleton height="20px" width="40%" style={{ marginBottom: '8px' }} />
                <Skeleton height="14px" width="60%" />
            </div>
            <Skeleton height="32px" width="80px" borderRadius="16px" style={{ marginLeft: '16px' }} />
        </div>
    );
}
