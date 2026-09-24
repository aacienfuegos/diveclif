export const CARTA = { ancho: 800, alto: 676, latN: 37.72, latS: 37.6, lonW: -0.78, lonE: -0.6 } as const;

export function proyectar(lat: number, lon: number): { x: number; y: number } {
  const x = ((lon - CARTA.lonW) / (CARTA.lonE - CARTA.lonW)) * CARTA.ancho;
  const y = ((CARTA.latN - lat) / (CARTA.latN - CARTA.latS)) * CARTA.alto;
  return { x: Math.round(x), y: Math.round(y) };
}

function gradosMinutos(valor: number): string {
  const abs = Math.abs(valor);
  const grados = Math.floor(abs);
  const minutos = ((abs - grados) * 60).toFixed(1).padStart(4, '0');
  return `${grados}°${minutos}′`;
}

export function formatearCoordenadas(lat: number, lon: number): string {
  return `${gradosMinutos(lat)}${lat >= 0 ? 'N' : 'S'} · ${gradosMinutos(lon)}${lon >= 0 ? 'E' : 'W'}`;
}
