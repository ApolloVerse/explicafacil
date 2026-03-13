-- Create analyses table
create table analyses (
  id uuid default uuid_generate_v4() primary key,
  file_name text not null,
  result text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create messages table
create table messages (
  id uuid default uuid_generate_v4() primary key,
  user_msg text not null,
  assist_msg text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Setup Row Level Security (RLS) policies
alter table analyses enable row level security;
alter table messages enable row level security;

-- Allow anonymous inserts (since there's no auth yet)
create policy "Allow anonymous inserts for analyses" on analyses for insert with check (true);
create policy "Allow anonymous select for analyses" on analyses for select using (true);

create policy "Allow anonymous inserts for messages" on messages for insert with check (true);
create policy "Allow anonymous select for messages" on messages for select using (true);
