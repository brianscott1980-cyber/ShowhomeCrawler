-- Search labels are derived once on import, rather than expanding JSON per request.
create table showhome_web.image_furnishings (
 image_key text not null references showhome_web.images(key) on update cascade on delete cascade,
 builder_slug text not null,
 image_id text not null,
 name text not null,
 primary key(name,builder_slug,image_id)
);
create index web_image_furnishings_image on showhome_web.image_furnishings(builder_slug,image_id,name);
create index web_image_furnishings_key on showhome_web.image_furnishings(image_key);
create function showhome_web.furnishing_names(metadata jsonb) returns setof text
language sql immutable as $$
 select distinct lower(trim(label)) from jsonb_array_elements_text(
 coalesce(metadata->'categorisation'->'objects','[]'::jsonb)||
 coalesce(metadata->'categorisation'->'chairs','[]'::jsonb)||
 coalesce((select jsonb_agg(f->>'object') from jsonb_array_elements(coalesce(metadata->'categorisation'->'furnishings','[]'::jsonb)) f),'[]'::jsonb)||
 jsonb_build_array(case when metadata->'categorisation'->>'hasTelevision'='true' then 'Television' end,
 case when metadata->'categorisation'->>'hasComputer'='true' then 'Computer' end)) label
 where nullif(trim(label),'') is not null
$$;
insert into showhome_web.image_furnishings
select i.key,i.builder_slug,i.catalogue_id,n from showhome_web.images i cross join lateral showhome_web.furnishing_names(i.metadata) n;
create function showhome_web.sync_image_furnishings() returns trigger language plpgsql as $$
begin
 if TG_OP='UPDATE' then delete from showhome_web.image_furnishings where image_key=NEW.key;end if;
 insert into showhome_web.image_furnishings select NEW.key,NEW.builder_slug,NEW.catalogue_id,n from showhome_web.furnishing_names(NEW.metadata) n;
 return NEW;
end $$;
create trigger image_furnishings_sync after insert or update of metadata,builder_slug,catalogue_id,key on showhome_web.images
for each row execute function showhome_web.sync_image_furnishings();
revoke all on showhome_web.image_furnishings from anon,authenticated;
revoke all on function showhome_web.furnishing_names(jsonb),showhome_web.sync_image_furnishings() from public;
analyze showhome_web.image_furnishings;
