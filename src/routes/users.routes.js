import { Router } from 'express';
import { verificarToken } from "../middleware/authMiddleware.js";
import {
  verPais,
  estadosPais,
  verParroquias,
  verMunicipios,
  verNacionalidades,
  registrarEstudiante,
  createUser,
  validarUsuario,
  buscarEstudiante,
  constancia,
  obtenerCedulasUsuarios,
  registrarDocente,
  obtenerMateriasDelDocente,
  registrarMateria,
  obtenerMateriasRegistradas,
  actualizarMateria,
  eliminarMateria,
  obtenerDocentesYMaterias,
  asignarMateriasADocente,
  obtenerMaterias,
  obtenerSecciones,
  obtenerAnios,
  asignarMateriaAño,
  EstudiantesInscripcion,
  inscribirEstudiante,
  obtenerAniosEscolares,
  
  
  obtenerMateriasDisponibles,
  inscribirMateriaCuerpo,
  obtenerInscripcionesActivas,
  obtenerEstadisticasDashboard,
  listarMateriasInscritas,
  eliminarMateriaInscrita,
  obtenerMateriasReprobadas,
  listarMateriasInscritasAgrupadas,
  listarInscripciones,
  eliminarInscripcion,
  editarInscripcion,

  guardarNotaEvaluacion,
  obtenerEvaluacionesMateriaInscrita,
  eliminarEvaluacion,
  editarEvaluacion,
  imprimirRegistroCalificaciones,
  listarTiposDocumento,
  constanciaTrabajoDocente,
  buscarDocente,
  solicitarRecuperacion,
  restablecerContrasena,
  listarMateriasYEstudiantesDocente,
  registrarDirector,
  listarUsuarios,
  editarUsuario,
  crearAnioEscolar,
  eliminarUsuario,
  imprimirComprobanteInscripcion,
  listarMateriasAnio,
  listarDocentes,
  editarAsignacionDocente,
  eliminarAsignacionDocente,
  listarAsignacionesDocente,
  listarEstudiantes,
  eliminarEstudiante,
  editarEstudiante,
  imprimirListadoNotasSeccion,
  obtenerAniosEscolaresFiltrado,
  obtenerSeccionesPorAnio,
  adminNotasAniosEscolares,
  adminNotasAnios,
  adminNotasSecciones,
  adminNotasMaterias,
  adminNotasEstudiantesMateria,
  adminNotasEditar,
  listarAniosEscolaresAdmin,
  editarAnioEscolarAdmin,
  eliminarAnioEscolarAdmin,
  asignarDirectorAnioEscolar,
  listarDirectores,
  listarDirectoresconaño,
  editarDirector,
  eliminarDirector,
  exportarListadoNotasSeccionExcel,
  getCortes,
  crearCorte,
  listarCortes,
  editarCorte,
  eliminarCorte,
  generarBoletinEstudiante,
  obtenerEstudiantesDelDocente,
  listarAniosYSecciones,
  listarEstudiantesPorSeccion,
  generarBoletinEstudianteExcel,
  listarAniosMateria,
  editarAniosMateria,
  eliminarAniosMateria,
  listarSecciones,
  registrarSeccion,
  editarSeccion,
  eliminarSeccion,


} from '../controllers/users.controllers.js';

const router = Router();

// Obtener países
router.get('/paises', verPais);

// Obtener estados por país (usando query param: ?idPais=1)
router.get('/estadosPais', estadosPais);

// Obtener municipios por estado (por URL param)
router.get('/municipios/:idEstado', verMunicipios);

// Obtener parroquias por municipio
router.get('/parroquias/:idMunicipio', verParroquias);

// Obtener nacionalidades
router.get('/nacionalidades', verNacionalidades);

// Registrar estudiante
router.post('/registrar', registrarEstudiante);

router.post('/users',createUser);

router.get('/tipos-documento', listarTiposDocumento);

router.post('/login',validarUsuario);

router.get("/estudiante/:cedula", buscarEstudiante);

///////////////////
router.get('/docente/materias-estudiantes', verificarToken, listarMateriasYEstudiantesDocente);
////////////////////////*


router.get("/constancia/:cedula",constancia);

router.get('/docente/:cedula', buscarDocente);

router.get('/constancia-trabajo/:cedula', constanciaTrabajoDocente);

router.get("/usuarios/cedulas", obtenerCedulasUsuarios);

router.post("/docente", registrarDocente);

router.post("/materias", registrarMateria);

router.get("/materiasregistradas", obtenerMateriasRegistradas);

router.put("/materias/:codigo_materia", actualizarMateria);

router.delete("/materias/:codigo_materia", eliminarMateria);

router.get("/asignar-materias", obtenerDocentesYMaterias);

router.post("/asignar-docente", verificarToken, asignarMateriasADocente);

router.get("/materias", obtenerMaterias);

router.post("/asignar-seccion", asignarMateriaAño);

router.get('/anios', obtenerAnios);

router.get("/secciones", obtenerSecciones);

router.get("/recibir", verificarToken, obtenerMateriasDelDocente);

router.get("/estudiantes", EstudiantesInscripcion);

router.post("/inscribir-estudiante", inscribirEstudiante);

router.get("/aniosescolares", obtenerAniosEscolares);

