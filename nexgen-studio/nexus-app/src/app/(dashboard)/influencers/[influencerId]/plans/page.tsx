'use client'

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import apiFetch from "@/lib/core/api";

export default function ContentPlansPage({ params }: { params: { influencerId: string } }) {
  const [plans, setPlans] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Form state
  const [theme, setTheme] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const fetchPlans = async () => {
      setIsLoading(true);
      try {
        const response = await apiFetch(`/influencers/${params.influencerId}/plans`);
        if (!response.ok) throw new Error("Failed to fetch content plans");
        const data = await response.json();
        setPlans(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPlans();
  }, [params.influencerId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const payload = {
      theme,
      notes,
      date: new Date(date).toISOString(),
    };

    try {
      const response = await apiFetch(`/influencers/${params.influencerId}/plan`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to create content plan");
      }
      
      // Refresh the list of plans
      router.refresh();
      // Reset form
      setTheme("");
      setNotes("");
      setDate(new Date().toISOString().split('T')[0]);
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (isLoading) return <div className="p-8">Loading content plans...</div>;
  if (error && !plans.length) return <div className="p-8 text-red-500">Error: {error}</div>;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-8">Content Plans</h1>
      <div className="grid gap-8 md:grid-cols-3">
        <div className="md:col-span-2">
          <h2 className="text-2xl font-bold mb-4">Existing Plans</h2>
          {error && <p className="text-red-500 mb-4">{error}</p>}
          {plans.length === 0 ? (
            <p>No content plans created yet.</p>
          ) : (
            <div className="space-y-4">
              {plans.map((plan) => (
                <Card key={plan.id}>
                  <CardHeader>
                    <CardTitle>{plan.theme}</CardTitle>
                    <CardDescription>Date: {new Date(plan.date).toLocaleDateString()}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p>{plan.notes}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Create New Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="date">Date</Label>
                  <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
                </div>
                <div>
                  <Label htmlFor="theme">Theme</Label>
                  <Input id="theme" value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="e.g., 'Morning routine selfie'" required />
                </div>
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g., 'Post with a coffee cup, high engagement time'" />
                </div>
                <Button type="submit" className="w-full">Create Plan</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
