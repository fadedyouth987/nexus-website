import MainLayout from '@/app/main-layout'

export default function LearnLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <MainLayout>{children}</MainLayout>
}

