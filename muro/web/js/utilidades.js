let temporizador = 0;

/** Aviso breve y accesible (role=status). */
export function avisar(texto) {
  const el = document.getElementById('aviso');
  el.textContent = texto;
  el.classList.add('visible');
  clearTimeout(temporizador);
  temporizador = setTimeout(() => el.classList.remove('visible'), 2600);
}

/** Descarga un evento .ics para que el visitante se recuerde un lanzamiento en su calendario. */
export function descargarRecordatorio({ id, nombre, fecha }) {
  const d = fecha.replaceAll('-', '');
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Muro//Lanzamientos//ES', 'BEGIN:VEVENT',
    `UID:${id}@muro`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    `DTSTART;VALUE=DATE:${d}`, `SUMMARY:Muro: ${nombre}`,
    `DESCRIPTION:Nueva colección disponible en Muro.`, 'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  a.download = `muro-${id}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Días, horas y minutos que faltan hasta una fecha AAAA-MM-DD. */
export function cuentaAtras(fechaIso, desde = new Date()) {
  const ms = Math.max(0, new Date(fechaIso + 'T00:00:00') - desde);
  return { d: Math.floor(ms / 864e5), h: Math.floor(ms / 36e5) % 24, m: Math.floor(ms / 6e4) % 60 };
}
