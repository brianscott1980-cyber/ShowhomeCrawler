alter table public.builders
 add column hbf_rating smallint check (hbf_rating between 1 and 5),
 add column hbf_rank integer check (hbf_rank > 0),
 add column hbf_year smallint,
 add column hbf_award_name text,
 add column hbf_source_url text,
 add column hbf_checked_at timestamptz,
 add column trustpilot_rating numeric(2,1) check (trustpilot_rating between 0 and 5),
 add column trustpilot_rank integer check (trustpilot_rank > 0),
 add column trustpilot_rank_category text,
 add column trustpilot_review_count integer check (trustpilot_review_count >= 0),
 add column trustpilot_url text,
 add column trustpilot_checked_at timestamptz,
 add column ratings_evidence jsonb not null default '{}';
comment on column public.builders.hbf_rank is 'Source-published ordinal rank only; null when HBF publishes an award without a league position.';
comment on column public.builders.trustpilot_rank is 'Source-published category rank only; never derived from TrustScore. See trustpilot_rank_category.';
