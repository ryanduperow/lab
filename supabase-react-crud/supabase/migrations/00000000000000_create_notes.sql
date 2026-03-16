-- Create notes table
create table public.notes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null default auth.uid(),
  title text not null,
  body text default '',
  created_at timestamptz default now() not null
);

-- Enable Row Level Security
alter table public.notes enable row level security;

-- Policy: users can only see their own notes
create policy "Users can view own notes"
  on public.notes for select
  using (auth.uid() = user_id);

-- Policy: users can insert their own notes
create policy "Users can insert own notes"
  on public.notes for insert
  with check (auth.uid() = user_id);

-- Policy: users can delete their own notes
create policy "Users can delete own notes"
  on public.notes for delete
  using (auth.uid() = user_id);
