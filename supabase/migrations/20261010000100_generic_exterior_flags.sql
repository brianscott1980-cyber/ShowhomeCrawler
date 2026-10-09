-- Precompute the majority-sharing policy when published data changes.
alter table showhome_web.images add column is_generic_exterior boolean not null default false;
create index web_images_generic_exterior on showhome_web.images(builder_slug,path) where is_generic_exterior;
create function showhome_web.refresh_generic_exteriors() returns void language sql as $$
 with totals as (
  select builder_slug,count(distinct building_key) as types from showhome_web.galleries group by builder_slug
 ),generic as (
  select i.builder_slug,i.path from showhome_web.images i
  join showhome_web.gallery_images gi on gi.image_key=i.key
  join showhome_web.galleries g on g.key=gi.gallery_key
  join totals t on t.builder_slug=i.builder_slug
  where lower(i.main_category) in ('exterior','front elevation','facade')
  group by i.builder_slug,i.path,t.types
  having count(distinct g.building_key)>t.types/2.0 and t.types>1
 ),flags as (
  select i.key,exists(select 1 from generic g where g.builder_slug=i.builder_slug and g.path=i.path) as generic
  from showhome_web.images i
 )
 update showhome_web.images i set is_generic_exterior=f.generic from flags f
 where i.key=f.key and i.is_generic_exterior is distinct from f.generic
$$;
create function showhome_web.refresh_generic_exteriors_on_publication() returns trigger language plpgsql as $$
begin
 perform showhome_web.refresh_generic_exteriors();
 return NEW;
end $$;
create trigger publication_generic_exteriors before update of revision on showhome_web.publication_revision
for each row when (OLD.revision is distinct from NEW.revision)
execute function showhome_web.refresh_generic_exteriors_on_publication();
revoke all on function showhome_web.refresh_generic_exteriors(),showhome_web.refresh_generic_exteriors_on_publication() from public;
select showhome_web.refresh_generic_exteriors();
analyze showhome_web.images;
