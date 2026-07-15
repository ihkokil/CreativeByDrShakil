import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/db";
import { hashToken } from "@/lib/token-utils";

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Missing verification token." }, { status: 400 });
    }

    const tokenHash = await hashToken(token);
    const supabase = getSupabase();

    const { data: user, error: userError } = await supabase
      .from('User')
      .select('*')
      .eq('emailVerificationTokenHash', tokenHash)
      .gt('emailVerificationExpires', new Date().toISOString())
      .limit(1)
      .maybeSingle();

    if (userError) throw userError;

    if (!user) {
      return NextResponse.json({ error: "Verification link is invalid or expired." }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from('User')
      .update({
        emailVerified: true,
        emailVerificationTokenHash: null,
        emailVerificationExpires: null,
      })
      .eq('id', user.id);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, message: "Email verified successfully." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error." }, { status: 500 });
  }
}
