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
router.get('/paises' , verPais);

// Obtener estados por país (usando query param: ?idPais=1)
router.get('/estadosPais' , estadosPais);

// Obtener municipios por estado (por URL param)
router.get('/municipios/:idEstado' , verMunicipios);

// Obtener parroquias por municipio
router.get('/parroquias/:idMunicipio' , verParroquias);

// Obtener nacionalidades
router.get('/nacionalidades' , verNacionalidades);

// Registrar estudiante
router.post('/registrar', verificarToken , registrarEstudiante);

router.post('/users' ,createUser);

router.get('/tipos-documento' , listarTiposDocumento);

router.post('/login' ,validarUsuario);

router.get("/estudiante/:cedula", verificarToken , buscarEstudiante);

///////////////////
router.get('/docente/materias-estudiantes', verificarToken , listarMateriasYEstudiantesDocente);
////////////////////////*


router.get("/constancia/:cedula", verificarToken ,constancia);

router.get('/docente/:cedula', verificarToken , buscarDocente);

router.get('/constancia-trabajo/:cedula', verificarToken , constanciaTrabajoDocente);

router.get("/usuarios/cedulas", verificarToken , obtenerCedulasUsuarios);

router.post("/docente", verificarToken , registrarDocente);

router.post("/materias", verificarToken , registrarMateria);

router.get("/materiasregistradas", verificarToken , obtenerMateriasRegistradas);

router.put("/materias/:codigo_materia", verificarToken , actualizarMateria);

router.delete("/materias/:codigo_materia", verificarToken , eliminarMateria);

router.get("/asignar-materias", verificarToken , obtenerDocentesYMaterias);

router.post("/asignar-docente", verificarToken , verificarToken, asignarMateriasADocente);

router.get("/materias", verificarToken , obtenerMaterias);

router.post("/asignar-seccion", verificarToken , asignarMateriaAño);

router.get('/anios', verificarToken , obtenerAnios);

router.get("/secciones", verificarToken , obtenerSecciones);

router.get("/recibir", verificarToken , verificarToken, obtenerMateriasDelDocente);

router.get("/estudiantes", verificarToken , EstudiantesInscripcion);

router.post("/inscribir-estudiante", verificarToken , inscribirEstudiante);

router.get("/aniosescolares", verificarToken , obtenerAniosEscolares);

router.get("/inscripcion/:id_inscripcion/materias", verificarToken , obtenerMateriasDisponibles);


router.post("/inscribirmateria", verificarToken , inscribirMateriaCuerpo);

router.get("/inscripciones", verificarToken , obtenerInscripcionesActivas);

router.get('/dashboardd', verificarToken , obtenerEstadisticasDashboard);

// Listar materias inscritas con filtro (solo admin)
router.get('/materias-inscritas', verificarToken , listarMateriasInscritas);
// Eliminar materia inscrita (solo admin)
router.delete('/materias-inscritas/:id_materia_inscrita', verificarToken , eliminarMateriaInscrita);

router.get('/materias-reprobadas/:cedula_estudiante', verificarToken , obtenerMateriasReprobadas);

router.get('/estudiantes-materias-inscritas', verificarToken , listarMateriasInscritasAgrupadas);

// Solo admin
router.get('/inscripciones-todas', verificarToken , listarInscripciones);

router.delete('/inscripciones/:id_inscripcion', verificarToken , eliminarInscripcion);

router.put('/inscripciones/:id_inscripcion', verificarToken , editarInscripcion);



router.post('/docente/guardar-nota', verificarToken , guardarNotaEvaluacion);

router.get('/evaluaciones/:id_materia_inscrita', verificarToken , obtenerEvaluacionesMateriaInscrita);

router.delete('/evaluaciones/:id_materia_inscrita/:fk_momento', verificarToken , eliminarEvaluacion);


router.put('/evaluaciones/:id_materia_inscrita/:fk_momento', verificarToken , editarEvaluacion);

router.get('/docente/registro-calificaciones/:id_asignacion', verificarToken , imprimirRegistroCalificaciones);




//

router.post('/solicitar-recuperacion' , solicitarRecuperacion);

router.post('/restablecer/:token' , restablecerContrasena);

/////////////// NUEVAS RUTAS XAVIER PELDON

