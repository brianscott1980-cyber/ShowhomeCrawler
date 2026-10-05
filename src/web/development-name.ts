import {developers} from '../adapters/developers';

const builderNames=new Set(developers.flatMap(builder=>[
 builder.name.toLowerCase(),
 builder.name.toLowerCase().replace(/\s+homes$/, ''),
 `${builder.name.toLowerCase()} homes`,
]).concat(['barrat','barrat homes']));

/** Remove builder prefixes and comma-separated location qualifiers for display. */
export function developmentName(name:string):string {
 const shortName=name.split(',')[0]?.trim() || name.trim();
 const prefix=shortName.match(/^(.+?)\s*(?:@|\s+at\s+)\s*(.+)$/i);
 return prefix&&builderNames.has(prefix[1]!.trim().toLowerCase())
  ? prefix[2]!.trim()
  : shortName;
}
