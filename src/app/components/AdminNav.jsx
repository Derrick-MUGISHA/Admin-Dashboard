import Link from 'next/link'

export default function AdminNav() {
  return (
    <div className="mb-6 border-b border-gray-200">
      <nav className="flex space-x-4">
        <Link 
          href="/admin/users" 
          className="px-3 py-2 text-sm font-medium text-gray-500 hover:text-primary.DARK"
        >
          Users
        </Link>
        <Link
          href="/admin/reports"
          className="px-3 py-2 text-sm font-medium text-gray-500 hover:text-secondary.DARK"
        >
          Reports
        </Link>
      </nav>
    </div>
  )
}