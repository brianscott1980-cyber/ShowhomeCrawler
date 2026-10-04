alter table public.builders rename column hbf_rank to site_rank;
comment on column public.builders.site_rank is 'Showhome rank: HBF stars descending, combined review count descending, review-count-weighted average descending. Equal metrics share a rank.';
create table public.builder_review_sources (
 id uuid primary key default gen_random_uuid(),
 builder_id uuid not null references public.builders(id) on delete cascade,
 provider text not null check (provider in ('trustpilot','google')),
 profile_key text not null,
 profile_name text,
 rating numeric(2,1) check (rating between 0 and 5),
 average_rating numeric(4,3) check (average_rating between 0 and 5),
 review_count integer check (review_count >= 0),
 source_url text,
 scope text not null default 'builder',
 status text not null check (status in ('verified','unverified','unavailable')),
 checked_at timestamptz not null,
 evidence jsonb not null default '{}',
 unique(builder_id,provider,profile_key),
 check (status <> 'verified' or (average_rating is not null and review_count > 0 and source_url is not null))
);
alter table public.builder_review_sources enable row level security;
create view public.builder_review_summary with (security_invoker=true) as
 select builder_id, sum(review_count)::bigint as review_count,
 sum(average_rating * review_count) / nullif(sum(review_count),0) as average_rating
 from public.builder_review_sources where status='verified'
 group by builder_id;
create function public.refresh_builder_site_ranks() returns void language sql security invoker as $$
 with rankings as (
 select b.id,dense_rank() over (order by coalesce(b.hbf_rating,-1) desc,coalesce(s.review_count,0) desc,s.average_rating desc nulls last)::integer as position
 from public.builders b left join public.builder_review_summary s on s.builder_id=b.id
 ) update public.builders b set site_rank=r.position from rankings r where r.id=b.id;
$$;
