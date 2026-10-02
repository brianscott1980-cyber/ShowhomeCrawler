-- Versioned question-specific answers preserve both positive and negative results.
create table public.image_classifications (
 id uuid primary key default gen_random_uuid(),
 image_id uuid not null references public.images on delete cascade,
 question text not null, question_version text not null,
 ai_model text not null, matches boolean not null,
 has_desk boolean not null, has_bed boolean not null,
 reason text not null, analysed_at timestamptz not null default now(),
 check(not matches or (has_desk and not has_bed)),
 unique(image_id, question_version, ai_model)
);
alter table public.image_classifications enable row level security;
create index image_classifications_matches_idx on public.image_classifications(image_id) where matches;
