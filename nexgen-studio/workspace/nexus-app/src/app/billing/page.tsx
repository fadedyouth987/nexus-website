'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY as string);

function CheckoutForm() {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [amount, setAmount] = useState(1000);
  const [currency, setCurrency] = useState('usd');
  const [description, setDescription] = useState('AI Influencer Package');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1. Create payment intent on backend
      const res = await fetch('/api/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, currency, description })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to create payment intent');

      // 2. Confirm card payment
      const { error, paymentIntent } = await stripe!.confirmCardPayment(data.clientSecret, {
        payment_method: {
          card: elements!.getElement(CardElement)!,
          billing_details: { name: 'Customer Name' }
        }
      });

      if (error) throw new Error(error.message);

      // 3. Redirect to success page
      router.push('/billing/success');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-8 rounded-lg shadow-md max-w-lg mx-auto">
      <h2 className="text-2xl font-bold">Subscribe</h2>

      <div>
        <label className="block mb-1">Amount (cents)</label>
        <input
          type="number"
          value={amount}
          onChange={e => setAmount(Number(e.target.value))}
          className="w-full border p-2 rounded"
          min="1"
        />
      </div>

      <div>
        <label className="block mb-1">Currency</label>
        <select value={currency} onChange={e => setCurrency(e.target.value)} className="w-full border p-2 rounded">
          <option value="usd">USD</option>
          <option value="eur">EUR</option>
          <option value="aud">AUD</option>
        </select>
      </div>

      <div>
        <label className="block mb-1">Description</label>
        <input
          type="text"
          value={description}
          onChange={e => setDescription(e.target.value)}
          className="w-full border p-2 rounded"
        />
      </div>

      <CardElement className="p-2 border rounded" />

      {error && <p className="text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={!stripe || loading}
        className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700"
      >
        {loading ? 'Processing…' : 'Pay Now'}
      </button>
    </form>
  );
}

export default function BillingPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <h1 className="text-3xl font-bold text-center mb-8">AI Influencer Nexus – Billing</h1>
      <Elements stripe={stripePromise}>
        <CheckoutForm />
      </Elements>
    </div>
  );
}