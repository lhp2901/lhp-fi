import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const { email } = await req.json()

  const { data, error } = await supabaseAdmin.auth.admin.listUsers()

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  const user = data.users.find((u: any) => u.email === email)

  if (!user) {
    return new Response(JSON.stringify({ exists: false }), { status: 200 })
  }

  return new Response(
    JSON.stringify({
      exists: true,
      confirmed: user.email_confirmed_at !== null,
      provider: user.app_metadata?.provider || 'email',
    }),
    { status: 200 }
  )
}
