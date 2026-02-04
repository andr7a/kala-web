// API-free app: no real authentication gate.

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  return <>{children}</>;
}
