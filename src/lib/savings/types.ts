export type SavingsStatus =
| 'ACTIVE'
| 'MATURED'
| 'RENEWED'
| 'SETTLED'
| 'EARLY_WITHDRAWAL'

export type SavingsTermUnit =
| 'DAYS'
| 'MONTHS'
| 'YEARS'

export type SavingsPayoutMethod =
| 'MONTHLY'
| 'QUARTERLY'
| 'MATURITY'

export type SavingsRenewalType =
| 'PRINCIPAL_ONLY'
| 'PRINCIPAL_AND_INTEREST'

export interface SavingsDeposit {
id: string
user_id: string

bank_name: string
deposit_name: string
account_reference: string | null

currency: string
principal: number
annual_interest_rate: number

start_date: string
maturity_date: string

term_value: number
term_unit: SavingsTermUnit

interest_payout_method: SavingsPayoutMethod

auto_renewal: boolean
renewal_type: SavingsRenewalType

status: SavingsStatus
notes: string | null

created_at: string
updated_at: string
}

export interface SavingsDepositInput {
bank_name: string
deposit_name: string
account_reference?: string | null

currency: string
principal: number
annual_interest_rate: number

start_date: string
maturity_date: string

term_value: number
term_unit: SavingsTermUnit

interest_payout_method: SavingsPayoutMethod

auto_renewal: boolean
renewal_type: SavingsRenewalType

notes?: string | null
}
