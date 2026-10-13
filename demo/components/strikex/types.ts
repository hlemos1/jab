import type { SessionInput } from '@/lib/effort';

export type Lang = 'en'|'pt';
export type View = 'arena'|'activity'|'rewards'|'system'|'account'|'classes'|'coach'|'units'|'unit-classes';
export type Session = {id:string;createdAt:string;hash:string;chainStatus:string;signature?:string;chainError?:string;input:SessionInput|null;result:{valid:boolean;errors:string[];score:number;reward:number;rounds:{id:number;station:string;startMs:number;endMs:number}[];metrics:{events:number;consistency:number;accuracy:number;volume:number};rulesVersion:string}};
export type Profile={name:string;avatar:string};
export type ApiResponse=Snapshot & {error?:string;message?:string;session?:Session;duplicate?:boolean;chain?:{status:string;signature?:string;error?:string}};
export type Identity={mode:'guest'|'account';displayName:string|null;signInUrl:string;signOutUrl:string};
export type Snapshot={identity?:Identity;profile:Profile|null;sessions:Session[];balance:number;redemptions:{id:string;benefit:string;createdAt:string}[]};
