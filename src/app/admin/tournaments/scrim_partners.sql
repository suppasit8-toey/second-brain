-- Create junction table for Scrim Partners
create table if not exists tournament_scrim_partners (
    tournament_id uuid references tournaments(id) on delete cascade,
    team_id uuid references teams(id) on delete cascade,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    primary key (tournament_id, team_id)
);

-- Enable RLS (optional, depending on policy)
alter table tournament_scrim_partners enable row level security;

-- Policy for reading
create policy "Public read access"
  on tournament_scrim_partners for select
  using ( true );

-- Policy for insert/delete (authenticated)
create policy "Authenticated insert access"
  on tournament_scrim_partners for insert
  with check ( auth.role() = 'authenticated' );

create policy "Authenticated delete access"
  on tournament_scrim_partners for delete
  using ( auth.role() = 'authenticated' );
