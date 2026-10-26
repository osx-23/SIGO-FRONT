# Dashboard: predicción experimental de asistencia

## Ubicación
Ruta `/dashboard`, pestaña **Predicción de asistencia**.

La pestaña aparece cuando `environment.prediccionAsistenciaEnabled` es true.
- `environment.ts`: habilitada en desarrollo.
- `environment.prod.ts`: deshabilitada hasta desplegar SIGO-ML y el backend compatible.

## Configuración local
1. Ejecutar SIGO-ML (FastAPI) en localhost:8000 con su modelo entrenado.
2. Ejecutar SIGO-BACK `develop` en localhost:8080 con:
   `SIGO_ML_ENABLED=true`,
   `SIGO_ML_URL=http://localhost:8000`,
   `SIGO_ML_INTERNAL_TOKEN=<token secreto local>`.
3. En la copia local del front, configurar `environment.apiUrl` como `http://localhost:8080/api`. No guardar este cambio en producción.
4. Ejecutar `npm start` y entrar a Dashboard con un usuario SUPERVISOR o CONTROLADOR.

El JWT sigue gestionado por el interceptor HTTP de Angular y las reglas de Spring Security.

## API
`POST /api/dashboard/asistencia/predecir`

```json
{"plazaId":3,"turnoId":2,"fecha":"2026-11-05","programados":7}
```

Solo se muestra una predicción puntual. La API no dispone todavía de historial de pronósticos,
intervalos calibrados ni un endpoint de pronóstico semanal, por lo que la vista no inventa gráficos de series futuras.

## Advertencias
- El modelo actual es experimental; el MAE baseline de una evaluación inicial fue 0.609.
- La cantidad programada se introduce manualmente; no hay lectura automática de turnos futuros.
- La respuesta `origenDatos=real` indica entrenamiento con exportación CSV, no conexión permanente a Supabase.
- Errores 404/503 se muestran sin afectar la vista Resumen existente.
