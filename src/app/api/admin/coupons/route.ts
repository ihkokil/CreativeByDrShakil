import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { extractBearerToken, extractCookieToken, verifyAuthToken } from '@/lib/auth-server'

async function requireAdmin(request: NextRequest) {
  const bearerToken = extractBearerToken(request)
  const cookieToken = await extractCookieToken()
  const token = bearerToken || cookieToken

  if (!token) {
    return { ok: false as const, response: NextResponse.json({ error: 'Unauthorized.' }, { status: 401 }) }
  }

  const payload = verifyAuthToken(token)
  if (payload.role !== 'admin') {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Forbidden: Admin access required.' }, { status: 403 }),
    }
  }

  return { ok: true as const }
}

export async function GET(request: NextRequest) {
  try {
    const adminCheck = await requireAdmin(request)
    if (!adminCheck.ok) return adminCheck.response

    const coupons = await prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ coupons })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminCheck = await requireAdmin(request)
    if (!adminCheck.ok) return adminCheck.response

    const body = await request.json()
    const code = String(body?.code || '').trim().toUpperCase()
    const discountAmount = Number(body?.discountAmount)
    const maxUses = Number(body?.maxUses ?? -1)
    const isActive = Boolean(body?.isActive ?? true)

    if (!code) {
      return NextResponse.json({ error: 'Coupon code is required.' }, { status: 400 })
    }

    if (Number.isNaN(discountAmount) || discountAmount < 0) {
      return NextResponse.json({ error: 'Valid discount amount is required.' }, { status: 400 })
    }

    if (Number.isNaN(maxUses) || maxUses < -1) {
      return NextResponse.json({ error: 'maxUses must be -1 or greater.' }, { status: 400 })
    }

    const coupon = await prisma.coupon.create({
      data: {
        code,
        discountAmount,
        maxUses,
        isActive,
      },
    })

    return NextResponse.json({ coupon }, { status: 201 })
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Coupon code already exists.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 })
  }
}