router.get("/inscripcion/:id_inscripcion/materias", obtenerMateriasDisponibles);


router.post("/inscribirmateria", inscribirMateriaCuerpo);

router.get("/inscripciones", obtenerInscripcionesActivas);

router.get('/dashboardd', obtenerEstadisticasDashboard);

// Listar materias inscritas con filtro (solo admin)
router.get('/materias-inscritas', verificarToken, listarMateriasInscritas);
// Eliminar materia inscrita (solo admin)
router.delete('/materias-inscritas/:id_materia_inscrita', verificarToken, eliminarMateriaInscrita);

router.get('/materias-reprobadas/:cedula_estudiante', obtenerMateriasReprobadas);

router.get('/estudiantes-materias-inscritas', listarMateriasInscritasAgrupadas);

// Solo admin
router.get('/inscripciones-todas', verificarToken, listarInscripciones);

router.delete('/inscripciones/:id_inscripcion', verificarToken, eliminarInscripcion);

router.put('/inscripciones/:id_inscripcion', verificarToken, editarInscripcion);



router.post('/docente/guardar-nota', verificarToken, guardarNotaEvaluacion);

router.get('/evaluaciones/:id_materia_inscrita', verificarToken, obtenerEvaluacionesMateriaInscrita);

router.delete('/evaluaciones/:id_materia_inscrita/:fk_momento', verificarToken, eliminarEvaluacion);


router.put('/evaluaciones/:id_materia_inscrita/:fk_momento', verificarToken, editarEvaluacion);

router.get('/docente/registro-calificaciones/:id_asignacion', imprimirRegistroCalificaciones);




//

router.post('/solicitar-recuperacion', solicitarRecuperacion);

router.post('/restablecer/:token', restablecerContrasena);

/////////////// NUEVAS RUTAS XAVIER PELDON

router.post('/registrar-director', registrarDirector);

router.post("/asignar-director-anio-escolar", asignarDirectorAnioEscolar);

router.get("/directores", listarDirectores);

router.get("/directoresconanio", listarDirectoresconaño);
router.put("/directoreseditar/:id", editarDirector);
router.delete("/directoreseliminar/:id", eliminarDirector);

router.get('/usuarios', listarUsuarios);

router.put('/usuarios/:cedula', editarUsuario);

router.post('/anios-escolares', crearAnioEscolar);

router.delete('/usuarios/:cedula', eliminarUsuario);




router.get('/comprobante-inscripcion/:id_inscripcion', imprimirComprobanteInscripcion);

router.get('/asignaciones-docente', listarAsignacionesDocente);

router.delete('/asignaciones-docente/:id_asignacion', eliminarAsignacionDocente);

router.put('/asignaciones-docente/:id_asignacion', editarAsignacionDocente);

router.get('/docentes', listarDocentes);

router.get('/materias-anio', listarMateriasAnio);

router.get('/estudiante', listarEstudiantes);

router.delete('/estudiante/:cedula', eliminarEstudiante);

router.put('/estudiante/:cedula', editarEstudiante);

router.get('/notas-seccion/pdf', imprimirListadoNotasSeccion);

//excel
router.get('/exportar-listado-notas-excel', exportarListadoNotasSeccionExcel);

router.get('/anios-escolares-filtrado', obtenerAniosEscolaresFiltrado);
router.get('/secciones-por-anio', obtenerSeccionesPorAnio);

///////////////////////////////

router.get('/boletin/:cedula', generarBoletinEstudiante);
// ...otras rutas...
router.get('/boletin-excel/:cedula', generarBoletinEstudianteExcel);


router.get('/admin-notas-anios-escolares', adminNotasAniosEscolares);
router.get('/admin-notas-anios', adminNotasAnios);
router.get('/admin-notas-secciones', adminNotasSecciones);
router.get('/admin-notas-materias', adminNotasMaterias);
router.get('/admin-notas-estudiantes-materia', adminNotasEstudiantesMateria);
router.post('/admin-notas-editar', adminNotasEditar);


////////////////

router.get('/admin-anios-escolares', listarAniosEscolaresAdmin);
router.put('/admin-anios-escolares/:id_año_escolar', editarAnioEscolarAdmin);
router.delete('/admin-anios-escolares/:id_año_escolar', eliminarAnioEscolarAdmin);

//////cortes///
router.get('/cortes', getCortes);
router.get("/listarcortes", listarCortes);
router.post("/crearcortes", crearCorte);
router.put("/editarcortes/:id", editarCorte);
router.delete("/eliminarcortes/:id", eliminarCorte);


router.get('/anios-secciones', listarAniosYSecciones);
router.get('/estudiantes-por-seccion', listarEstudiantesPorSeccion);


router.get('/asignaciones-anio-materia', listarAniosMateria);
router.post('/asignaciones-anio-materia', asignarMateriaAño);
router.put('/asignaciones-anio-materia/:id_año_materia', editarAniosMateria);
router.delete('/asignaciones-anio-materia/:id_año_materia', eliminarAniosMateria);

// CRUD de secciones
router.get('/crud-secciones', listarSecciones);
router.post('/crud-secciones', registrarSeccion);
router.put('/crud-secciones/:id_seccion', editarSeccion);
router.delete('/crud-secciones/:id_seccion', eliminarSeccion);



export default router;
