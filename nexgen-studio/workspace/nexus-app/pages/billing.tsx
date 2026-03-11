'use client'

import { useRouter } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { useSession } from 'next-auth/react';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY as string);

export default function BillingPage() {
  const router = useRouter();
  const [session] = useSession();
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-12 px-4 sm:py-16 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900">AI Influencer Nexus</h1>
          <p className="text-xl text-gray-600">Your AI-powered content creation platform</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">Billing</h2>
            
            <div className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h8a2 2 0 012 2v14a2 2 0 01-2 2H3a2 2 0 01-2-2V3a2 2 0 012-2h8m0 0h1M3 16V6a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H3" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-lg font-medium">Subscription Plan</h3>
                      <p className="text-sm text-gray-600">Monthly access to premium features</p>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700">Amount</label>
                    <div className="mt-1">
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50"
                        defaultValue="10"
                      />
                    </div>
                  </div>
                  
                  <div className="mt-6">
                    <label className="block text-sm font-medium text-gray-700">Currency</label>
                    <div className="mt-1">
                      <select
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50"
                        defaultValue="usd"
                      >
                        <option value="usd">USD ($)</option>
                        <option value="eur">EUR (€)</option>
                        <option value="gbp">GBP (£)</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="mt-6">
                    <label className="block text-sm font-medium text-gray-700">Description</label>
                    <div className="mt-1">
                      <textarea
                        rows="3"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="AI Influencer Studio subscription"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-8">
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full bg-indigo-600 text-white hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50"
              >
                <span className="flex items-center">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h-5l-5 5M15 3l2.586 2.586a8 8 0 0 1-.888.051h.044M21 12a9 9 0 11-18 0 9 9 0 0112 0z" />
                  </svg>
                  Continue to Dashboard
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BillingPage;