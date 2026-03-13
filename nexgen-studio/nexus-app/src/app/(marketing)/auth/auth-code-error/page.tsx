export default function AuthCodeErrorPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Authentication Error</h1>
        <p className="text-lg text-muted-foreground">
          There was an error authenticating your account. Please try again.
        </p>
      </div>
    </div>
  )
}
