// Session management helpers
import { supabase } from './supabaseClient'

export async function createSession(name, mode, userId, displayName) {
  // 1. Ensure user profile exists
  await supabase.from('users').upsert({
    id: userId,
    display_name: displayName,
    email: (await supabase.auth.getUser()).data.user.email
  })

  // 2. Generate invite code
  const code = mode.toUpperCase().slice(0, 2) + '-' + Math.floor(1000 + Math.random() * 9000)

  // 3. Create session
  const { data: session, error } = await supabase
    .from('sessions')
    .insert({ name, mode, invite_code: code })
    .select().single()

  if (error) throw error

  // 4. Add creator as admin member
  const { error: memberError } = await supabase
    .from('session_members')
    .insert({ session_id: session.id, user_id: userId, role: 'admin', can_invite: true })

  if (memberError) throw memberError

  // 5. Set up default features
  const features = ['calendar','economy','projects','budget','settlements','reports','messages','documents','map','offers']
  await supabase.from('session_features').insert(
    features.map(f => ({ session_id: session.id, feature: f, enabled: true }))
  )

  // 6. Set up default cost splits (equal)
  await supabase.from('cost_splits').insert({
    session_id: session.id, user_id: userId, percentage: 100
  })

  return session
}

export async function joinSession(inviteCode, userId, displayName) {
  // 1. Ensure user profile exists
  const { data: userData } = await supabase.auth.getUser()
  await supabase.from('users').upsert({
    id: userId,
    display_name: displayName,
    email: userData.user.email
  })

  // 2. Find session by invite code
  const { data: session, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('invite_code', inviteCode.toUpperCase())
    .single()

  if (error || !session) throw new Error('Invalid invite code. Please check and try again.')

  // 3. Check not already a member
  const { data: existing } = await supabase
    .from('session_members')
    .select('id')
    .eq('session_id', session.id)
    .eq('user_id', userId)
    .single()

  if (existing) throw new Error('You are already a member of this session.')

  // 4. Check session not full
  if (session.is_full) throw new Error('This session is currently closed to new members.')

  if (session.max_members) {
    const { count } = await supabase
      .from('session_members')
      .select('id', { count: 'exact' })
      .eq('session_id', session.id)
    if (count >= session.max_members) throw new Error('This session has reached its maximum number of members.')
  }

  // 5. Add as member
  const { error: memberError } = await supabase
    .from('session_members')
    .insert({ session_id: session.id, user_id: userId, role: 'member', can_invite: false })

  if (memberError) throw memberError

  // 6. Add to cost splits equally (admin will adjust later)
  await supabase.from('cost_splits').insert({
    session_id: session.id, user_id: userId, percentage: 0
  })

  return session
}

export async function getUserSessions(userId) {
  const { data, error } = await supabase
    .from('session_members')
    .select(`session_id, role, can_invite, sessions(id, name, mode, invite_code)`)
    .eq('user_id', userId)

  if (error) throw error
  return data || []
}
