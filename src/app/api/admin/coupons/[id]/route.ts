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

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const adminCheck = await requireAdmin(request)
    if (!adminCheck.ok) return adminCheck.response

    const { id } = await context.params
    const body = await request.json()

    const code = body?.code ? String(body.code).trim().toUpperCase() : undefined
    const discountAmount = body?.discountAmount !== undefined ? Number(body.discountAmount) : undefined
    const maxUses = body?.maxUses !== undefined ? Number(body.maxUses) : undefined
    const isActive = body?.isActive !== undefined ? Boolean(body.isActive) : undefined
    const usedCount = body?.usedCount !== undefined ? Number(body.usedCount) : undefined

    if (discountAmount !== undefined && (Number.isNaN(discountAmount) || discountAmount < 0)) {
      return NextResponse.json({ error: 'Invalid discount amount.' }, { status: 400 })
    }

    if (maxUses !== undefined && (Number.isNaN(maxUses) || maxUses < -1)) {
      return NextResponse.json({ error: 'maxUses must be -1 or greater.' }, { status: 400 })
    }

    if (usedCount !== undefined && (Number.isNaN(usedCount) || usedCount < 0)) {
      return NextResponse.json({ error: 'usedCount must be 0 or greater.' }, { status: 400 })
    }

    const coupon = await prisma.coupon.update({
      where: { id },
      data: {
        ...(code ? { code } : {}),
        ...(discountAmount !== undefined ? { discountAmount } : {}),
        ...(maxUses !== undefined ? { maxUses } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        ...(usedCount !== undefined ? { usedCount } : {}),
      },
    })

    return NextResponse.json({ coupon })
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'Coupon not found.' }, { status: 404 })
    }
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Coupon code already exists.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const adminCheck = await requireAdmin(request)
    if (!adminCheck.ok) return adminCheck.response

    const { id } = await context.params
    await prisma.coupon.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'Coupon not found.' }, { status: 404 })
    }
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 })
  }
}
