export default function ForbiddenPage() {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center text-center">
      <h1 className="text-4xl font-bold text-red-600">🚫 Không có quyền truy cập</h1>
      <p className="mt-4 text-gray-600">Bạn không được phép vào trang này.</p>
    </div>
  )
}