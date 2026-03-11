import MainLayout from '@/app/main-layout'

export default function TemplatesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <MainLayout>{children}</MainLayout>
}
