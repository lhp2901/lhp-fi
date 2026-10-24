import type { SavingsDeposit } from './types'

const DAY_IN_MS = 24 * 60 * 60 * 1000

/**
 * Chuyển ngày YYYY-MM-DD thành timestamp UTC.
 * Tránh sai lệch số ngày do múi giờ.
 */
function parseDate(date: string): number {
  const parts = date.split('-').map(Number)

  if (
    parts.length !== 3 ||
    parts.some((part) => !Number.isFinite(part))
  ) {
    throw new Error('Ngày không hợp lệ')
  }

  const [year, month, day] = parts

  const timestamp = Date.UTC(year, month - 1, day)
  const parsedDate = new Date(timestamp)

  // Kiểm tra ngày thực tế, ví dụ không chấp nhận 31/02.
  if (
    parsedDate.getUTCFullYear() !== year ||
    parsedDate.getUTCMonth() !== month - 1 ||
    parsedDate.getUTCDate() !== day
  ) {
    throw new Error('Ngày không hợp lệ')
  }

  return timestamp
}

/**
 * Định dạng tiền theo chuẩn Việt Nam.
 * Ví dụ: 230000000 -> 230.000.000 đ
 */
export function formatVND(value: number): string {
  const safeValue = Number.isFinite(value) ? value : 0

  return (
    new Intl.NumberFormat('vi-VN', {
      maximumFractionDigits: 0,
    }).format(safeValue) + ' đ'
  )
}

/**
 * Lấy ngày hiện tại theo giờ địa phương, định dạng YYYY-MM-DD.
 */
function getLocalDateString(today: Date = new Date()): string {
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-')
}

/**
 * Tính số ngày giữa hai ngày.
 * Ngày kết thúc bằng ngày bắt đầu thì kết quả là 0.
 */
export function getDaysBetween(
  startDate: string,
  endDate: string
): number {
  return Math.max(
    0,
    Math.round(
      (parseDate(endDate) - parseDate(startDate)) / DAY_IN_MS
    )
  )
}

/**
 * Tính số ngày còn lại đến ngày đáo hạn.
 * Số âm nghĩa là đã quá hạn.
 */
export function getDaysRemaining(
  maturityDate: string,
  today: Date = new Date()
): number {
  return Math.round(
    (parseDate(maturityDate) - parseDate(getLocalDateString(today))) /
      DAY_IN_MS
  )
}

/**
 * Ước tính tiền lãi đơn theo số ngày thực tế / 365.
 *
 * Công thức:
 * Tiền gốc × Lãi suất năm (%) × Số ngày / 365
 *
 * Đây là giá trị tham khảo, không thay thế cách tính lãi
 * chính thức của ngân hàng.
 */
export function calculateExpectedInterest(
  deposit: Pick<
    SavingsDeposit,
    | 'principal'
    | 'annual_interest_rate'
    | 'start_date'
    | 'maturity_date'
  >
): number {
  const principal = Number(deposit.principal)
  const annualRate = Number(deposit.annual_interest_rate)

  if (
    !Number.isFinite(principal) ||
    !Number.isFinite(annualRate) ||
    principal < 0 ||
    annualRate < 0
  ) {
    return 0
  }

  const days = getDaysBetween(
    deposit.start_date,
    deposit.maturity_date
  )

  return principal * (annualRate / 100) * (days / 365)
}

/**
 * Tính lãi tạm tính tích lũy từ ngày gửi đến hôm nay.
 *
 * Chỉ tính cho khoản đang gửi (ACTIVE).
 * Nếu chưa đến ngày gửi thì lãi bằng 0.
 * Nếu đã qua ngày đáo hạn thì dừng tính tại ngày đáo hạn.
 *
 * Lưu ý: Đây là lãi đơn tham khảo, chưa tính lãi kép,
 * thuế/phí hoặc quy tắc riêng của từng ngân hàng.
 */
export function calculateCurrentInterest(
  deposit: SavingsDeposit,
  today: Date = new Date()
): number {
  if (deposit.status !== 'ACTIVE') {
    return 0
  }

  const principal = Number(deposit.principal)
  const annualRate = Number(deposit.annual_interest_rate)

  if (
    !Number.isFinite(principal) ||
    !Number.isFinite(annualRate) ||
    principal < 0 ||
    annualRate < 0
  ) {
    return 0
  }

  const todayString = getLocalDateString(today)

  // Ngày tính lãi không vượt quá ngày đáo hạn.
  const endDate =
    todayString < deposit.maturity_date
      ? todayString
      : deposit.maturity_date

  const days = getDaysBetween(deposit.start_date, endDate)

  return principal * (annualRate / 100) * (days / 365)
}

/**
 * Tổng tiền gốc và lãi dự kiến cuối kỳ.
 */
export function calculateMaturityValue(
  deposit: Pick<
    SavingsDeposit,
    | 'principal'
    | 'annual_interest_rate'
    | 'start_date'
    | 'maturity_date'
  >
): number {
  return (
    Number(deposit.principal) +
    calculateExpectedInterest(deposit)
  )
}

/**
 * Tổng quan các khoản đang gửi và đã đến hạn.
 */
export function getSavingsSummary(
  deposits: SavingsDeposit[]
) {
  const eligibleDeposits = deposits.filter(
    (deposit) =>
      deposit.status === 'ACTIVE' ||
      deposit.status === 'MATURED'
  )

  const totalPrincipal = eligibleDeposits.reduce(
    (sum, deposit) => sum + Number(deposit.principal || 0),
    0
  )

  const expectedInterest = eligibleDeposits.reduce(
    (sum, deposit) =>
      sum + calculateExpectedInterest(deposit),
    0
  )

  const currentInterest = eligibleDeposits.reduce(
    (sum, deposit) =>
      sum + calculateCurrentInterest(deposit),
    0
  )

  const weightedInterestRate =
    totalPrincipal > 0
      ? eligibleDeposits.reduce(
          (sum, deposit) =>
            sum +
            Number(deposit.principal || 0) *
              Number(deposit.annual_interest_rate || 0),
          0
        ) / totalPrincipal
      : 0

  return {
    totalPrincipal,
    expectedInterest,
    currentInterest,
    expectedMaturityValue: totalPrincipal + expectedInterest,
    weightedInterestRate,
    activeDepositCount: eligibleDeposits.length,
  }
}