router.post('/registrar-director', verificarToken , registrarDirector);

router.post("/asignar-director-anio-escolar", verificarToken , asignarDirectorAnioEscolar);

router.get("/directores", verificarToken , listarDirectores);

router.get("/directoresconanio", verificarToken , listarDirectoresconaño);
router.put("/directoreseditar/:id", verificarToken , editarDirector);
router.delete("/directoreseliminar/:id", verificarToken , eliminarDirector);

router.get('/usuarios', verificarToken , listarUsuarios);

router.put('/usuarios/:cedula', verificarToken , editarUsuario);

router.post('/anios-escolares', verificarToken , crearAnioEscolar);

router.delete('/usuarios/:cedula', verificarToken , eliminarUsuario);




router.get('/comprobante-inscripcion/:id_inscripcion', verificarToken , imprimirComprobanteInscripcion);

router.get('/asignaciones-docente', verificarToken , listarAsignacionesDocente);

router.delete('/asignaciones-docente/:id_asignacion', verificarToken , eliminarAsignacionDocente);

router.put('/asignaciones-docente/:id_asignacion', verificarToken , editarAsignacionDocente);

router.get('/docentes', verificarToken , listarDocentes);

router.get('/materias-anio', verificarToken , listarMateriasAnio);

router.get('/estudiante', verificarToken , listarEstudiantes);

router.delete('/estudiante/:cedula', verificarToken , eliminarEstudiante);

router.put('/estudiante/:cedula', verificarToken , editarEstudiante);

router.get('/notas-seccion/pdf', verificarToken , imprimirListadoNotasSeccion);

//excel
router.get('/exportar-listado-notas-excel', verificarToken , exportarListadoNotasSeccionExcel);

router.get('/anios-escolares-filtrado', verificarToken , obtenerAniosEscolaresFiltrado);
router.get('/secciones-por-anio', verificarToken , obtenerSeccionesPorAnio);

///////////////////////////////

router.get('/boletin/:cedula', verificarToken , generarBoletinEstudiante);
// ...otras rutas...
router.get('/boletin-excel/:cedula', verificarToken , generarBoletinEstudianteExcel);


router.get('/admin-notas-anios-escolares', verificarToken , adminNotasAniosEscolares);
router.get('/admin-notas-anios', verificarToken , adminNotasAnios);
router.get('/admin-notas-secciones', verificarToken , adminNotasSecciones);
router.get('/admin-notas-materias', verificarToken , adminNotasMaterias);
router.get('/admin-notas-estudiantes-materia', verificarToken , adminNotasEstudiantesMateria);
router.post('/admin-notas-editar', verificarToken , adminNotasEditar);


////////////////

router.get('/admin-anios-escolares', verificarToken , listarAniosEscolaresAdmin);
router.put('/admin-anios-escolares/:id_año_escolar', verificarToken , editarAnioEscolarAdmin);
router.delete('/admin-anios-escolares/:id_año_escolar', verificarToken , eliminarAnioEscolarAdmin);

//////cortes///
router.get('/cortes', verificarToken , getCortes);
router.get("/listarcortes", verificarToken , listarCortes);
router.post("/crearcortes", verificarToken , crearCorte);
router.put("/editarcortes/:id", verificarToken , editarCorte);
router.delete("/eliminarcortes/:id", verificarToken , eliminarCorte);


router.get('/anios-secciones', verificarToken , listarAniosYSecciones);
router.get('/estudiantes-por-seccion', verificarToken , listarEstudiantesPorSeccion);


router.get('/asignaciones-anio-materia', verificarToken , listarAniosMateria);
router.post('/asignaciones-anio-materia', verificarToken , asignarMateriaAño);
router.put('/asignaciones-anio-materia/:id_año_materia', verificarToken , editarAniosMateria);
router.delete('/asignaciones-anio-materia/:id_año_materia', verificarToken , eliminarAniosMateria);

// CRUD de secciones
router.get('/crud-secciones', verificarToken , listarSecciones);
router.post('/crud-secciones', verificarToken , registrarSeccion);
router.put('/crud-secciones/:id_seccion', verificarToken , editarSeccion);
router.delete('/crud-secciones/:id_seccion', verificarToken , eliminarSeccion);



export default router;
