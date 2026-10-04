alter table public.builders add column if not exists hbf_composite_score numeric(3,2) check (hbf_composite_score between 1 and 5);
comment on column public.builders.hbf_composite_score is 'Published HBF annual composite satisfaction score, distinct from the official star award. The UI rounds this to the nearest 0.5.';
