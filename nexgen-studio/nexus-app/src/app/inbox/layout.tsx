import MainLayout from '@/app/main-layout'

export default function InboxLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <MainLayout>{children}</MainLayout>
}
