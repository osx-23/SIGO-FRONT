import { Injectable } from '@angular/core';
import {
  AgenteProgramacionExcepcion,
  AgenteProgramacionExcepcionRequest,
  TrabajadorResumen
} from '../models/programacion.models';

@Injectable()
export class ProgramacionExcepcionState {
  readonly porAgente =
    new Map<number, AgenteProgramacionExcepcion>();

  modalAbierto = false;
  agente: TrabajadorResumen | null = null;

  permiteA = true;
  permiteB = true;
  permiteC = true;

  motivo = '';
  color = '#FFF3B0';
  guardando = false;
  busqueda = '';
  coloresRecientes: string[] = [];

  private readonly claveColores =
    'sigo_programacion_colores_excepcion_recientes';

  reemplazar(
    excepciones: readonly AgenteProgramacionExcepcion[]
  ): void {
    this.porAgente.clear();

    for (const excepcion of excepciones) {
      if (excepcion.activo) {
        this.porAgente.set(
          excepcion.trabajadorId,
          excepcion
        );
      }
    }
  }

  abrirNueva(): void {
    this.cargarColoresRecientes();
    this.busqueda = '';
    this.agente = null;
    this.permiteA = true;
    this.permiteB = true;
    this.permiteC = true;
    this.motivo = '';
    this.color = '#FFF3B0';
    this.modalAbierto = true;
  }

  abrir(
    agente: TrabajadorResumen
  ): void {
    this.cargarColoresRecientes();

    const actual =
      this.porAgente.get(
        agente.id
      );

    this.agente = agente;
    this.permiteA =
      actual?.permiteA ??
      true;
    this.permiteB =
      actual?.permiteB ??
      true;
    this.permiteC =
      actual?.permiteC ??
      true;
    this.motivo =
      actual?.motivo ??
      '';
    this.color =
      actual?.color ??
      '#FFF3B0';

    this.modalAbierto = true;
  }

  cerrar(): boolean {
    if (this.guardando) {
      return false;
    }

    this.modalAbierto = false;
    this.agente = null;
    return true;
  }

  validar(): string | null {
    if (
      !this.permiteA &&
      !this.permiteB &&
      !this.permiteC
    ) {
      return 'Selecciona al menos un turno recomendado: A, B o C.';
    }

    return null;
  }

  construirRequest(
    plazaId: number
  ): AgenteProgramacionExcepcionRequest | null {
    if (!this.agente) {
      return null;
    }

    return {
      trabajadorId:
        this.agente.id,
      plazaId,
      permiteA:
        this.permiteA,
      permiteB:
        this.permiteB,
      permiteC:
        this.permiteC,
      motivo:
        this.motivo.trim() ||
        null,
      color:
        this.color,
      activo: true
    };
  }

  aplicar(
    excepcion: AgenteProgramacionExcepcion
  ): void {
    this.registrarColorReciente(
      excepcion.color
    );

    this.porAgente.set(
      excepcion.trabajadorId,
      excepcion
    );

    this.modalAbierto = false;
    this.agente = null;
  }

  quitar(
    agenteId: number
  ): void {
    this.porAgente.delete(
      agenteId
    );
    this.modalAbierto = false;
    this.agente = null;
  }

  excepcion(
    agenteId: number
  ): AgenteProgramacionExcepcion | null {
    return this.porAgente.get(
      agenteId
    ) ?? null;
  }

  tiene(
    agenteId: number
  ): boolean {
    return this.porAgente.has(
      agenteId
    );
  }

  colorDe(
    agenteId: number
  ): string {
    return this.porAgente.get(
      agenteId
    )?.color ?? 'transparent';
  }

  colorSuaveDe(
    agenteId: number
  ): string {
    const color =
      this.porAgente.get(
        agenteId
      )?.color;

    return color
      ? this.hexARgba(
          color,
          0.18
        )
      : 'transparent';
  }

  colorPreviewSuave(): string {
    return this.hexARgba(
      this.color,
      0.18
    );
  }

  filtrarAgentes(
    agentes: readonly TrabajadorResumen[]
  ): TrabajadorResumen[] {
    const query =
      this.busqueda
        .trim()
        .toLowerCase();

    if (!query) {
      return [...agentes];
    }

    return agentes.filter(
      agente =>
        String(agente.codigo)
          .toLowerCase()
          .includes(query) ||
        agente.nombreCompleto
          .toLowerCase()
          .includes(query)
    );
  }

  turnosRecomendados(
    agenteId: number
  ): string {
    const excepcion =
      this.porAgente.get(
        agenteId
      );

    if (!excepcion) {
      return 'A, B y C';
    }

    return [
      excepcion.permiteA ? 'A' : '',
      excepcion.permiteB ? 'B' : '',
      excepcion.permiteC ? 'C' : ''
    ]
      .filter(Boolean)
      .join(', ');
  }

  turnoRecomendado(
    agenteId: number,
    estado: 'A' | 'B' | 'C'
  ): boolean {
    const excepcion =
      this.porAgente.get(
        agenteId
      );

    if (!excepcion) {
      return true;
    }

    if (estado === 'A') {
      return excepcion.permiteA;
    }

    if (estado === 'B') {
      return excepcion.permiteB;
    }

    return excepcion.permiteC;
  }

  seleccionarColor(
    color: string
  ): void {
    this.color = color;
  }

  private cargarColoresRecientes(): void {
    try {
      const guardados =
        JSON.parse(
          localStorage.getItem(
            this.claveColores
          ) ?? '[]'
        );

      this.coloresRecientes =
        Array.isArray(guardados)
          ? guardados
              .filter(
                (color): color is string =>
                  typeof color === 'string' &&
                  /^#[0-9a-fA-F]{6}$/.test(
                    color
                  )
              )
              .slice(0, 8)
          : [];
    } catch {
      this.coloresRecientes = [];
    }
  }

  private registrarColorReciente(
    color: string
  ): void {
    if (
      !/^#[0-9a-fA-F]{6}$/.test(
        color
      )
    ) {
      return;
    }

    const normalizado =
      color.toUpperCase();

    const nuevos = [
      normalizado,
      ...this.coloresRecientes.filter(
        actual =>
          actual.toUpperCase() !==
          normalizado
      )
    ].slice(0, 8);

    this.coloresRecientes =
      nuevos;

    try {
      localStorage.setItem(
        this.claveColores,
        JSON.stringify(nuevos)
      );
    } catch {
      // La excepción sigue funcionando aunque localStorage esté bloqueado.
    }
  }

  private hexARgba(
    hex: string,
    alpha: number
  ): string {
    const limpio =
      hex.replace('#', '');

    if (
      !/^[0-9a-fA-F]{6}$/.test(
        limpio
      )
    ) {
      return 'transparent';
    }

    const r =
      parseInt(
        limpio.slice(0, 2),
        16
      );

    const g =
      parseInt(
        limpio.slice(2, 4),
        16
      );

    const b =
      parseInt(
        limpio.slice(4, 6),
        16
      );

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}
