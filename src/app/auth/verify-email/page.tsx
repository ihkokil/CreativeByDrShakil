import VerifyEmailClient from "./VerifyEmailClient";

interface VerifyEmailPageProps {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
    const params = await searchParams;
    const rawToken = params.token;
    const token = Array.isArray(rawToken) ? rawToken[0] : rawToken || "";

    return <VerifyEmailClient token={token} />;
}
