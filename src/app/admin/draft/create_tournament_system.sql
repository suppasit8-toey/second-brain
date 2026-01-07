
-- Tournaments Table
create table if not exists tournaments (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    slug text unique,
    start_date date,
    end_date date,
    status text default 'upcoming' check (status in ('upcoming', 'ongoing', 'completed')),
    created_at timestamp with time zone default now()
);

-- Teams Table (Scoped to a Tournament)
create table if not exists teams (
    id uuid default gen_random_uuid() primary key,
    tournament_id uuid references tournaments(id) on delete cascade not null,
    name text not null,
    short_name text,
    logo_url text,
    created_at timestamp with time zone default now()
);

-- RLS Policies
alter table tournaments enable row level security;
alter table teams enable row level security;

create policy "Enable all access for tournaments" on tournaments for all using (true) with check (true);
create policy "Enable all access for teams" on teams for all using (true) with check (true);
