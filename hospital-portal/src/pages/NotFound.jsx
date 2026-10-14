import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <h1 className="text-5xl font-bold text-foreground">404</h1>
      <p className="mt-2 text-muted-foreground">This page could not be found.</p>
      <Link to="/patients" className="btn-brand mt-6">
        Back to patients
      </Link>
    </div>
  )
}
