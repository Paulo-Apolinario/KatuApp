import {hasLocalWrites} from '../offline/saveGuard';
import {prepareBrowserData} from '../offline/prepareBrowserData';
import {useEffect,useRef,useState} from 'react';
import {Pressable,Text,View} from 'react-native';
import {router} from 'expo-router';
import {useAuth} from '../contexts/AuthContext';
import {useSyncStatus} from '../hooks/useSyncStatus';
/** Preparation and refresh run silently. Only connectivity problems and failed sends are visible. */
export default function BrowserOfflineStatus(){
 const {user}=useAuth(),sync=useSyncStatus(),[online,setOnline]=useState(true),prepared=useRef('');
 useEffect(()=>{let alive=true;const update=()=>setOnline(navigator.onLine);update();window.addEventListener('online',update);window.addEventListener('offline',update);const guard=(e:BeforeUnloadEvent)=>{if(hasLocalWrites()){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',guard);
 let registration:ServiceWorkerRegistration|undefined;
 const activate=()=>{if(registration?.waiting&&!hasLocalWrites())registration.waiting.postMessage({type:'ACTIVATE_UPDATE'});};
 if('serviceWorker'in navigator)void navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).then(r=>{if(!alive)return;registration=r;activate();r.addEventListener('updatefound',()=>r.installing?.addEventListener('statechange',activate));}).catch(()=>{/* retry on next online event / next opening; no preparation banner */});
 const retry=()=>{registration?.update().catch(()=>{});};window.addEventListener('online',retry);
 return()=>{alive=false;window.removeEventListener('online',update);window.removeEventListener('offline',update);window.removeEventListener('online',retry);window.removeEventListener('beforeunload',guard);};},[]);
 useEffect(()=>{if(!user||!online)return;const key=user.id+':'+Math.floor(Date.now()/300000);if(prepared.current===key)return;prepared.current=key;if(navigator.storage?.persist)void navigator.storage.persist().catch(()=>false);void prepareBrowserData(user.role).catch(()=>{prepared.current='';});},[user?.id,online]);
 if(online&&!sync.errors)return null;
 return <View style={{backgroundColor:'#FFF3D6',paddingHorizontal:16,paddingVertical:8,gap:4}}><Text accessibilityLiveRegion="polite" style={{color:'#725000',fontSize:13}}>{!online?'Você está sem internet. Os registros ficam salvos neste aparelho e serão enviados quando a conexão voltar.':'Alguns registros aguardam nova tentativa ou revisão. Os dados permanecem salvos neste aparelho.'}</Text>{sync.pending>0&&<Pressable accessibilityRole="button" accessibilityLabel="Consultar envios pendentes" onPress={()=>router.push('/sync')}><Text style={{color:'#087B55',fontSize:13,paddingVertical:6}}>{sync.pending} registro(s) aguardando confirmação · Consultar</Text></Pressable>}</View>;
}
