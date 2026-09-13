import {parseBackup,emptyCollection,STORAGE_KEY} from './state.js';
export function readCollection(storageFactory,legacyIds={}) {
  let raw;
  try {raw=storageFactory().getItem(STORAGE_KEY);} catch {return {collection:emptyCollection(),blocked:false,failed:true,reason:'unavailable'};}
  if(!raw)return {collection:emptyCollection(),blocked:false,failed:false};
  try{return {collection:parseBackup(raw,legacyIds),blocked:false,failed:false};}
  catch{return {collection:emptyCollection(),blocked:true,failed:true,reason:'invalid'};}
}
export function writeCollection(storageFactory,collection) {
  try{storageFactory().setItem(STORAGE_KEY,JSON.stringify(collection));return true;}
  catch{return false;}
}
