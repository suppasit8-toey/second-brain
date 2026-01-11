-- Draft Matches: Represents a series (BO1, BO3, etc.)
create table draft_matches (
    id uuid default gen_random_uuid() primary key,
    version_id bigint references versions(id) not null,
    team_a_name text not null,
    team_b_name text not null,
    mode text not null check (mode in ('BO1', 'BO2', 'BO3', 'BO4', 'BO5', 'BO7')),
    status text default 'ongoing' check (status in ('ongoing', 'finished')),
    winner text, -- 'Team A' or 'Team B'
    slug text unique, -- URL-friendly ID e.g., 20240107-01
    tournament_id uuid references tournaments(id),
    match_date date default CURRENT_DATE,
    created_at timestamp with time zone default now()
);

-- Draft Games: Represents a single game within a match
create table draft_games (
    id uuid default gen_random_uuid() primary key,
    match_id uuid references draft_matches(id) on delete cascade not null,
    game_number int not null,
    blue_team_name text not null, -- Snapshot of who is blue for this game
    red_team_name text not null,
    winner text, -- 'Blue' or 'Red'
    mvp_hero_id uuid references heroes(id),
    duration_seconds int, -- Optional: length of game
    created_at timestamp with time zone default now()
);

-- Draft Picks: Records every ban and pick in a game
create table draft_picks (
    id uuid default gen_random_uuid() primary key,
    game_id uuid references draft_games(id) on delete cascade not null,
    hero_id uuid references heroes(id) not null,
    type text not null check (type in ('BAN', 'PICK')),
    side text not null check (side in ('BLUE', 'RED')),
    position_index int not null, -- 1-5 for picks, 1-4 for bans (order matters)
    assigned_role text, -- 'Dark Slayer', 'Jungle', etc. (Only for Picks)
    created_at timestamp with time zone default now()
);
