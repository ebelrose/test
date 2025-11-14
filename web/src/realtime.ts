export async function connectRealtime(
  model: string,
  onRemoteTrack: (stream: MediaStream) => void,
  extraTracks: MediaStreamTrack[] = []
) {
  const pc = new RTCPeerConnection();

  // Pistes audio que l'IA doit entendre (onglet Ringover + optionnel micro agent)
  for (const t of extraTracks) pc.addTrack(t);

  // Piste audio TTS renvoyée par l'IA
  pc.ontrack = (ev) => onRemoteTrack(ev.streams[0]);

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const answer = await fetch('/api/realtime/sdp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sdp: offer.sdp, model })
  }).then(r => r.text());

  await pc.setRemoteDescription({ type: 'answer', sdp: answer });
  return pc;
}
