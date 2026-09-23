import { Injectable } from '@angular/core';
import {
  CoberturaDiaPropuesta,
  ConflictoProgramacionPropuesta,
  DiaEspecialProgramacionRequest,
  GenerarProgramacionRequest,
  NovedadProgramacionRequest,
  ProgramacionPropuestaResponse
} from '../data-access/programacion-api.service';
import {
  EstadoProgramacion,
  TrabajadorResumen
} from '../models/programacion.models';

export interface ProgramacionCeldaPropuesta {
  trabajadorId: number;
  fecha: string;
  estado: EstadoProgramacion;
}

@Injectable()
export class ProgramacionGeneradorState {
  modalAbierto = false;
  procesando = false;

  coberturaNormal = {
    a: 7,
    b: 7,
    c: 3
  };

  coberturaDomingo = {
    a: 6,
    b: 7,
    c: 3
  };

  diasEspeciales:
    DiaEspecialProgramacionRequest[] = [];

  novedades:
    NovedadProgramacionRequest[] = [];

  coberturaPropuesta:
    CoberturaDiaPropuesta[] = [];

  conflictosPropuesta:
    ConflictoProgramacionPropuesta[] = [];

  ultimaPropuesta:
    ProgramacionPropuestaResponse | null = null;

  abrir(): boolean {
    if (this.procesando) {
      return false;
    }

    this.modalAbierto = true;
    return true;
  }

  cerrar(): boolean {
    if (this.procesando) {
      return false;
    }

    this.modalAbierto = false;
    return true;
  }

  limpiarResultado(): void {
    this.ultimaPropuesta = null;
    this.coberturaPropuesta = [];
    this.conflictosPropuesta = [];
  }

  agregarDiaEspecial(
    fechaBase: string
  ): void {
    this.diasEspeciales = [
      ...this.diasEspeciales,
      {
        fecha: fechaBase,
        descripcion: '',
        a: this.coberturaDomingo.a,
        b: this.coberturaDomingo.b,
        c: this.coberturaDomingo.c
      }
    ];
  }

  quitarDiaEspecial(
    index: number
  ): void {
    this.diasEspeciales =
      this.diasEspeciales.filter(
        (_, actual) =>
          actual !== index
      );
  }

  agregarNovedad(
    agente: TrabajadorResumen | undefined,
    fechaBase: string
  ): string | null {
    if (!agente) {
      return 'No hay agentes disponibles para registrar una novedad.';
    }

    this.novedades = [
      ...this.novedades,
      {
        trabajadorId: agente.id,
        desde: fechaBase,
        hasta: fechaBase,
        estado: 'V',
        observacion: ''
      }
    ];

    return null;
  }

  quitarNovedad(
    index: number
  ): void {
    this.novedades =
      this.novedades.filter(
        (_, actual) =>
          actual !== index
      );
  }

  validar(
    anio: number,
    mes: number
  ): string | null {
    const coberturas = [
      this.coberturaNormal,
      this.coberturaDomingo
    ];

    const coberturaInvalida =
      coberturas.some(
        cobertura =>
          [
            cobertura.a,
            cobertura.b,
            cobertura.c
          ].some(
            valor =>
              valor < 0 ||
              !Number.isInteger(valor)
          )
      );

    if (coberturaInvalida) {
      return 'Las coberturas A, B y C deben ser números enteros mayores o iguales a 0.';
    }

    const prefijoMes =
      `${anio}-${String(mes).padStart(2, '0')}-`;

    if (
      this.diasEspeciales.some(
        dia =>
          !dia.fecha?.startsWith(
            prefijoMes
          )
      )
    ) {
      return 'Todos los días especiales deben pertenecer al mes seleccionado.';
    }

    if (
      this.novedades.some(
        novedad =>
          !novedad.trabajadorId ||
          !novedad.desde ||
          !novedad.hasta ||
          novedad.hasta < novedad.desde
      )
    ) {
      return 'Revisa las novedades: agente y rango de fechas son obligatorios.';
    }

    return null;
  }

  construirRequest(
    plazaId: number,
    anio: number,
    mes: number
  ): GenerarProgramacionRequest {
    return {
      plazaId,
      anio,
      mes,
      coberturaNormal: {
        ...this.coberturaNormal
      },
      coberturaDomingo: {
        ...this.coberturaDomingo
      },
      diasEspeciales:
        this.diasEspeciales.map(
          dia => ({
            ...dia,
            descripcion:
              dia.descripcion?.trim() ||
              null
          })
        ),
      novedades:
        this.novedades.map(
          novedad => ({
            ...novedad,
            observacion:
              novedad.observacion?.trim() ||
              null
          })
        )
    };
  }

  aplicarPropuesta(
    propuesta: ProgramacionPropuestaResponse
  ): ProgramacionCeldaPropuesta[] {
    this.ultimaPropuesta = propuesta;
    this.coberturaPropuesta = [
      ...propuesta.cobertura
    ];
    this.conflictosPropuesta = [
      ...propuesta.conflictos
    ];

    return propuesta.agentes.flatMap(
      agente =>
        agente.dias.map(
          dia => ({
            trabajadorId:
              agente.trabajadorId,
            fecha: dia.fecha,
            estado: dia.estado
          })
        )
    );
  }

  diasConDeficit(): number {
    return this.coberturaPropuesta.filter(
      dia =>
        dia.deficitA > 0 ||
        dia.deficitB > 0 ||
        dia.deficitC > 0
    ).length;
  }

  diasConExceso(): number {
    return this.coberturaPropuesta.filter(
      dia =>
        dia.excesoA > 0 ||
        dia.excesoB > 0 ||
        dia.excesoC > 0
    ).length;
  }

  conflictosVisibles(
    limite = 8
  ): ConflictoProgramacionPropuesta[] {
    return this.conflictosPropuesta.slice(
      0,
      limite
    );
  }
}
