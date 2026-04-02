import ResetPasswordClient from "./ResetPasswordClient";

interface ResetPasswordPageProps {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
    const params = await searchParams;
    const rawToken = params.token;
    const token = Array.isArray(rawToken) ? rawToken[0] : rawToken || "";

    return <ResetPasswordClient token={token} />;
}
