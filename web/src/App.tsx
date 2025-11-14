import React, { useEffect, useRef, useState } from 'react';
import { connectRealtime } from './realtime';

export default function App() {
  const [status, setStatus] = useState<'idle'|'ready'|'connected'>('idle');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [outId, setOutId] = useState<string>('');
  const [model, setModel] = useState<string>('gpt-4o-realtime-preview'); // ajuste selon ton accès
  const [tabCaptured, setTabCaptured] = useState<boolean>(false);
  const ttsRef = useRef<HTMLAudioElement>(null);
  const pcRef = useRef<RTCPeerConnection|null>(null);

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(setDevices);
  }, []);

  function pickMultiOutputId() {
    const outs = devices.filter(d => d.kind === 'audiooutput');
    const multi = outs.find(d => /Multi-Output/i.test(d.label)) || outs[0];
    if (multi) {
      setOutId(multi.deviceId);
      return multi.deviceId;
    }
    return '';
  }

  async function start() {
    setStatus('ready');
    const sinkId = pickMultiOutputId();

    // 1) Capture de l'audio de l'onglet où Ringover sonne/parle
    const tabStream = await (navigator.mediaDevices as any).getDisplayMedia({ audio: true, video: false });
    setTabCaptured(true);
    const tracks: MediaStreamTrack[] = tabStream.getAudioTracks();

    // 2) Connexion WebRTC → OpenAI Realtime
    pcRef.current = await connectRealtime(model, async (remoteStream) => {
      const el = ttsRef.current!;
      el.srcObject = remoteStream;
      el.autoplay = true;

      // Route la sortie <audio> vers le Multi-Output (qui inclut BlackHole)
      if ('setSinkId' in el) {
        const targetSinkId = sinkId || outId;
        if (targetSinkId) {
          try { await (el as any).setSinkId(targetSinkId); } catch (e) { console.warn(e); }
        }
      }
    }, tracks);

    setStatus('connected');
  }

  function stop() {
    pcRef.current?.getSenders().forEach(s => s.track?.stop());
    pcRef.current?.close();
    pcRef.current = null;
    setStatus('idle');
    setTabCaptured(false);
  }

  return (
    <div style={{ fontFamily:'Inter, system-ui', margin:'2rem', maxWidth: 760 }}>
      <h2>Ringover ↔ OpenAI Realtime — injection locale (macOS)</h2>
      <p style={{opacity:.8}}>
        Ouvre <b>app.ringover.com</b> dans un onglet (login email/mot de passe).<br/>
        Dans Ringover : <b>Micro = BlackHole</b>. Sur macOS, crée un <b>Multi-Output</b> (BlackHole + casque).
      </p>

      <div style={{display:'flex', gap:12, alignItems:'center', marginBottom:8}}>
        <label>Modèle&nbsp;</label>
        <input value={model} onChange={e=>setModel(e.target.value)} style={{width:260}}/>
        <button onClick={start} disabled={status!=='idle'}>Démarrer</button>
        <button onClick={stop} disabled={status==='idle'}>Stop</button>
      </div>

      <div>Statut : <b>{status}</b> {tabCaptured ? '— onglet capturé' : ''}</div>
      <audio ref={ttsRef} />

      <details style={{marginTop:16}}>
        <summary>Sorties audio détectées</summary>
        <ul>
          {devices.filter(d=>d.kind==='audiooutput').map(d =>
            <li key={d.deviceId}>{d.label || 'AudioOutput'} — {d.deviceId}</li>
          )}
        </ul>
      </details>

      <p style={{marginTop:16, fontSize:14, opacity:.8}}>
        Astuce : si le Multi-Output n'apparaît pas par son nom, sélectionne un autre device de sortie, 
        macOS routant quand même vers ton réglage système actuel.
      </p>
    </div>
  );
}
