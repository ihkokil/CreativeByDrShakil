import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

export function useDashboardData() {
    const { user } = useAuth();
    const [data, setData] = useState<any>(null);
    const [fetching, setFetching] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!user) return;
        const fetchDashboard = async () => {
            setFetching(true);
            setError(null);
            try {
                const token = localStorage.getItem("auth_token");
                const res = await fetch("/api/me/dashboard", {
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                });
                const d = await res.json();
                if (res.ok) {
                    setData(d);
                } else {
                    setError(d.error || "Could not load dashboard data.");
                }
            } catch (err) {
                setError("Network error when loading dashboard.");
            } finally {
                setFetching(false);
            }
        };
        fetchDashboard();
    }, [user]);

    return { data, setData, fetching, error };
}
