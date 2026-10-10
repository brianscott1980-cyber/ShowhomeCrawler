# Furnishing category mappings

Original `images.metadata` and `image_furnishings` are retained. Public directories, furnishing facets, furnishing filtering and scoped furnishing colour facets use `furnishing_category_mappings` through `image_furnishing_categories`. The view deduplicates each image/category combination.

The first mapping pass reduced 1,522 labels to 928 categories. The refined taxonomy proposes 217 categories from the same snapshot, mapping 1033 source labels and excluding 489. The complete grouping and exclusions are reviewable in `docs/furnishing-grouping-review.md`. Do not remove categories based solely on image frequency.

The reviewable snapshot is `docs/data/furnishing-category-mappings.json`. Migration 003 seeds the initial pass; migration 004 applies the refined snapshot. Subsequent changes should use a new migration rather than editing an applied migration. An excluded label has a null category and decision `excluded`. Labels first encountered in future imports are inserted with decision `pending` and no category: they remain in original classifications but are not public categories until reviewed.

Review queue:

```sql
select m.source_name,count(distinct f.image_key) as images
from showhome_web.furnishing_category_mappings m
join showhome_web.image_furnishings f on f.name=m.source_name
where m.decision='pending'
group by m.source_name order by images desc,m.source_name;
```

To assign or change a mapping, update `category_name` and `decision` together. The category view immediately reflects it. In the same transaction, clear `showhome_web.query_cache` and `showhome_web.gallery_publication_summaries`; the next publication rebuilds summaries. Bulk mapping changes should invalidate these tables once at the end of the batch, rather than per label or per imported image.

Apply `20261010000300_furnishing_category_mappings.sql` and `20261010000400_refine_furnishing_groups.sql` before deploying the website code. It creates the mapping layer and clears old raw-label caches/summaries. Existing category URLs resolve to their mapped category where available. Excluded categories no longer have a directory item. Deployment cache warming remains disabled.
