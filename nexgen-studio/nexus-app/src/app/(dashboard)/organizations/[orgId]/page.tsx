import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { Sidebar } from "@/components/layout/Sidebar"

export default async function OrganizationPage({
  params,
}: {
  params: { orgId: string }
}) {
  const cookieStore = await cookies()
  const supabase = await createClient(cookieStore)

  const { data: organization } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", params.orgId)
    .single()

  return (
    <div className="flex">
      <Sidebar orgId={params.orgId} />
      <main className="flex-1 p-8">
        <h1 className="text-3xl font-bold mb-8">
          {organization?.name} Overview
        </h1>
        {/* Overview content will go here */}
      </main>
    </div>
  )
}
