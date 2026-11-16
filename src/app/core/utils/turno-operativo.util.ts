/** Selección sugerida según el horario de la operación en Lima; nunca bloquea la edición. */
export function turnoActualPorHora<T extends { id: number; codigo: string; nombre?: string | null }>(
  turnos: readonly T[],
  ahora: Date = new Date()
): T | null {
  const hora = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Lima',
      hour: '2-digit',
      hourCycle: 'h23'
    }).format(ahora)
  );

  // A: 06:00–13:59, B: 14:00–21:59, C: 22:00–05:59.
  const codigo = hora >= 6 && hora < 14 ? 'A' : hora >= 14 && hora < 22 ? 'B' : 'C';
  return turnos.find(turno => {
    const turnoCodigo = String(turno.codigo ?? '').trim().toUpperCase();
    const turnoNombre = String(turno.nombre ?? '').trim().toUpperCase();
    return turnoCodigo === codigo || turnoCodigo === `TURNO ${codigo}` ||
      turnoNombre === codigo || turnoNombre === `TURNO ${codigo}`;
  }) ?? null;
}
