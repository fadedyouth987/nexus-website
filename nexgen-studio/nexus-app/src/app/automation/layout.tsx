import MainLayout from '@/app/main-layout'

export default function AutomationLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <MainLayout>{children}</MainLayout>
}
