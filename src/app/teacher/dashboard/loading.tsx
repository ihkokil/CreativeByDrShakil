import { CardSkeleton } from "@/components/UI/Skeleton";

export default function Loading() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px' }}>
            <CardSkeleton />
            <CardSkeleton />
        </div>
    );
}
