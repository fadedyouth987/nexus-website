import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '../../../stripe';

export async function POST(request: NextRequest) {
  try {
    const { amount, currency, description } = await request.json();

    // Validate input
    if (!amount || !currency || !description) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      description,
      metadata: { description }
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      id: paymentIntent.id
    });
  } catch (error: any) {
    console.error('Billing error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}