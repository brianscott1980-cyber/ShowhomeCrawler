alter table showhome_web.gallery_cards add column building_names text[] not null default '{}';
update showhome_web.gallery_cards set building_names=coalesce((select array_agg(distinct lower(h->>'buildingName')) from jsonb_array_elements(payload->'homes') h),'{}'::text[]);
create index web_gallery_cards_buildings on showhome_web.gallery_cards using gin(building_names);
