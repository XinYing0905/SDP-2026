import {createHash} from 'node:crypto';
export const POLICY=Object.freeze({version:'cp9-policy-1',featureVersion:'cp9-predecision-1',minimumEpisodes:3,minimumAmenities:3,language:'en',direction:'strict-majority-all-qualifying',protection:'any-substantiated-breach-prevents-support',comparison:'exact-known-fields-v1'});
export const hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
export const copy=x=>structuredClone(x);
export function check(ok,msg){if(!ok)throw Error(msg);}
export const CLASS={evaluable:'Comparable, evaluable history',limited:'Limited historical case',rejected:'Rejected from corpus'};
export const TENSION='Historical evidence is more supportive for this alternative. CP7 still identifies another adequately supported option as the preferred lower-impact pathway.';
export const before=(a,b)=>typeof a==='string'&&Number.isFinite(Date.parse(a))&&Number.isFinite(Date.parse(b))&&Date.parse(a)<=Date.parse(b);
export function cleanText(s){check(typeof s==='string'&&s.length>0&&s.length<12000,'INVALID_APPROVED_TEXT');check(!/[\w.+-]+@[\w.-]+\.[a-z]{2,}|\b(?:residentName|nationalID|phoneNumber|emailAddress)\b/i.test(s),'PERSONAL_DATA_FORBIDDEN');return s.normalize('NFKC').replace(/\s+/g,' ').trim();}
