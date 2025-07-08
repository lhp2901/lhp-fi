export default function Loading() {
  return (
    <div className="h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-500"></div>
      <span className="ml-4 text-gray-500">Đang tải dữ liệu...</span>
    </div>
  )
}
