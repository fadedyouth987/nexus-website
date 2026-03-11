import MainLayout from '@/app/main-layout'

export default function PlannerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <MainLayout>{children}</MainLayout>
}
