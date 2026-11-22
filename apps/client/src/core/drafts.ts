import { openDB } from 'idb';
import type { ProjetoDTO } from '../../../../packages/shared/src/index.js';
export interface Draft { key:string; userId:string; projectId:string; baseVersion:number; project:ProjetoDTO; savedAt:number; tabId?:string }
function tabId(){let id=sessionStorage.getItem('trama-tab-id');if(!id){id=crypto.randomUUID();sessionStorage.setItem('trama-tab-id',id);}return id;}
const db=()=>openDB('trama-rascunhos',1,{upgrade(db){db.createObjectStore('rascunhos',{keyPath:'key'});}});
export const draftKey=(user:string,project:string)=>`${user}:${project}:${tabId()}`;
export async function guardar(draft:Draft){await (await db()).put('rascunhos',{...draft,key:`${draftKey(draft.userId,draft.projectId)}:${draft.baseVersion}`,tabId:tabId()});}
export async function recuperar(user:string,project:string):Promise<Draft|undefined>{const all:Draft[]=await (await db()).getAll('rascunhos');const candidates=all.filter(d=>d.userId===user&&d.projectId===project).sort((a,b)=>b.savedAt-a.savedAt);return candidates.find(d=>d.tabId===tabId())??candidates[0];}
/** Uma aba nunca apaga o rascunho em edição de outra aba. */
export async function apagar(user:string,project:string){const database=await db(),items:Draft[]=await database.getAll('rascunhos');const tx=database.transaction('rascunhos','readwrite');for(const d of items)if(d.userId===user&&d.projectId===project&&d.tabId===tabId())await tx.store.delete(d.key);await tx.done;}
export async function descartar(draft:Draft){await (await db()).delete('rascunhos',draft.key);}
export async function limparUsuario(user:string){const database=await db(),items:Draft[]=await database.getAll('rascunhos');const tx=database.transaction('rascunhos','readwrite');for(const d of items)if(d.userId===user)await tx.store.delete(d.key);await tx.done;}
