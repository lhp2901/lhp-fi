export default function SavingsLoading() {
return ( <main className="min-h-screen space-y-6 bg-zinc-950 p-4 text-white md:p-6"> <div className="animate-pulse space-y-3"> <div className="h-8 w-64 rounded-lg bg-zinc-800" /> <div className="h-4 w-80 max-w-full rounded bg-zinc-800" /> </div>


  <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
    {Array.from({ length: 4 }).map((_, index) => (
      <div
        key={index}
        className="animate-pulse rounded-xl border border-zinc-800 bg-zinc-900 p-5"
      >
        <div className="h-4 w-32 rounded bg-zinc-800" />
        <div className="mt-5 h-7 w-40 max-w-full rounded bg-zinc-800" />
      </div>
    ))}
  </section>

  <section className="animate-pulse rounded-xl border border-zinc-800 bg-zinc-900 p-5">
    <div className="h-6 w-56 rounded bg-zinc-800" />

    <div className="mt-6 space-y-4">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="h-12 rounded-lg bg-zinc-800/70"
        />
      ))}
    </div>
  </section>

  <p className="text-center text-sm text-zinc-500">
    💰 Đang tải dữ liệu tiền gửi tiết kiệm...
  </p>
</main>


)
}
