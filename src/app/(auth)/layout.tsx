export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Hotel Rawana</h1>
          <p className="text-sm text-muted-foreground">Property Management &amp; Point of Sale</p>
        </div>
        {children}
      </div>
    </div>
  );
}
