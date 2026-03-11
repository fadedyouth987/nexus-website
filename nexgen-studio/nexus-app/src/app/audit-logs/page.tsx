import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default async function AuditLogsPage() {
  const cookieStore = await cookies()
  const supabase = await createClient(cookieStore)

  const { data: auditLogs } = await supabase
    .from("audit_logs")
    .select("*, users(email)")
    .order("timestamp", { ascending: false })

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Audit Logs</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Actor</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>Timestamp</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {auditLogs?.map((log) => (
            <TableRow key={log.id}>
              <TableCell>{log.users.email}</TableCell>
              <TableCell>{log.action}</TableCell>
              <TableCell>{log.target_resource}</TableCell>
              <TableCell>{new Date(log.timestamp).toLocaleString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
