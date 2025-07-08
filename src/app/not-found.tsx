export default function NotFound() {
  return (
    <div className="h-screen flex flex-col items-center justify-center text-center">
      <h1 className="text-5xl font-bold text-red-600">404</h1>
      <p className="mt-4 text-lg text-gray-600">Trang bạn tìm kiếm không tồn tại</p>
      <a href="/" className="mt-6 text-blue-500 underline">Quay về trang chủ</a>
    </div>
  )
}