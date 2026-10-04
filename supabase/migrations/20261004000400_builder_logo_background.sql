alter table public.builders add column if not exists logo_background_color text not null default '#ffffff' check (logo_background_color ~ '^#[0-9A-Fa-f]{6}$');
comment on column public.builders.logo_background_color is 'Custom background colour for the builder logo slide, independent of the primary brand colour.';
