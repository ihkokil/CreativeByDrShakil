import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')?.trim()

    if (!code) {
      return NextResponse.json({ error: 'Code required' }, { status: 400 })
    }

    const coupon = await prisma.coupon.findUnique({ where: { code } })

    if (!coupon || !coupon.isActive) {
      return NextResponse.json({ error: 'Invalid coupon' }, { status: 404 })
    }

    if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
      return NextResponse.json({ error: 'Coupon usage limit exceeded' }, { status: 400 })
    }

    return NextResponse.json({
      valid: true,
      discountAmount: coupon.discountAmount,
      code: coupon.code,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
