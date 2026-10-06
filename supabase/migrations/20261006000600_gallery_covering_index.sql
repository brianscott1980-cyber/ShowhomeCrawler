create index web_gallery_cards_category_cover on showhome_web.gallery_cards(category,uid) include(builder_slug,image_id,builder_name,room) where eligible;
analyze showhome_web.gallery_cards;
