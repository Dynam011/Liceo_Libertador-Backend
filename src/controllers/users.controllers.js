// controllers/users.controllers.js
import { pool } from '../db.js';
import bcrypt from 'bcrypt';
import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import {JWT_SECRET} from "../config.js"
import jwt from "jsonwebtoken";
import nodemailer from 'nodemailer';
import crypto from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Obtener todos los países
export const verPais = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM "Pais"');
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener países:', error);
    res.status(500).json({ error: 'Error al obtener países' });
  }
};

// Obtener estados por país (id por query param)
export const estadosPais = async (req, res) => {
  const { idPais } = req.query;

  try {
    const query = `SELECT e.* FROM "Estado" e JOIN "Pais" p ON e.id_pais = p.id_pais WHERE p.id_pais = $1`;
    const result = await pool.query(query, [idPais]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener estados:', error);
    res.status(500).json({ error: 'Error al obtener estados' });
  }
};

// Obtener municipios por estado
export const verMunicipios = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM "Municipio" WHERE id_estado = $1', [req.params.idEstado]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener municipios:', error);
    res.status(500).json({ error: 'Error al obtener municipios' });
  }
};

// Obtener parroquias por municipio
export const verParroquias = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM "Parroquia" WHERE id_municipio = $1', [req.params.idMunicipio]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener parroquias:', error);
    res.status(500).json({ error: 'Error al obtener parroquias' });
  }
};

// Obtener nacionalidades
export const verNacionalidades = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM "nacionalidad"');
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener nacionalidades:', error);
    res.status(500).json({ error: 'Error al obtener nacionalidades' });
  }
};

// Registrar estudiante (solo campos básicos)
export const registrarEstudiante = async (req, res) => {
  try {
    const {
      fk_documento, // tipo de documento
      cedula,
      nombres,
      apellidos,
      nacionalidad,
      sexo,
      fecha_nacimiento,
      lugar_nacimiento
    } = req.body;

    const query = `
      INSERT INTO "Estudiante" (
        fk_documento, cedula, nombres, apellidos, nacionalidad, sexo, fecha_nacimiento, lugar_nacimiento
      ) VALUES (
        $1, $2, UPPER($3), UPPER($4), $5, $6, $7, UPPER($8)
      )
    `;

    await pool.query(query, [
      fk_documento,
      cedula,
      nombres,
      apellidos,
      nacionalidad,
      sexo,
      fecha_nacimiento,
      lugar_nacimiento
    ]);

    res.status(201).json({ message: 'Estudiante registrado correctamente' });
  } catch (error) {
    console.error('Error al registrar estudiante:', error);
    res.status(500).json({ error: 'Error al registrar estudiante' });
  }
};


// Listar tipos de documento
export const listarTiposDocumento = async (req, res) => {
  try {
    const result = await pool.query('SELECT id_documento, nombre FROM "tipo_documento" ORDER BY id_documento ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener tipos de documento:', error);
    res.status(500).json({ error: 'Error al obtener tipos de documento' });
  }
};





export const createUser = async (req, res) => {
   try {
    const data = req.body;
    const saltRounds = 10;
    const hash = await bcrypt.hash(data.contraseña, saltRounds);

    // Valor por defecto para el rol
    const rol = 'usuario';

        // Validar que venga fk_documento
    if (!data.fk_documento) {
      return res.status(400).json({ message: "Debe seleccionar un tipo de documento" });
    }

    const rows = await pool.query(
      'INSERT INTO "Usuario" (cedula, nombres, apellidos, direccion, telefono, sexo, fecha_nac, usuario, contraseña, email, rol, fk_documento) VALUES ($1, UPPER($2), UPPER($3), UPPER($4), $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *',
      [data.cedula, data.nombres, data.apellidos, data.direccion, data.telefono, data.sexo, data.fecha_nac, data.usuario, hash, data.email, rol, data.fk_documento]
    );
    return res.json(rows[0]);

   } catch (error) {
    console.log(error)
    if (error.code === '23505') {
        return res.status(409).json({ message: "usuario ya existe" });
    }
    return res.status(500).json({message: "error al crear el usuario"});    
   }
};




export const validarUsuario = async (req, res) => {
    try {
        const { usuario, contraseña } = req.body;

        const result = await pool.query('SELECT * FROM "Usuario" WHERE LOWER(usuario) = $1', [usuario.toLowerCase()]);

        if (result.rows.length === 0) {
            return res.status(404).json({ mensaje: "Datos invalidos" });
        }

        const usuarioDB = result.rows[0];

        // Validar la contraseña
        const passwordCorrecta = await bcrypt.compare(contraseña, usuarioDB.contraseña);
        if (!passwordCorrecta) {
            return res.status(401).json({ mensaje: "Datos invalidos" });
        }

         // Si es admin, permite el acceso directo
        if (usuarioDB.rol === "admin" || usuarioDB.rol === "gestor") {
            const token = jwt.sign({ rol: usuarioDB.rol }, JWT_SECRET, { expiresIn: "2h" });
            return res.json({ mensaje: "Inicio de sesión exitoso", usuario: usuarioDB.usuario, rol: usuarioDB.rol, token });
        }

       

        //  Obtener el id_docente correctamente
        const docenteResult = await pool.query('SELECT id_docente FROM "Docente" WHERE fk_cedula = $1', [usuarioDB.cedula]);

        if (docenteResult.rows.length === 0) {
            return res.status(404).json({ mensaje: "Este usuario no está registrado como docente" });
        }

        const id_docente = docenteResult.rows[0].id_docente;
        

        //  Generar JWT con el ID correcto
        const token = jwt.sign({ id_docente, rol: usuarioDB.rol }, JWT_SECRET, { expiresIn: "2h" });

        res.json({ mensaje: "Inicio de sesión exitoso", usuario: usuarioDB.usuario, rol: usuarioDB.rol, token });

    } catch (error) {
        console.error("Error en login:", error);
        res.status(500).json({ mensaje: "Error interno del servidor" });
    }
};


export const buscarEstudiante = async (req, res) => {
  


    try {
        const { cedula } = req.params;
        const resultado = await pool.query('SELECT * FROM "Estudiante" WHERE cedula = $1', [cedula]);

        if (resultado.rows.length === 0) {
            return res.status(404).json({ mensaje: "Estudiante no encontrado" });
        }

        res.json(resultado.rows[0]);
    } catch (error) {
        res.status(500).json({ mensaje: "Error en el servidor" });
    }
};

export const constancia = async (req, res) => {
    try {
        const { cedula } = req.params;

        // Traer estudiante y tipo de documento
        const resultado = await pool.query(`
            SELECT e.nombres, e.apellidos, e.cedula, td.nombre AS tipo_documento
            FROM "Estudiante" e
            LEFT JOIN "tipo_documento" td ON e.fk_documento = td.id_documento
            WHERE e.cedula = $1
        `, [cedula]);

        if (resultado.rows.length === 0) {
            return res.status(404).json({ mensaje: "Estudiante no encontrado" });
        }
        const estudiante = resultado.rows[0];

        // Traer el año escolar más reciente (nombre y id)
        const anioEscolarResult = await pool.query(`
            SELECT id_año_escolar, nombre FROM "año_escolar" ORDER BY id_año_escolar DESC LIMIT 1
        `);
        const anioEscolar = anioEscolarResult.rows[0]?.nombre || "";
        const id_año_escolar = anioEscolarResult.rows[0]?.id_año_escolar;

        // Traer director vigente del año escolar actual con tipo de documento
        let director = {
            nombre: "MARIA DE JESUS",
            apellido: "BONILLA NIÑO",
            titulo: "MsC",
            cedula: "12630931",
            tipo_documento: "V"
        };

        if (id_año_escolar) {
            const directorResult = await pool.query(`
                SELECT d.nombre, d.apellido, d.titulo, d.cedula, td.nombre AS tipo_documento
                FROM directores_anios_escolares dae
                JOIN directores d ON dae.director_id = d.id
                LEFT JOIN tipo_documento td ON d.tipo_documento = td.id_documento
                WHERE dae.id_año_escolar = $1
                  AND (dae.fecha_fin IS NULL OR dae.fecha_fin >= CURRENT_DATE)
                ORDER BY dae.fecha_inicio DESC
                LIMIT 1
            `, [id_año_escolar]);
            if (directorResult.rows.length > 0) {
                director = directorResult.rows[0];
            }
        }

        // Datos fijos
        const nombreLiceo = "Liceo Nacional Libertador";
        const codigoDEA = "OD06002005";
        const codigoAdministrativo = "18 007933480";
        const localidad = "Palo Gordo, Municipio Cárdenas del Estado Táchira";

        // Fecha actual en formato largo
        const meses = [
            "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
            "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
        ];
        const hoy = new Date();
        const fechaTexto = `Palo Gordo, a los ${hoy.getDate()} días del mes de ${meses[hoy.getMonth()]} del ${hoy.getFullYear()}.`;

        // Márgenes: 4cm arriba, 3cm derecha, 3cm abajo, 3cm izquierda (en puntos)
        const doc = new PDFDocument({ 
            margins: { top: 85, right: 85, bottom: 85, left: 85 }
        });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=constancia_${cedula}.pdf`);
        doc.pipe(res);

        // Logo único de cabecera (ocupa todo el ancho)
        const logoFullPath = path.join(__dirname, '../assets/LARGOHD.png'); // Usa tu imagen horizontal
        const logoHeight = 80;
        if (fs.existsSync(logoFullPath)) {
            doc.image(
                logoFullPath,
                doc.page.margins.left,
                doc.page.margins.top - 60,
                {
                    width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
                    height: logoHeight
                }
            );
        }
        let y = doc.page.margins.top + logoHeight - 40;

        // Título centrado
        doc.fontSize(16).font('Helvetica-Bold').text(
            "CONSTANCIA DE ESTUDIO",
            doc.page.margins.left,
            y,
            {
                align: "center",
                width: doc.page.width - doc.page.margins.left - doc.page.margins.right
            }
        );

        y += 40;

        // Texto principal
        doc.fontSize(12).font('Helvetica').text(
            `Quien suscribe, ${director.titulo} ${director.nombre} ${director.apellido}, titular de la Cédula de Identidad N° ${director.tipo_documento}-${director.cedula}, en mi carácter de Director(a) del ${nombreLiceo} identificado con el código DEA ${codigoDEA} y Administrativo ${codigoAdministrativo}, que funciona en la Localidad de ${localidad}, por medio de la presente hace constar que el ciudadano(a):`,
            doc.page.margins.left, y,
            { align: "justify", width: doc.page.width - doc.page.margins.left - doc.page.margins.right }
        );

        y = doc.y + 20;

        // Nombre del estudiante centrado
        doc.fontSize(13).font('Helvetica-Bold').text(
            `${estudiante.nombres} ${estudiante.apellidos}`,
            doc.page.margins.left, y,
            { align: "center", width: doc.page.width - doc.page.margins.left - doc.page.margins.right }
        );

        y = doc.y + 10;

        // Cédula y año escolar (sin sección ni año)
        doc.fontSize(12).font('Helvetica').text(
            `Titular de la Cédula de Identidad Nº ${estudiante.tipo_documento || ''}-${estudiante.cedula}, se encuentra inscrito(a) y cursando el presente año escolar ${anioEscolar}.`,
            doc.page.margins.left, y,
            { align: "justify", width: doc.page.width - doc.page.margins.left - doc.page.margins.right }
        );

        y = doc.y + 30;

        // Motivo y línea para escribirlo manualmente
        doc.fontSize(12).font('Helvetica').text(
            `Constancia que se expide a solicitud de la parte interesada por el siguiente motivo:`,
            doc.page.margins.left, y,
            { align: "justify", width: doc.page.width - doc.page.margins.left - doc.page.margins.right }
        );
        doc.moveDown(1);
        doc.text("__________________________________________________________________", { align: "center" });

        doc.moveDown();
        doc.fontSize(12).font('Helvetica').text(fechaTexto, { align: "right" });

        // Espacio para firma manual
        doc.moveDown(4);
        doc.text("__________________________", { align: "center" });

        // Nombre, cédula y cargo del director
        doc.fontSize(12).font('Helvetica-Bold').text(
            `${director.titulo} ${director.nombre} ${director.apellido}`,
            { align: "center" }
        );
        doc.fontSize(12).font('Helvetica-Bold').text(
            `${director.tipo_documento}-${director.cedula} `,
            { align: "center" }
        );

        doc.fontSize(12).font('Helvetica').text("DIRECTOR(A)", { align: "center" });

        // Pie de página
        const piePath = path.join(__dirname, '../assets/pie.png');
        if (fs.existsSync(piePath)) {
            const pieHeight = 40;
            doc.image(
                piePath,
                doc.page.margins.left,
                doc.page.height - doc.page.margins.bottom - pieHeight + 10,
                {
                    width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
                    height: pieHeight
                }
            );
        }

        doc.end();
    } catch (error) {
        console.error(error);
        if (!res.headersSent) {
            res.status(500).json({ mensaje: "Error al generar PDF" });
        }
    }
};


export const obtenerCedulasUsuarios = async (req, res) => {
    try {
        const resultado = await pool.query(
            `SELECT cedula, nombres, apellidos 
             FROM "Usuario" 
             WHERE rol = $1
             ORDER BY nombres, apellidos`,
            ['usuario']
        );
        res.json(resultado.rows);
    } catch (error) {
        console.error("Error al obtener cédulas:", error.message);
        res.status(500).json({ mensaje: "Error en el servidor" });
    }
};
export const registrarDocente = async (req, res) => {
    try {
        const {
            fk_cedula,
            titulo_academico,
            especialidad,
            tipo_contrato,
            fecha_contratacion,
            estado_laboral,
            telefono,
            correo_institucional,
            horas_semanales,
            codigo // <-- Nuevo campo
        } = req.body;

        // Validar si ya existe un docente con esa cédula
        const existe = await pool.query(
            `SELECT 1 FROM "Docente" WHERE fk_cedula = $1`,
            [fk_cedula]
        );
        if (existe.rows.length > 0) {
            return res.status(409).json({ mensaje: "Ya existe un docente registrado con esa cédula." });
        }

        const resultado = await pool.query(
            `INSERT INTO "Docente" (fk_cedula, titulo_academico, especialidad, tipo_contrato, fecha_contratacion, estado_laboral, telefono, correo_institucional, horas_semanales, codigo) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
            [fk_cedula, titulo_academico, especialidad, tipo_contrato, fecha_contratacion, estado_laboral, telefono, correo_institucional, horas_semanales, codigo]
        );

        res.json(resultado.rows[0]);
    } catch (error) {
        console.error("Error al registrar docente:", error.message);
        res.status(500).json({ mensaje: "Error en el servidor" });
    }
  };


export const obtenerMateriasDelDocente = async (req, res) => {
  try {
    const { id_docente } = req.user;
    const result = await pool.query(`
      SELECT 
        ad.id_asignacion,
        m.nombre AS materia,
        a.nombre AS año,
        s.nombre AS seccion,
        ae.nombre AS año_escolar
      FROM "AsignacionDocente" ad
      JOIN "Año_Materia" am ON ad.id_año_materia = am.id_año_materia
      JOIN "Materia" m ON am.codigo_materia = m.codigo_materia
      JOIN "Seccion" s ON ad.id_seccion = s.id_seccion
      JOIN "Año" a ON s.id_año = a.id_año
      JOIN "año_escolar" ae ON ad.fk_año_escolar = ae.id_año_escolar
      WHERE ad.id_docente = $1
      ORDER BY ae.nombre DESC, a.nombre, s.nombre, m.nombre
    `, [id_docente]);
    res.json({ asignaciones: result.rows });
  } catch (error) {
    res.status(500).json({ mensaje: "Error obteniendo asignaciones del docente" });
  }
};



export const buscarDocente = async (req, res) => {
    try {
        const { cedula } = req.params;
        const resultado = await pool.query(`
            SELECT u.nombres, u.apellidos, td.nombre AS tipo_documento, u.cedula
            FROM "Docente" d
            JOIN "Usuario" u ON d.fk_cedula = u.cedula
            LEFT JOIN "tipo_documento" td ON u.fk_documento = td.id_documento
            WHERE u.cedula = $1
        `, [cedula]);

        if (resultado.rows.length === 0) {
            return res.status(404).json({ mensaje: "Docente no encontrado" });
        }

        res.json(resultado.rows[0]);
    } catch (error) {
        res.status(500).json({ mensaje: "Error en el servidor" });
    }
};

export const constanciaTrabajoDocente = async (req, res) => {
    try {
        const { cedula } = req.params;

        // Traer docente, usuario, tipo de documento, código y fecha de contratación
        const resultado = await pool.query(`
            SELECT u.nombres, u.apellidos, td.nombre AS tipo_documento, u.cedula, d.codigo, d.fecha_contratacion
            FROM "Docente" d
            JOIN "Usuario" u ON d.fk_cedula = u.cedula
            LEFT JOIN "tipo_documento" td ON u.fk_documento = td.id_documento
            WHERE u.cedula = $1
        `, [cedula]);

        if (resultado.rows.length === 0) {
            return res.status(404).json({ mensaje: "Docente no encontrado" });
        }
        const docente = resultado.rows[0];

        // Traer el año escolar más reciente (nombre y id)
        const anioEscolarResult = await pool.query(`
            SELECT id_año_escolar, nombre FROM "año_escolar" ORDER BY id_año_escolar DESC LIMIT 1
        `);
        const id_año_escolar = anioEscolarResult.rows[0]?.id_año_escolar;

        // Traer director vigente del año escolar actual con tipo de documento
        let director = {
            nombre: "MARIA DE JESUS",
            apellido: "BONILLA NIÑO",
            titulo: "MsC",
            cedula: "12630931",
            tipo_documento: "V"
        };

        if (id_año_escolar) {
            const directorResult = await pool.query(`
                SELECT d.nombre, d.apellido, d.titulo, d.cedula, td.nombre AS tipo_documento
                FROM directores_anios_escolares dae
                JOIN directores d ON dae.director_id = d.id
                LEFT JOIN tipo_documento td ON d.tipo_documento = td.id_documento
                WHERE dae.id_año_escolar = $1
                  AND (dae.fecha_fin IS NULL OR dae.fecha_fin >= CURRENT_DATE)
                ORDER BY dae.fecha_inicio DESC
                LIMIT 1
            `, [id_año_escolar]);
            if (directorResult.rows.length > 0) {
                director = directorResult.rows[0];
            }
        }

        // Datos fijos
        const nombreLiceo = "Liceo Nacional LIBERTADOR";
        const codigoDEA = "OD06002005";
        const codigoAdministrativo = "18 007933480";
        const localidad = "Palo Gordo, Municipio Cárdenas del Estado Táchira";

        // Fecha actual en formato largo
        const meses = [
            "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
            "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
        ];
        const hoy = new Date();
        const fechaTexto = `Palo Gordo, a los ${hoy.getDate()} días del mes de ${meses[hoy.getMonth()]} del ${hoy.getFullYear()}.`;

        // Márgenes: 4cm arriba, 3cm derecha, 3cm abajo, 3cm izquierda (en puntos)
        const doc = new PDFDocument({
            margins: { top: 85, right: 85, bottom: 85, left: 85 }
        });

        // Manejar errores del stream
        doc.on('error', (err) => {
            console.error('Error generando PDF:', err);
            if (!res.headersSent) {
                res.status(500).json({ mensaje: "Error al generar PDF" });
            }
        });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=constancia_trabajo_${cedula}.pdf`);
        doc.pipe(res);

        // Logo único de cabecera (ocupa todo el ancho)
        const logoFullPath = path.join(__dirname, '../assets/LARGOHD.png'); // Usa tu imagen horizontal
        const logoHeight = 80;
        if (fs.existsSync(logoFullPath)) {
            doc.image(
                logoFullPath,
                doc.page.margins.left,
                doc.page.margins.top - 60,
                {
                    width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
                    height: logoHeight
                }
            );
        }
        let y = doc.page.margins.top + logoHeight - 40;

        // Título centrado
        doc.fontSize(16).font('Helvetica-Bold').text(
            "CONSTANCIA DE TRABAJO",
            doc.page.margins.left,
            y,
            {
                align: "center",
                width: doc.page.width - doc.page.margins.left - doc.page.margins.right
            }
        );

        y += 40;

        // Texto principal
        doc.fontSize(12).font('Helvetica').text(
            `Quien suscribe, ${director.titulo} ${director.nombre} ${director.apellido}, titular de la Cédula de Identidad Nº ${director.tipo_documento}-${director.cedula}, en mi carácter de Directora del ${nombreLiceo} identificado con el código DEA ${codigoDEA} y Administrativo ${codigoAdministrativo}, que funciona en la Localidad de ${localidad}, por medio de la presente hace constar que la ciudadana:`,
            doc.page.margins.left, y,
            { align: "justify", width: doc.page.width - doc.page.margins.left - doc.page.margins.right }
        );

        y = doc.y + 20;

        // Nombre del docente centrado y en cursiva
        doc.fontSize(14).font('Helvetica-Oblique').text(
            `${docente.nombres} ${docente.apellidos}`,
            doc.page.margins.left, y,
            { align: "center", width: doc.page.width - doc.page.margins.left - doc.page.margins.right }
        );

        y = doc.y + 10;

        // Cédula, cargo, código y fecha de inicio
        doc.fontSize(12).font('Helvetica').text(
            `Titular de la Cédula de Identidad Nº ${docente.tipo_documento || ''} ${docente.cedula}, labora en esta Institución como Personal DOCENTE, con código ${docente.codigo || ''}, con fecha de inicio ${docente.fecha_contratacion ? new Date(docente.fecha_contratacion).toLocaleDateString('es-VE') : ''}, cumpliendo con sus funciones según las normativas vigentes.`,
            doc.page.margins.left, y,
            { align: "justify", width: doc.page.width - doc.page.margins.left - doc.page.margins.right }
        );

        y = doc.y + 30;

        // Motivo y línea para escribirlo manualmente
        doc.fontSize(12).font('Helvetica').text(
            `Constancia que se expide a solicitud de la parte interesada, en ${fechaTexto}  con el siguiente motivo: `,
            doc.page.margins.left, y,
            { align: "justify", width: doc.page.width - doc.page.margins.left - doc.page.margins.right }
        );
        doc.moveDown(1);
        doc.text("______________________________________________________________", { align: "center" });

        // Espacio para firma manual
        doc.moveDown(4);
        doc.text("__________________________", { align: "center" });

        // Nombre y cargo del director
        doc.fontSize(12).font('Helvetica-Bold').text(
            `${director.titulo}. ${director.nombre} ${director.apellido}`,
            { align: "center" }
        );
        doc.fontSize(12).font('Helvetica').text("DIRECTORA", { align: "center" });

        // Imagen en el pie de página (ajusta la ruta y el tamaño según tu imagen)
        const piePath = path.join(__dirname, '../assets/pie.png');
        if (fs.existsSync(piePath)) {
            const pieHeight = 40;
            doc.image(
                piePath,
                doc.page.margins.left,
                doc.page.height - doc.page.margins.bottom - pieHeight + 10,
                {
                    width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
                    height: pieHeight
                }
            );
        }

        doc.end();
    } catch (error) {
        console.error(error);
        if (!res.headersSent) {
            res.status(500).json({ mensaje: "Error al generar PDF" });
        }
    }
};







export const registrarMateria = async (req, res) => {
    try {
        const { codigo_materia, nombre } = req.body;
         

        const existeCodigo = await pool.query(
            `SELECT * FROM "Materia" WHERE codigo_materia = $1 AND nombre = $2`,
            [codigo_materia, nombre]
        );

        if (existeCodigo.rows.length > 0) {
            return res.status(409).json({ mensaje: "Ya existe una Materia con esos datos." });
        }
         const existeCodigo2 = await pool.query(
            `SELECT * FROM "Materia" WHERE codigo_materia = $1`,
            [codigo_materia]
        );
         if (existeCodigo2.rows.length > 0) {
            return res.status(409).json({ mensaje: "Ya existe una Materia con ese codigo." });
        }

        if (!codigo_materia || !nombre) {
            return res.status(400).json({ mensaje: "Código y nombre son obligatorios." });
        }

        const resultado = await pool.query(
            `INSERT INTO "Materia" (codigo_materia, nombre) VALUES ($1, $2) RETURNING *`,
            [codigo_materia, nombre]
        );

        res.status(201).json({ mensaje: "Materia registrada exitosamente", materia: resultado.rows[0] });
    } catch (error) {
        console.error("Error al registrar materia:", error.message);
        res.status(500).json({ mensaje: "Error interno del servidor" });
    }
};


export const obtenerMateriasRegistradas = async (req, res) => {
    try {
        const resultado = await pool.query(`SELECT * FROM "Materia" ORDER BY nombre ASC`);
        res.json(resultado.rows);
    } catch (error) {
        console.error("Error obteniendo materias:", error.message);
        res.status(500).json({ mensaje: "Error interno del servidor" });
    }
};

export const actualizarMateria = async (req, res) => {
    try {
        const { codigo_materia } = req.params;
        const { nuevo_codigo, nombre } = req.body;

        // 🔹 Verificar que al menos un campo sea enviado
        if (!nuevo_codigo && !nombre) {
            return res.status(400).json({ mensaje: "Debes proporcionar al menos un campo para actualizar." });
        }

        let query = `UPDATE "Materia" SET `;
        const valores = [];
        let index = 1;

        if (nuevo_codigo) {
            query += `codigo_materia = $${index}, `;
            valores.push(nuevo_codigo);
            index++;
        }

        if (nombre) {
            query += `nombre = $${index}, `;
            valores.push(nombre);
            index++;
        }

        query = query.slice(0, -2); //  Quitar la última coma
        query += ` WHERE codigo_materia = $${index} RETURNING *`;
        valores.push(codigo_materia);

        const resultado = await pool.query(query, valores);

        if (resultado.rowCount === 0) {
            return res.status(404).json({ mensaje: "Materia no encontrada." });
        }

        res.status(200).json({ mensaje: "Materia actualizada exitosamente", materia: resultado.rows[0] });
    } catch (error) {
        console.error("Error al actualizar materia:", error.message);
        res.status(500).json({ mensaje: "Error interno del servidor" });
    }
};


export const eliminarMateria = async (req, res) => {
    try {
        const { codigo_materia } = req.params;

        // 1. Elimina en AsignacionDocente
        await pool.query(
            `DELETE FROM "AsignacionDocente" WHERE id_año_materia IN (
                SELECT id_año_materia FROM "Año_Materia" WHERE codigo_materia = $1
            )`,
            [codigo_materia]
        );

        // 2. Elimina en Año_Materia
        await pool.query(
            `DELETE FROM "Año_Materia" WHERE codigo_materia = $1`,
            [codigo_materia]
        );

        // 3. Elimina en Materia
        const resultado = await pool.query(
            `DELETE FROM "Materia" WHERE codigo_materia = $1 RETURNING *`,
            [codigo_materia]
        );

        if (resultado.rowCount === 0) {
            return res.status(404).json({ mensaje: "Materia no encontrada." });
        }

        res.status(200).json({ mensaje: "Materia eliminada exitosamente." });
    } catch (error) {
        console.error("Error al eliminar materia:", error.message);
        res.status(500).json({ mensaje: "Error interno del servidor" });
    }
};

export const obtenerDocentesYMaterias = async (req, res) => {
    try {
        const docentes = await pool.query(`
            SELECT d.id_docente, d.fk_cedula AS cedula, u.nombres AS nombre
            FROM "Docente" d
            JOIN "Usuario" u ON d.fk_cedula = u.cedula
            WHERE u.rol = 'usuario'
            ORDER BY u.nombres ASC
        `);

        const añosMateria = await pool.query(`
            SELECT am.id_año_materia, am.codigo_materia, m.nombre AS nombre_materia, a.id_año, a.nombre AS nombre_año
            FROM "Año_Materia" am
            JOIN "Materia" m ON am.codigo_materia = m.codigo_materia
            JOIN "Año" a ON am.id_año = a.id_año
            order by
                CASE a.nombre
                        WHEN 'Primero' THEN 1
                        WHEN 'Segundo' THEN 2
                        WHEN 'Tercero' THEN 3
                        WHEN 'Cuarto' THEN 4
                        WHEN 'Quinto' THEN 5
                        WHEN 'Sexto' THEN 6
                        ELSE 99
                    END ASC;


        `);

        const secciones = await pool.query(`
            SELECT s.id_seccion, s.nombre AS nombre_seccion, a.id_año, a.nombre AS nombre_año
            FROM "Seccion" s
            JOIN "Año" a ON s.id_año = a.id_año
            ORDER BY a.id_año ASC
        `);

        const añosEscolares = await pool.query(`SELECT id_año_escolar, nombre FROM "año_escolar" ORDER BY id_año_escolar DESC`);

        res.json({
            docentes: docentes.rows || [],
            añosMateria: añosMateria.rows || [],
            secciones: secciones.rows || [],
            añosEscolares: añosEscolares.rows || []
        });
    } catch (error) {
        console.error("Error obteniendo datos:", error.message);
        res.status(500).json({ mensaje: "Error interno del servidor" });
    }
};

export const asignarMateriasADocente = async (req, res) => {
    try {
        const { id_docente, id_año_materia, id_secciones, fk_año_escolar } = req.body;

        if (req.user.rol !== "admin") {
            return res.status(403).json({ mensaje: "Acceso denegado. Solo administradores pueden asignar materias." });
        }

        if (
            !id_docente ||
            !id_año_materia ||
            !Array.isArray(id_secciones) ||
            id_secciones.length === 0 ||
            !fk_año_escolar
        ) {
            return res.status(400).json({ mensaje: "Todos los campos son obligatorios y debe seleccionar al menos una sección." });
        }

        // Verifica duplicados antes de insertar
        for (const id_seccion of id_secciones) {
            const existe = await pool.query(
                `SELECT 1 FROM "AsignacionDocente" WHERE fk_año_escolar = $1 AND id_año_materia = $2 AND id_docente = $3 AND id_seccion = $4`,
                [fk_año_escolar, id_año_materia, id_docente, id_seccion]
            );
            if (existe.rows.length > 0) {
                return res.status(409).json({ mensaje: `Ya existe una asignación para la sección ${id_seccion}.` });
            }
        }

        // Inserta todas las asignaciones
        for (const id_seccion of id_secciones) {
            await pool.query(
                `INSERT INTO "AsignacionDocente" (id_docente, id_año_materia, id_seccion, fk_año_escolar) VALUES ($1, $2, $3, $4)`,
                [id_docente, id_año_materia, id_seccion, fk_año_escolar]
            );
        }

        res.status(201).json({ mensaje: "Materias asignadas exitosamente al docente." });
    } catch (error) {
        console.error("Error asignando materias:", error.message);
        res.status(500).json({ mensaje: "Error interno del servidor" });
    }
};

//materias para asignarle año 

export const obtenerMaterias = async (req, res) => {
    try {
        const materias = await pool.query(`SELECT codigo_materia, nombre FROM "Materia" ORDER BY nombre ASC`);
        
        res.json({ materias: materias.rows || [] });
    } catch (error) {
        console.error("Error obteniendo materias:", error.message);
        res.status(500).json({ mensaje: "Error interno del servidor" });
    }
};


// asignacion de año

export const asignarMateriaAño = async (req, res) => {
    try {
        const { codigo_materia, id_año } = req.body;
            
        if (!codigo_materia || !id_año) {
            return res.status(400).json({ mensaje: "Debes seleccionar una materia y un año." });
        }

        // Validar que el código de materia corresponde al año
        // Ejemplo: 01ART solo puede ir en primer año (id_año = 1), 02MAT en segundo (id_año = 2), etc.
        // Se asume que el código inicia con dos dígitos que representan el año
        const añoCodigo = parseInt(codigo_materia.substring(0, 2), 10);
        if (isNaN(añoCodigo) || añoCodigo !== parseInt(id_año, 10)) {
            return res.status(400).json({ mensaje: `La materia con código ${codigo_materia} solo puede asignarse al año ${añoCodigo}.` });
        }

        // Validar si la materia ya está asignada a ese año
        const existeAsignacion = await pool.query(
            `SELECT * FROM "Año_Materia" WHERE id_año = $1 AND codigo_materia = $2`,
            [id_año, codigo_materia]
        );

        if (existeAsignacion.rows.length > 0) {
            return res.status(409).json({ mensaje: "Esta materia ya está asignada a este año." });
        }

        // Vincular materia con el año en la tabla Año_Materia
        const asignacion = await pool.query(
            `INSERT INTO "Año_Materia" (id_año, codigo_materia) VALUES ($1, $2) RETURNING *`,
            [id_año, codigo_materia]
        );

        res.status(201).json({
            mensaje: "Materia asignada exitosamente al año.",
            asignacion: asignacion.rows[0]
        });
    } catch (error) {
        console.error("Error asignando materia a año:", error.message);
        res.status(500).json({ mensaje: "Error interno del servidor" });
    }
};

// obtener años para la materia 
export const obtenerAnios = async (req, res) => {
    try {
        const anios = await pool.query(`
            SELECT id_año, nombre AS nombre_año
            FROM "Año"
            ORDER BY id_año ASC
        `);

        res.json({ anios: anios.rows || [] });
    } catch (error) {
        console.error("Error obteniendo años:", error.message);
        res.status(500).json({ mensaje: "Error interno del servidor" });
    }
};

// obtener secciones 

export const obtenerSecciones = async (req, res) => {
    try {
        const secciones = await pool.query(`
            SELECT s.id_seccion, s.nombre AS nombre_seccion, a.id_año, a.nombre AS nombre_año
            FROM "Seccion" s
            JOIN "Año" a ON s.id_año = a.id_año
            ORDER BY a.id_año ASC
        `);

  
        res.json({ secciones: secciones.rows || [] });
    } catch (error) {
        console.error("Error obteniendo secciones:", error.message);
        res.status(500).json({ mensaje: "Error interno del servidor" });
    }
};

// traer los estudiantes para inscripcion

export const EstudiantesInscripcion = async (req, res) => {
    try {
        const { cedula } = req.query; // 🔥 Capturar cédula para filtrar si es necesario

        let query = `SELECT cedula, nombres, fecha_nacimiento, sexo FROM "Estudiante" `;
        let values = [];

        if (cedula) {
            query += ` WHERE cedula LIKE $1`;
            values.push(`${cedula}%`); // 🔥 Filtra por cédula parcial
        }

        query += ` ORDER BY nombres ASC`;

        const estudiantes = await pool.query(query, values);

        res.json({ estudiantes: estudiantes.rows || [] });
    } catch (error) {
        console.error("Error obteniendo estudiantes:", error.message);
        res.status(500).json({ mensaje: "Error interno del servidor" });
    }
};

//cabecera de inscripcion 

export const inscribirEstudiante = async (req, res) => {
    try {
        const { cedula_estudiante, id_seccion, fk_año_escolar } = req.body;

        if (!cedula_estudiante || !id_seccion || !fk_año_escolar) {
            return res.status(400).json({ mensaje: "Todos los campos son obligatorios." });
        }

        //  Validar si el estudiante ya está inscrito en esa sección
        const existeInscripcion = await pool.query(
            `SELECT * FROM "Inscripcion" WHERE cedula_estudiante = $1 AND id_seccion = $2 AND fk_año_escolar = $3`,
            [cedula_estudiante, id_seccion, fk_año_escolar]
        );

        if (existeInscripcion.rows.length > 0) {
            return res.status(409).json({ mensaje: "Este estudiante ya está inscrito en esta sección para este año escolar." });
        }
        //  Validar si el estudiante ya está inscrito en este año escolar
      /*  const existeInscripcion1 = await pool.query(
            `SELECT * FROM "Inscripcion" WHERE cedula_estudiante = $1  AND fk_año_escolar = $2`,
            [cedula_estudiante, fk_año_escolar]
        );
        if (existeInscripcion1.rows.length > 0) {
            return res.status(409).json({ mensaje: "Este estudiante ya está inscrito en  este año escolar." });
        }*/

        

        //  Insertar inscripción
        const inscripcion = await pool.query(
            `INSERT INTO "Inscripcion" (cedula_estudiante, id_seccion, fecha_inscripcion, fk_año_escolar) 
             VALUES ($1, $2, CURRENT_DATE, $3) RETURNING *`,
            [cedula_estudiante, id_seccion, fk_año_escolar]
        );

        res.status(201).json({
            mensaje: "Estudiante inscrito correctamente.",
            inscripcion: inscripcion.rows[0]
        });
    } catch (error) {
        console.error("Error inscribiendo estudiante:", error.message);
        res.status(500).json({ mensaje: "Error interno del servidor" });
    }
};

// traer años escolares

export const obtenerAniosEscolares = async (req, res) => {

    try {
        const resultado = await pool.query('SELECT id_año_escolar, nombre FROM "año_escolar" ORDER BY id_año_escolar DESC ');
        res.json({ añosEscolares: resultado.rows || [] });
    } catch (error) {
        console.error("Error obteniendo años escolares:", error.message);
        res.status(500).json({ mensaje: "Error interno del servidor" });
    }

}

// inscripcion de estudiantes cuerpo de la inscripcion
export const obtenerMateriasDisponibles = async (req, res) => {
    try {
        const { id_inscripcion } = req.params;

        // Obtener la sección y año escolar de la inscripción
        const inscripcion = await pool.query(`
            SELECT id_seccion, fk_año_escolar, cedula_estudiante FROM "Inscripcion" WHERE id_inscripcion = $1
        `, [id_inscripcion]);

        if (inscripcion.rows.length === 0) {
            return res.status(404).json({ mensaje: "Inscripción no encontrada." });
        }

        const idSeccion = inscripcion.rows[0].id_seccion;
        const fkAñoEscolar = inscripcion.rows[0].fk_año_escolar;
        const cedulaEstudiante = inscripcion.rows[0].cedula_estudiante;

        // Buscar el año escolar más reciente
        const añoEscolarRes = await pool.query(`SELECT id_año_escolar FROM "año_escolar" ORDER BY id_año_escolar DESC LIMIT 1`);
        const idAñoEscolarReciente = añoEscolarRes.rows[0]?.id_año_escolar;

        // Buscar materias reprobadas del año escolar anterior
        const añoAnteriorRes = await pool.query(`SELECT id_año_escolar FROM "año_escolar" WHERE id_año_escolar < $1 ORDER BY id_año_escolar DESC LIMIT 1`, [fkAñoEscolar]);
        let idAñoEscolarAnterior = null;
        if (añoAnteriorRes.rows.length > 0) {
            idAñoEscolarAnterior = añoAnteriorRes.rows[0].id_año_escolar;
        }

        let materiasReprobadas = [];
        if (idAñoEscolarAnterior) {
            const reprobadasRes = await pool.query(`
                SELECT mi.id_año_materia, m.codigo_materia, m.nombre AS nombre_materia, am.id_año_materia, ad.id_docente, u.cedula AS cedula_docente, u.nombres AS nombre_docente, u.apellidos AS apellido_docente
                FROM "MateriaInscrita" mi
                JOIN "Inscripcion" i ON mi.id_inscripcion = i.id_inscripcion
                JOIN "Año_Materia" am ON mi.id_año_materia = am.id_año_materia
                JOIN "Materia" m ON am.codigo_materia = m.codigo_materia
                LEFT JOIN "AsignacionDocente" ad ON am.id_año_materia = ad.id_año_materia AND ad.id_seccion = i.id_seccion AND ad.fk_año_escolar = $2
                LEFT JOIN "Docente" d ON ad.id_docente = d.id_docente
                LEFT JOIN "Usuario" u ON d.fk_cedula = u.cedula
                WHERE i.cedula_estudiante = $1
                  AND i.fk_año_escolar = $2
                  AND LOWER(mi.estado) = 'reprobada'
            `, [cedulaEstudiante, idAñoEscolarAnterior]);
            materiasReprobadas = reprobadasRes.rows;
        }

        // Obtener datos del estudiante
        const estudianteResult = await pool.query(`
            SELECT e.cedula AS cedula_estudiante, e.nombres, e.apellidos
            FROM "Inscripcion" i
            JOIN "Estudiante" e ON i.cedula_estudiante = e.cedula
            WHERE i.id_inscripcion = $1
        `, [id_inscripcion]);
        const estudiante = estudianteResult.rows[0] || null;

        let materiasComunes = [];
        // Si el estudiante tiene 0 reprobadas, mostrar todas las comunes
        // Si tiene 1 o 2 reprobadas, mostrar solo las reprobadas y NO las comunes
        // Si tiene más de 2 reprobadas, mostrar solo las reprobadas (todas)
        if (!materiasReprobadas || materiasReprobadas.length === 0) {
            // Consultar materias asignadas a esa sección en el año escolar más reciente
            const comunesRes = await pool.query(`
                SELECT DISTINCT 
                    am.id_año_materia, 
                    m.codigo_materia, 
                    m.nombre AS nombre_materia, 
                    ad.id_docente, 
                    u.cedula AS cedula_docente,
                    u.nombres AS nombre_docente,
                    u.apellidos AS apellido_docente
                FROM "Año_Materia" am
                JOIN "Materia" m ON am.codigo_materia = m.codigo_materia
                JOIN "AsignacionDocente" ad ON am.id_año_materia = ad.id_año_materia
                JOIN "Docente" d ON ad.id_docente = d.id_docente
                JOIN "Usuario" u ON d.fk_cedula = u.cedula
                WHERE ad.id_seccion = $1 AND ad.fk_año_escolar = $2
                ORDER BY m.nombre ASC
            `, [idSeccion, idAñoEscolarReciente]);
            materiasComunes = comunesRes.rows;
        }

        res.status(200).json({
            materiasComunes,
            materiasReprobadas,
            estudiante
        });
    } catch (error) {
        console.error("Error obteniendo inscripción:", error.message);
        res.status(500).json({ mensaje: "Error interno del servidor" });
    }
};
// inscribir materias a estudiantes
export const inscribirMateriaCuerpo = async (req, res) => {
    try {
        const { id_inscripcion, materias } = req.body;

        if (!id_inscripcion || !materias || materias.length === 0) {
            return res.status(400).json({ mensaje: "Faltan datos para la inscripción." });
        }

        // Obtener la cédula del estudiante y año escolar de la inscripción actual
        const inscripcionData = await pool.query(
            `SELECT cedula_estudiante, fk_año_escolar FROM "Inscripcion" WHERE id_inscripcion = $1`,
            [id_inscripcion]
        );
        if (inscripcionData.rows.length === 0) {
            return res.status(404).json({ mensaje: "Inscripción no encontrada." });
        }
        const { cedula_estudiante, fk_año_escolar } = inscripcionData.rows[0];

        // 1. Buscar el año escolar anterior
        const añoAnteriorRes = await pool.query(
            `SELECT id_año_escolar FROM "año_escolar" WHERE id_año_escolar < $1 ORDER BY id_año_escolar DESC LIMIT 1`,
            [fk_año_escolar]
        );
        let id_año_escolar_anterior = null;
        if (añoAnteriorRes.rows.length > 0) {
            id_año_escolar_anterior = añoAnteriorRes.rows[0].id_año_escolar;
        }

        // 2. Si hay año escolar anterior, buscar materias reprobadas
        let materiasReprobadas = [];
        if (id_año_escolar_anterior) {
            const reprobadasRes = await pool.query(
                `SELECT mi.id_materia_inscrita, mi.id_año_materia
                 FROM "MateriaInscrita" mi
                 JOIN "Inscripcion" i ON mi.id_inscripcion = i.id_inscripcion
                 WHERE i.cedula_estudiante = $1
                   AND i.fk_año_escolar = $2
                   AND LOWER(mi.estado) = 'reprobada'`,
                [cedula_estudiante, id_año_escolar_anterior]
            );
            materiasReprobadas = reprobadasRes.rows;
        }

        // 3. Si reprobó más de 2 materias, marcar todas como reprobadas en ese año
        if (materiasReprobadas.length > 2) {
            // Buscar todas las materias inscritas en ese año escolar
            const todasRes = await pool.query(
                `SELECT mi.id_materia_inscrita
                 FROM "MateriaInscrita" mi
                 JOIN "Inscripcion" i ON mi.id_inscripcion = i.id_inscripcion
                 WHERE i.cedula_estudiante = $1
                   AND i.fk_año_escolar = $2`,
                [cedula_estudiante, id_año_escolar_anterior]
            );
            const todasIds = todasRes.rows.map(r => r.id_materia_inscrita);
            if (todasIds.length > 0) {
                await pool.query(
                    `UPDATE "MateriaInscrita" SET estado = 'reprobada' WHERE id_materia_inscrita = ANY($1::int[])`,
                    [todasIds]
                );
            }
        }

        let materiasInsertadas = [];
        let materiasDuplicadas = [];
        let materiasAprobadas = [];

        for (const id_año_materia of materias) {
            // Verificar si ya está inscrita en esta inscripción
            const existeMateria = await pool.query(
                `SELECT 1 FROM "MateriaInscrita" WHERE id_inscripcion = $1 AND id_año_materia = $2`,
                [id_inscripcion, id_año_materia]
            );
            if (existeMateria.rows.length > 0) {
                materiasDuplicadas.push(id_año_materia);
                continue;
            }

            // Verificar si ya aprobó esa materia en inscripciones anteriores
            const yaAprobada = await pool.query(
                `SELECT 1
                 FROM "MateriaInscrita" mi
                 JOIN "Inscripcion" i ON mi.id_inscripcion = i.id_inscripcion
                 WHERE i.cedula_estudiante = $1
                   AND mi.id_año_materia = $2
                   AND LOWER(mi.estado) = 'aprobada'
                   AND i.fk_año_escolar < $3`,
                [cedula_estudiante, id_año_materia, fk_año_escolar]
            );
            if (yaAprobada.rows.length > 0) {
                materiasAprobadas.push(id_año_materia);
                continue;
            }

            // Insertar la materia
            const inscripcionMateria = await pool.query(
                `INSERT INTO "MateriaInscrita" (id_inscripcion, id_año_materia, estado, nota_final) 
                 VALUES ($1, $2, 'Inscrita', NULL) RETURNING *`,
                [id_inscripcion, id_año_materia]
            );
            materiasInsertadas.push(inscripcionMateria.rows[0]);
        }

        if ((materiasDuplicadas.length > 0 || materiasAprobadas.length > 0) && materiasInsertadas.length === 0) {
            return res.status(409).json({
                mensaje: "El estudiante ya está inscrito o ya aprobó todas las materias seleccionadas.",
                materiasDuplicadas,
                materiasAprobadas
            });
        }

        res.status(201).json({
            mensaje: `Se inscribieron ${materiasInsertadas.length} materias correctamente.`,
            materias: materiasInsertadas,
            materiasDuplicadas,
            materiasAprobadas
        });

    } catch (error) {
        console.error("Error inscribiendo materias:", error.message);
        res.status(500).json({ mensaje: "Error interno del servidor" });
    }
};

export const obtenerInscripcionesActivas = async (req, res) => {
    try {
        const inscripciones = await pool.query(`
    SELECT 
        i.id_inscripcion, 
        e.nombres, 
        e.apellidos, 
        s.nombre AS nombre_seccion, 
        a.nombre AS nombre_año,         -- Año de la sección
        ae.nombre AS nombre_año_escolar
        FROM "Inscripcion" i
        JOIN "Estudiante" e ON i.cedula_estudiante = e.cedula
        JOIN "Seccion" s ON i.id_seccion = s.id_seccion
        JOIN "Año" a ON s.id_año = a.id_año
        JOIN "año_escolar" ae ON i.fk_año_escolar = ae.id_año_escolar
        ORDER BY e.nombres 
    `);

        res.json({ inscripciones: inscripciones.rows });
    } catch (error) {
        console.error("Error obteniendo inscripciones:", error.message);
        res.status(500).json({ mensaje: "Error interno del servidor" });
    }
};



export const obtenerEstadisticasDashboard = async (req, res) => {
  try {
    // Total de estudiantes
    const { rows: estudiantes } = await pool.query('SELECT COUNT(*) FROM "Estudiante"');
    // Total de docentes
    const { rows: docentes } = await pool.query('SELECT COUNT(*) FROM "Docente"');
    // Total de materias
    const { rows: materias } = await pool.query('SELECT COUNT(*) FROM "Materia"');
    // Total de inscripciones
    const { rows: inscripciones } = await pool.query('SELECT COUNT(*) FROM "Inscripcion"');
    // Estudiantes por año (para gráfica)
    const { rows: estudiantesPorAño } = await pool.query(`
      SELECT a.nombre as año, COUNT(i.cedula_estudiante) as cantidad
      FROM "Inscripcion" i
      JOIN "Seccion" s ON i.id_seccion = s.id_seccion
      JOIN "Año" a ON s.id_año = a.id_año
      GROUP BY a.nombre
      ORDER BY a.nombre
    `);

    // Año escolar más reciente
    const { rows: añoEscolarRows } = await pool.query('SELECT id_año_escolar FROM "año_escolar" ORDER BY id_año_escolar DESC LIMIT 1');
    const idAñoEscolarReciente = añoEscolarRows[0]?.id_año_escolar;

    // Estudiantes reprobados: más de 2 materias reprobadas en el año escolar más reciente
    const { rows: reprobados } = await pool.query(`
      SELECT i.cedula_estudiante
      FROM "Inscripcion" i
      JOIN "MateriaInscrita" mi ON i.id_inscripcion = mi.id_inscripcion
      WHERE i.fk_año_escolar = $1 AND LOWER(mi.estado) = 'reprobada'
      GROUP BY i.cedula_estudiante
      HAVING COUNT(*) > 2
    `, [idAñoEscolarReciente]);

    // Estudiantes aprobados: todas las materias inscritas en el año escolar más reciente están aprobadas
    const { rows: aprobados } = await pool.query(`
      SELECT i.cedula_estudiante
      FROM "Inscripcion" i
      JOIN "MateriaInscrita" mi ON i.id_inscripcion = mi.id_inscripcion
      WHERE i.fk_año_escolar = $1
      GROUP BY i.cedula_estudiante
      HAVING COUNT(*) = SUM(CASE WHEN LOWER(mi.estado) = 'aprobada' THEN 1 ELSE 0 END)
    `, [idAñoEscolarReciente]);

    res.json({
      totalEstudiantes: parseInt(estudiantes[0].count),
      totalDocentes: parseInt(docentes[0].count),
      totalMaterias: parseInt(materias[0].count),
      totalInscripciones: parseInt(inscripciones[0].count),
      estudiantesPorAño,
      totalReprobados: reprobados.length,
      totalAprobados: aprobados.length
    });
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo estadísticas', detalle: err.message });
  }
};


export const listarMateriasInscritas = async (req, res) => {
    try {
        const { filtro, anioEscolar } = req.query; // filtro: nombre/cedula, anioEscolar: año escolar exacto
        let query = `
            SELECT 
                mi.id_materia_inscrita,
                mi.id_inscripcion,
                i.cedula_estudiante,
                e.nombres,
                e.apellidos,
                ae.nombre AS año_escolar,
                m.nombre AS nombre_materia,
                m.codigo_materia
            FROM "MateriaInscrita" mi
            JOIN "Inscripcion" i ON mi.id_inscripcion = i.id_inscripcion
            JOIN "Estudiante" e ON i.cedula_estudiante = e.cedula
            JOIN "año_escolar" ae ON i.fk_año_escolar = ae.id_año_escolar
            JOIN "Año_Materia" am ON mi.id_año_materia = am.id_año_materia
            JOIN "Materia" m ON am.codigo_materia = m.codigo_materia
        `;
        let values = [];
        let where = [];
        if (filtro) {
            values.push(`%${filtro.toLowerCase()}%`);
            where.push(`(
                LOWER(e.nombres) LIKE $${values.length} OR 
                LOWER(e.apellidos) LIKE $${values.length} OR 
                LOWER(i.cedula_estudiante) LIKE $${values.length}
            )`);
        }
        if (anioEscolar) {
            values.push(anioEscolar);
            where.push(`ae.nombre = $${values.length}`);
        }
        if (where.length > 0) {
            query += " WHERE " + where.join(" AND ");
        }
        query += ` ORDER BY ae.nombre DESC, e.nombres ASC, m.nombre ASC`;

        const result = await pool.query(query, values);
        res.json({ materiasInscritas: result.rows });
    } catch (error) {
        console.error("Error listando materias inscritas:", error.message);
        res.status(500).json({ mensaje: "Error interno del servidor" });
    }
};

// Eliminar materia inscrita
export const eliminarMateriaInscrita = async (req, res) => {
    try {
        const { id_materia_inscrita } = req.params;
        const result = await pool.query(
            `DELETE FROM "MateriaInscrita" WHERE id_materia_inscrita = $1 RETURNING *`,
            [id_materia_inscrita]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ mensaje: "Materia inscrita no encontrada." });
        }
        res.json({ mensaje: "Materia eliminada correctamente." });
    } catch (error) {
        res.status(500).json({ mensaje: "Error interno del servidor" });
    }
};

// materias reprobadas 
export const obtenerMateriasReprobadas = async (req, res) => {
    try {
        const { cedula_estudiante } = req.params;
        const result = await pool.query(`
            SELECT 
                mi.id_año_materia,
                m.nombre AS nombre_materia,
                m.codigo_materia,
                mi.nota_final,
                ae.nombre AS año_escolar
            FROM "MateriaInscrita" mi
            JOIN "Inscripcion" i ON mi.id_inscripcion = i.id_inscripcion
            JOIN "Año_Materia" am ON mi.id_año_materia = am.id_año_materia
            JOIN "Materia" m ON am.codigo_materia = m.codigo_materia
            JOIN "año_escolar" ae ON i.fk_año_escolar = ae.id_año_escolar
            WHERE i.cedula_estudiante = $1
              AND LOWER(mi.estado) = 'reprobada'
              AND NOT EXISTS (
                  SELECT 1
                  FROM "MateriaInscrita" mi2
                  JOIN "Inscripcion" i2 ON mi2.id_inscripcion = i2.id_inscripcion
                  WHERE i2.cedula_estudiante = i.cedula_estudiante
                    AND mi2.id_año_materia = mi.id_año_materia
                    AND LOWER(mi2.estado) = 'aprobada'
              )
        `, [cedula_estudiante]);
        res.json({ materiasReprobadas: result.rows });
    } catch (error) {
        console.error("Error obteniendo materias reprobadas:", error.message);
        res.status(500).json({ mensaje: "Error interno del servidor" });
    }
};

export const listarMateriasInscritasAgrupadas = async (req, res) => {
    try {
        const { filtro } = req.query;
        let query = `
            SELECT 
                
                e.cedula,
                e.nombres,
                e.apellidos,
                s.nombre AS nombre_seccion,
                a.nombre AS nombre_año,
                ae.nombre AS año_escolar,
                i.id_inscripcion,
                json_agg(json_build_object(
                    'id_materia_inscrita', mi.id_materia_inscrita, 
                    'nombre_materia', m.nombre,
                    'codigo_materia', m.codigo_materia,
                    'nombre_docente', u.nombres,
                    'apellido_docente', u.apellidos,
                    'cedula_docente', u.cedula,
                    'seccion', s.nombre,
                    'año', a.nombre
                )) AS materias
            FROM "Inscripcion" i
            JOIN "Estudiante" e ON i.cedula_estudiante = e.cedula
            JOIN "Seccion" s ON i.id_seccion = s.id_seccion
            JOIN "Año" a ON s.id_año = a.id_año
            JOIN "año_escolar" ae ON i.fk_año_escolar = ae.id_año_escolar
            JOIN "MateriaInscrita" mi ON mi.id_inscripcion = i.id_inscripcion
            JOIN "Año_Materia" am ON mi.id_año_materia = am.id_año_materia
            JOIN "Materia" m ON am.codigo_materia = m.codigo_materia
            LEFT JOIN "AsignacionDocente" ad ON ad.id_año_materia = am.id_año_materia AND ad.id_seccion = s.id_seccion AND ad.fk_año_escolar = i.fk_año_escolar
            LEFT JOIN "Docente" d ON ad.id_docente = d.id_docente
            LEFT JOIN "Usuario" u ON d.fk_cedula = u.cedula
        `;
        let values = [];
        let where = [];
        if (filtro) {
            values.push(`%${filtro.toLowerCase()}%`);
            where.push(`(
                LOWER(e.nombres) LIKE $${values.length} OR 
                LOWER(e.apellidos) LIKE $${values.length} OR 
                LOWER(e.cedula) LIKE $${values.length}
            )`);
        }
        if (where.length > 0) {
            query += " WHERE " + where.join(" AND ");
        }
        query += `
            GROUP BY e.cedula, e.nombres, e.apellidos, s.nombre, a.nombre, ae.nombre, i.id_inscripcion
            ORDER BY e.nombres ASC, e.apellidos ASC
        `;

        const result = await pool.query(query, values);
        res.json({ estudiantes: result.rows });
    } catch (error) {
        console.error("Error listando materias inscritas agrupadas:", error.message);
        res.status(500).json({ mensaje: "Error interno del servidor" });
    }
};


// Listar inscripciones con filtro
export const listarInscripciones = async (req, res) => {
  try {
    const { filtro } = req.query;
    let query = `
      SELECT 
        i.id_inscripcion,
        e.cedula,
        e.nombres,
        e.apellidos,
        s.nombre AS nombre_seccion,
        a.nombre AS nombre_año,
        ae.nombre AS año_escolar,
        i.fecha_inscripcion
      FROM "Inscripcion" i
      JOIN "Estudiante" e ON i.cedula_estudiante = e.cedula
      JOIN "Seccion" s ON i.id_seccion = s.id_seccion
      JOIN "Año" a ON s.id_año = a.id_año
      JOIN "año_escolar" ae ON i.fk_año_escolar = ae.id_año_escolar
    `;
    let values = [];
    if (filtro) {
      query += ` WHERE LOWER(e.nombres) LIKE $1 OR LOWER(e.apellidos) LIKE $1 OR e.cedula LIKE $1 `;
      values.push(`%${filtro.toLowerCase()}%`);
    }
    query += ` ORDER BY i.fecha_inscripcion DESC`;
    const result = await pool.query(query, values);
    res.json({ inscripciones: result.rows });
  } catch (error) {
    console.error("Error listando inscripciones:", error.message);
    res.status(500).json({ mensaje: "Error interno del servidor" });
  }
};

// Eliminar inscripción en cascada
export const eliminarInscripcion = async (req, res) => {
  try {
    const { id_inscripcion } = req.params;

    //  Elimino materias inscritas asociadas
    await pool.query(`DELETE FROM "MateriaInscrita" WHERE id_inscripcion = $1`, [id_inscripcion]);
    //  Elimino la inscripción
    const result = await pool.query(`DELETE FROM "Inscripcion" WHERE id_inscripcion = $1 RETURNING *`, [id_inscripcion]);
    if (result.rowCount === 0) {
      return res.status(404).json({ mensaje: "Inscripción no encontrada." });
    }
    res.json({ mensaje: "Inscripción eliminada correctamente." });
  } catch (error) {
    console.error("Error eliminando inscripción:", error.message);
    res.status(500).json({ mensaje: "Error interno del servidor" });
  }
};

// Editar inscripción (solo sección y año escolar)
export const editarInscripcion = async (req, res) => {
  try {
    const { id_inscripcion } = req.params;
    const { id_seccion, fk_año_escolar } = req.body;
    if (!id_seccion || !fk_año_escolar) {
      return res.status(400).json({ mensaje: "Sección y año escolar son obligatorios." });
    }
    const result = await pool.query(
      `UPDATE "Inscripcion" SET id_seccion = $1, fk_año_escolar = $2 WHERE id_inscripcion = $3 RETURNING *`,
      [id_seccion, fk_año_escolar, id_inscripcion]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ mensaje: "Inscripción no encontrada." });
    }
    res.json({ mensaje: "Inscripción actualizada correctamente.", inscripcion: result.rows[0] });
  } catch (error) {
    console.error("Error editando inscripción:", error.message);
    res.status(500).json({ mensaje: "Error interno del servidor" });
  }
};
/////////////////////////////////////////////////////////

export const listarMateriasYEstudiantesDocente = async (req, res) => {
  try {
    const { id_docente } = req.user;
    const { anioEscolar } = req.query;

    const query = `
      SELECT 
        ad.id_asignacion,
        m.nombre AS materia,
        s.nombre AS seccion,
        a.nombre AS año,
        ae.nombre AS año_escolar,
        e.cedula,
        e.nombres,
        e.apellidos,
        mi.id_materia_inscrita
      FROM "AsignacionDocente" ad
      JOIN "Año_Materia" am ON ad.id_año_materia = am.id_año_materia
      JOIN "Materia" m ON am.codigo_materia = m.codigo_materia
      JOIN "Seccion" s ON ad.id_seccion = s.id_seccion
      JOIN "Año" a ON s.id_año = a.id_año
      JOIN "año_escolar" ae ON ad.fk_año_escolar = ae.id_año_escolar
      JOIN "Inscripcion" i ON i.id_seccion = ad.id_seccion AND i.fk_año_escolar = ad.fk_año_escolar
      JOIN "Estudiante" e ON i.cedula_estudiante = e.cedula
      JOIN "MateriaInscrita" mi ON mi.id_inscripcion = i.id_inscripcion AND mi.id_año_materia = am.id_año_materia
      WHERE ad.id_docente = $1
        ${anioEscolar ? "AND ae.nombre = $2" : ""}
      ORDER BY m.nombre, s.nombre, e.apellidos, e.nombres
    `;
    const values = [id_docente];
    if (anioEscolar) values.push(anioEscolar);

    const result = await pool.query(query, values);

    // Agrupa por materia y sección
    const materias = {};
    for (const row of result.rows) {
      const key = `${row.materia} - ${row.año} - ${row.seccion}`;
      if (!materias[key]) {
        materias[key] = {
          id_asignacion: row.id_asignacion,
          materia: row.materia,
          año: row.año,
          seccion: row.seccion,
          año_escolar: row.año_escolar,
          estudiantes: []
        };
      }
      materias[key].estudiantes.push({
        cedula: row.cedula,
        nombres: row.nombres,
        apellidos: row.apellidos,
        id_materia_inscrita: row.id_materia_inscrita
      });
    }

    res.json({ materias: Object.values(materias) });
  } catch (error) {
    console.error("Error listando materias y estudiantes del docente:", error.message);
    res.status(500).json({ mensaje: "Error interno del servidor" });
  }
};





















export const guardarNotaEvaluacion = async (req, res) => {
  try {
    const { id_materia_inscrita, fk_momento, nota, descripcion, fk_corte, rep } = req.body;

    // Buscar si ya existe la evaluación para ese momento
    const existe = await pool.query(
      `SELECT * FROM "Evaluacion" WHERE fk_materia_inscrita = $1 AND fk_momento = $2`,
      [id_materia_inscrita, fk_momento]
    );

    if (existe.rows.length > 0) {
      // Actualizar
      await pool.query(
        `UPDATE "Evaluacion" SET nota = $1, descripcion = $2, fk_corte = $3, rep = $4
         WHERE fk_materia_inscrita = $5 AND fk_momento = $6 RETURNING *`,
        [nota, descripcion, fk_corte, rep, id_materia_inscrita, fk_momento]
      );
    } else {
      // Insertar
      await pool.query(
        `INSERT INTO "Evaluacion" (fk_materia_inscrita, fk_momento, nota, descripcion, fk_corte, rep)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id_materia_inscrita, fk_momento, nota, descripcion, fk_corte, rep]
      );
    }

    // Calcular definitiva y estado
    const lapsos = await pool.query(
      `SELECT nota FROM "Evaluacion" WHERE fk_materia_inscrita = $1 AND fk_momento IN (1,2,3) ORDER BY fk_momento ASC`,
      [id_materia_inscrita]
    );
    const notasValidas = lapsos.rows
      .map(ev => ev.nota)
      .filter(n => n !== null && n !== undefined && n !== '')
      .map(Number)
      .filter(n => !isNaN(n));

    // Traer la nota de reparación (solo momento 4)
    const repResult = await pool.query(
      `SELECT rep FROM "Evaluacion" WHERE fk_materia_inscrita = $1 AND fk_momento = 4 LIMIT 1`,
      [id_materia_inscrita]
    );
    const notaRep = repResult.rows.length > 0 ? Number(repResult.rows[0].rep) : null;

    let definitiva = null;
    let estado = null;

    if (notasValidas.length === 3) {
      const promedio = notasValidas.reduce((a, b) => a + b, 0) / 3;
      definitiva = Math.round(promedio);

      if (definitiva >= 9.5) {
        estado = 'aprobada';
      } else if (notaRep !== null && !isNaN(notaRep)) {
        estado = notaRep >= 10 ? 'aprobada' : 'reprobada';
      } else {
        estado = 'reprobada';
      }
    } else if (notaRep !== null && !isNaN(notaRep)) {
      definitiva = null;
      estado = notaRep >= 10 ? 'aprobada' : 'reprobada';
    } else {
      definitiva = null;
      estado = null;
    }

    await pool.query(
      `UPDATE "MateriaInscrita" SET estado = $1, nota_final = $2 WHERE id_materia_inscrita = $3`,
      [estado, definitiva, id_materia_inscrita]
    );

    res.json({ mensaje: "Nota guardada correctamente." });
  } catch (error) {
    console.error("Error guardando nota:", error.message);
    res.status(500).json({ mensaje: "Error interno del servidor" });
  }
};

export const editarEvaluacion = async (req, res) => {
  try {
    const { id_materia_inscrita, fk_momento } = req.params;
    const { nota, descripcion, fk_corte, rep } = req.body;

    // Actualizar la evaluación (incluye rep)
    const result = await pool.query(
      `UPDATE "Evaluacion" SET nota = $1, descripcion = $2, fk_corte = $3, rep = $4
       WHERE fk_materia_inscrita = $5 AND fk_momento = $6 RETURNING *`,
      [nota, descripcion, fk_corte, rep, id_materia_inscrita, fk_momento]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ mensaje: "Evaluación no encontrada." });
    }

    // Traer las notas de los 3 lapsos
    const lapsos = await pool.query(
      `SELECT nota FROM "Evaluacion" WHERE fk_materia_inscrita = $1 AND fk_momento IN (1,2,3) ORDER BY fk_momento ASC`,
      [id_materia_inscrita]
    );
    const notasValidas = lapsos.rows
      .map(ev => ev.nota)
      .filter(n => n !== null && n !== undefined && n !== '')
      .map(Number)
      .filter(n => !isNaN(n));

    // Traer la nota de reparación (solo momento 4)
    const repResult = await pool.query(
      `SELECT rep FROM "Evaluacion" WHERE fk_materia_inscrita = $1 AND fk_momento = 4 LIMIT 1`,
      [id_materia_inscrita]
    );
    const notaRep = repResult.rows.length > 0 ? Number(repResult.rows[0].rep) : null;

    let definitiva = null;
    let estado = null;

    if (notasValidas.length === 3) {
      const promedio = notasValidas.reduce((a, b) => a + b, 0) / 3;
      definitiva = Math.round(promedio);

      if (definitiva >= 9.5) {
        estado = 'aprobada';
      } else if (notaRep !== null && !isNaN(notaRep)) {
        estado = notaRep >= 10 ? 'aprobada' : 'reprobada';
      } else {
        estado = 'reprobada';
      }
    } else if (notaRep !== null && !isNaN(notaRep)) {
      definitiva = null;
      estado = notaRep >= 10 ? 'aprobada' : 'reprobada';
    } else {
      definitiva = null;
      estado = null;
    }

    await pool.query(
      `UPDATE "MateriaInscrita" SET estado = $1, nota_final = $2 WHERE id_materia_inscrita = $3`,
      [estado, definitiva, id_materia_inscrita]
    );

    res.json({ mensaje: "Evaluación actualizada correctamente." });
  } catch (error) {
    res.status(500).json({ mensaje: "Error editando evaluación" });
  }
};

export const obtenerEvaluacionesMateriaInscrita = async (req, res) => {
  try {
    const { id_materia_inscrita } = req.params;
    const result = await pool.query(
      `SELECT fk_momento, nota, descripcion
       FROM "Evaluacion"
       WHERE fk_materia_inscrita = $1
       ORDER BY fk_momento ASC`,
      [id_materia_inscrita]
    );
    res.json({ evaluaciones: result.rows });
  } catch (error) {
    res.status(500).json({ mensaje: "Error consultando historial de notas" });
  }
};

// Eliminar una evaluación (nota de un lapso)
export const eliminarEvaluacion = async (req, res) => {
  try {
    const { id_materia_inscrita, fk_momento } = req.params;
    const result = await pool.query(
      `DELETE FROM "Evaluacion" WHERE fk_materia_inscrita = $1 AND fk_momento = $2 RETURNING *`,
      [id_materia_inscrita, fk_momento]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ mensaje: "Evaluación no encontrada." });
    }
    //  Recalcular definitiva y estado
    const lapsos = await pool.query(
      `SELECT nota, recuperacion_1, recuperacion_2, recuperacion_3 FROM "Evaluacion" WHERE fk_materia_inscrita = $1 ORDER BY fk_momento ASC`,
      [id_materia_inscrita]
    );
const notasValidas = lapsos.rows.map(ev => {
  if (!ev) return null;
  if (ev.nota >= 10) return Number(ev.nota);
  if (ev.recuperacion_1 >= 10) return Number(ev.recuperacion_1);
  if (ev.recuperacion_2 >= 10) return Number(ev.recuperacion_2);
  if (ev.recuperacion_3 >= 10) return Number(ev.recuperacion_3);
  return Math.max(
    Number(ev.nota) || 0,
    Number(ev.recuperacion_1) || 0,
    Number(ev.recuperacion_2) || 0,
    Number(ev.recuperacion_3) || 0
  );
});

// Solo si hay 3 lapsos válidos, calcula definitiva
let definitiva = null;
let estado = null;
if (
  notasValidas.length === 3 &&
  notasValidas.every(n => typeof n === "number" && !isNaN(n))
) {
  const promedio = notasValidas.reduce((a, b) => a + b, 0) / 3;
  let notaFinal = promedio;
  if (promedio > 15) notaFinal = Math.min(promedio + 1, 20);
  definitiva = notaFinal;
  estado = notaFinal >= 10 ? 'aprobada' : 'reprobada';
} else {
  definitiva = null;
  estado = null;
}
await pool.query(
  `UPDATE "MateriaInscrita" SET estado = $1, nota_final = $2 WHERE id_materia_inscrita = $3`,
  [estado, definitiva, id_materia_inscrita]
);
    res.json({ mensaje: "Evaluación eliminada correctamente." });
  } catch (error) {
    res.status(500).json({ mensaje: "Error eliminando evaluación" });
  }
};


export const imprimirRegistroCalificaciones = async (req, res) => {
  try {
    const { id_asignacion } = req.params;
    // Traer datos de la asignación
    const datosAsignacion = await pool.query(`
      SELECT 
        ad.id_asignacion,
        m.nombre AS materia,
        s.nombre AS seccion,
        a.nombre AS año,
        ae.nombre AS año_escolar,
        ae.id_año_escolar,
        u.nombres AS nombre_docente,
        u.apellidos AS apellido_docente
      FROM "AsignacionDocente" ad
      JOIN "Año_Materia" am ON ad.id_año_materia = am.id_año_materia
      JOIN "Materia" m ON am.codigo_materia = m.codigo_materia
      JOIN "Seccion" s ON ad.id_seccion = s.id_seccion
      JOIN "Año" a ON s.id_año = a.id_año
      JOIN "año_escolar" ae ON ad.fk_año_escolar = ae.id_año_escolar
      JOIN "Docente" d ON ad.id_docente = d.id_docente
      JOIN "Usuario" u ON d.fk_cedula = u.cedula
      WHERE ad.id_asignacion = $1
      LIMIT 1
    `, [id_asignacion]);
    if (datosAsignacion.rows.length === 0) {
      return res.status(404).json({ mensaje: "Asignación no encontrada." });
    }
    const info = datosAsignacion.rows[0];

    // Materias apreciativas
    const materiasApreciativas = [
      "orientación y convivencia",
      "participación en grupos de recreación"
    ];
    const materiaEsApreciativa = materiasApreciativas.includes(
      (info.materia || '').trim().toLowerCase()
    );

    // Traer estudiantes con tipo de documento
    const estudiantes = await pool.query(`
      SELECT 
        e.cedula,
        e.nombres,
        e.apellidos,
        mi.id_materia_inscrita,
        mi.nota_final,
        mi.estado,
        td.nombre AS tipo_documento
      FROM "MateriaInscrita" mi
      JOIN "Inscripcion" i ON mi.id_inscripcion = i.id_inscripcion
      JOIN "Estudiante" e ON i.cedula_estudiante = e.cedula
      LEFT JOIN "tipo_documento" td ON e.fk_documento = td.id_documento
      JOIN "AsignacionDocente" ad 
        ON ad.id_año_materia = mi.id_año_materia
        AND ad.fk_año_escolar = i.fk_año_escolar
        AND ad.id_seccion = i.id_seccion
      WHERE ad.id_asignacion = $1
      ORDER BY e.apellidos, e.nombres
    `, [id_asignacion]);

    // Traer evaluaciones (incluye rep)
    const idsMateriasInscritas = estudiantes.rows.map(e => e.id_materia_inscrita);
    let evaluaciones = [];
    let reps = [];
    if (idsMateriasInscritas.length > 0) {
      const evals = await pool.query(`
        SELECT fk_materia_inscrita, fk_momento, nota, rep
        FROM "Evaluacion"
        WHERE fk_materia_inscrita = ANY($1)
      `, [idsMateriasInscritas]);
      evaluaciones = evals.rows;
      // Extraer las notas de reparación (momento 4)
      reps = evals.rows.filter(ev => ev.fk_momento === 4).map(ev => ({
        fk_materia_inscrita: ev.fk_materia_inscrita,
        rep: ev.rep
      }));
    }

    // Traer director vigente y tipo de documento desde la tabla intermedia
    let director = {
      nombre: "MARIA DE JESUS",
      apellido: "BONILLA NIÑO",
      titulo: "MsC",
      cedula: "12630931",
      tipo_documento: "V"
    };
    if (info.id_año_escolar) {
      const directorResult = await pool.query(`
        SELECT d.nombre, d.apellido, d.titulo, d.cedula, td.nombre AS tipo_documento
        FROM directores_anios_escolares dae
        JOIN directores d ON dae.director_id = d.id
        LEFT JOIN tipo_documento td ON d.tipo_documento = td.id_documento
        WHERE dae.id_año_escolar = $1
          AND (dae.fecha_fin IS NULL OR dae.fecha_fin >= CURRENT_DATE)
        ORDER BY dae.fecha_inicio DESC
        LIMIT 1
      `, [info.id_año_escolar]);
      if (directorResult.rows.length > 0) {
        director = directorResult.rows[0];
      }
    }

    // Utilidad para convertir nota a letra
    function notaALetra(nota) {
      if (nota === '' || nota === null || nota === undefined) return '';
      const n = Number(nota);
      if (n === 20 || n === 19) return 'A';
      if (n >= 15 && n <= 18) return 'B';
      if (n >= 11 && n <= 14) return 'C';
      return 'D';
    }
    // Utilidad para definitiva en letras (con casos especiales BBD, BDB, DBB = C)
    function definitivaLetra(l1, l2, l3) {
      if (!l1 || !l2 || !l3) return '';
      if (l1 === l2 && l2 === l3) return l1;
      const comb = [l1, l2, l3].sort().join('');
      if (comb === 'BBD' || comb === 'BDB' || comb === 'DBB') return 'C';
      const orden = ['A', 'B', 'C', 'D'];
      const letras = [l1, l2, l3];
      for (const letra of orden) {
        if (letras.filter(l => l === letra).length === 2) return letra;
      }
      const presentes = letras.map(l => orden.indexOf(l)).sort((a, b) => a - b);
      return orden[presentes[1]];
    }

    // Preparar datos de estudiantes
    const estudiantesConNotas = estudiantes.rows.map(est => {
      const evals = evaluaciones.filter(ev => ev.fk_materia_inscrita === est.id_materia_inscrita);
      const getEval = lapso => evals.find(e => e.fk_momento === lapso) || {};
      // Buscar rep para esta materia inscrita
      const repObj = reps.find(r => r.fk_materia_inscrita === est.id_materia_inscrita);
      const repNota = repObj ? repObj.rep : '';
      if (materiaEsApreciativa) {
        // Mostrar notas en letra
        const l1 = notaALetra(getEval(1).nota ?? '');
        const l2 = notaALetra(getEval(2).nota ?? '');
        const l3 = notaALetra(getEval(3).nota ?? '');
        return {
          ...est,
          cedula_completa: `${est.tipo_documento || 'V'}-${est.cedula}`,
          lapso1: l1,
          lapso2: l2,
          lapso3: l3,
          nota_final: definitivaLetra(l1, l2, l3),
          rep: repNota,
          estado: est.estado
        };
      } else {
        // Mostrar notas numéricas
        return {
          ...est,
          cedula_completa: `${est.tipo_documento || 'V'}-${est.cedula}`,
          lapso1: getEval(1).nota ?? '',
          lapso2: getEval(2).nota ?? '',
          lapso3: getEval(3).nota ?? '',
          nota_final: est.nota_final !== null ? est.nota_final : '',
          rep: repNota,
          estado: est.estado
        };
      }
    });

    // --- PDF ---
    const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'portrait' });
    doc.on('error', (err) => {
      console.error('Error generando PDF:', err);
      if (!res.headersSent) {
        res.status(500).json({ mensaje: "Error generando PDF" });
      }
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=registro_calificaciones_${info.materia}_${info.seccion}_${info.año_escolar}.pdf`);
    doc.pipe(res);

    // --- Encabezado izquierdo ---
    const encabezadoIzq = [
      "Cód. DEA: OD06002005",
      "Cód. Adm.: 18 007933480",
      "Palo Gordo, Municipio Cárdenas",
      "Estado Táchira"
    ];
    let y = 30;
    doc.fontSize(7).font('Helvetica');
    encabezadoIzq.forEach(linea => {
      doc.text(linea, 40, y, { align: 'left' });
      y += 13;
    });

    // --- Logo esquina derecha ---
    const logoPath = path.join(__dirname, '../assets/purologo.png');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, doc.page.width - 120, 30, { width: 55, height: 55 });
    }

    // --- Membrete centrado ---
    doc.fontSize(11).font('Helvetica-Bold');
    doc.text(
      "República Bolivariana de Venezuela\nMinisterio del Poder Popular para la Educación\nLiceo Nacional Libertador",
      0, 30,
      { align: 'center', width: doc.page.width }
    );

    // --- Título centrado debajo del membrete ---
    y = 110;
    doc.fontSize(16).font('Helvetica-Bold').text(
      'Registro de Calificaciones',
      0, y,
      { align: 'center', width: doc.page.width }
    );
    y += 30;

    // --- Datos de la asignación centrados debajo del título ---
    doc.fontSize(12).font('Helvetica');
    doc.text(`Docente: ${info.nombre_docente} ${info.apellido_docente}`, 0, y, { align: 'center', width: doc.page.width });
    y += 18;
    // Título de materia con "Notas apreciativas" si corresponde
    let materiaTitulo = info.materia;
    if (materiaEsApreciativa) {
      materiaTitulo += " (Notas apreciativas)";
    }
    doc.text(`Materia: ${materiaTitulo}`, 0, y, { align: 'center', width: doc.page.width });
    y += 18;
    doc.text(`Año: ${info.año}   Sección: ${info.seccion}   Año Escolar: ${info.año_escolar}`, 0, y, { align: 'center', width: doc.page.width });
    y += 25;

    // --- Tabla centrada ---
    const cols = [
      { key: 'cedula_completa', label: 'CÉDULA', width: 90 },
      { key: 'nombres', label: 'NOMBRES', width: 125 },
      { key: 'apellidos', label: 'APELLIDOS', width: 129 },
      { key: 'lapso1', label: 'M1', width: 23 },
      { key: 'lapso2', label: 'M2', width: 23 },
      { key: 'lapso3', label: 'M3', width: 23 },
      { key: 'nota_final', label: 'DEF', width: 27 },
      { key: 'rep', label: 'REP', width: 27 }, // Nueva columna REP
      { key: 'estado', label: 'ESTADO', width: 70 }
    ];
    const totalWidth = cols.reduce((sum, col) => sum + col.width, 0);
    const startX = (doc.page.width - totalWidth) / 2;
    let tablaY = y;
    const rowHeight = 24;
    const maxRowsPerPage = Math.floor((doc.page.height - tablaY - 120) / rowHeight);

    // Encabezado de tabla
    let x = startX;
    doc.font('Helvetica-Bold').fontSize(11);
    cols.forEach(col => {
      doc.rect(x, tablaY, col.width, rowHeight).stroke();
      doc.text(col.label, x + 2, tablaY + 7, { width: col.width - 4, align: 'center' });
      x += col.width;
    });

    // Filas de estudiantes
    tablaY += rowHeight;
    doc.font('Helvetica').fontSize(10);
    let rowCount = 0;
    estudiantesConNotas.forEach((est, idx) => {
      x = startX;
      cols.forEach(col => {
        doc.rect(x, tablaY, col.width, rowHeight).stroke();
        let valor = est[col.key];
        if (col.key === 'estado' && valor)
          valor = valor.charAt(0).toUpperCase() + valor.slice(1);
        if (col.key === 'nota_final')
          valor = est.nota_final !== null ? est.nota_final : '';
        if (col.key === 'rep')
          valor = est.rep !== undefined && est.rep !== null && est.rep !== '' ? est.rep : '';
        doc.text(valor ?? '', x + 2, tablaY + 7, { width: col.width - 4, align: 'center' });
        x += col.width;
      });
      tablaY += rowHeight;
      rowCount++;

      // Salto de página si es necesario
      if (rowCount >= maxRowsPerPage && idx < estudiantesConNotas.length - 1) {
        doc.addPage();
        // Redibujar encabezado y membrete en nueva página
        let yPag = 30;
        doc.fontSize(10).font('Helvetica');
        encabezadoIzq.forEach(linea => {
          doc.text(linea, 40, yPag, { align: 'left' });
          yPag += 13;
        });
        if (fs.existsSync(logoPath)) {
          doc.image(logoPath, doc.page.width - 120, 30, { width: 55, height: 55 });
        }
        doc.fontSize(11).font('Helvetica-Bold');
        doc.text(
          "República Bolivariana de Venezuela\nMinisterio del Poder Popular para la Educación\nLiceo Nacional Libertador",
          0, 30,
          { align: 'center', width: doc.page.width }
        );
        yPag = 110;
        doc.fontSize(16).font('Helvetica-Bold').text(
          'Registro de Calificaciones',
          0, yPag,
          { align: 'center', width: doc.page.width }
        );
        yPag += 30;
        doc.fontSize(12).font('Helvetica');
        doc.text(`Docente: ${info.nombre_docente} ${info.apellido_docente}`, 0, yPag, { align: 'center', width: doc.page.width });
        yPag += 18;
        // Título de materia con "Notas apreciativas" si corresponde
        let materiaTituloPag = info.materia;
        if (materiaEsApreciativa) {
          materiaTituloPag += " (Notas apreciativas)";
        }
        doc.text(`Materia: ${materiaTituloPag}`, 0, yPag, { align: 'center', width: doc.page.width });
        yPag += 18;
        doc.text(`Año: ${info.año}   Sección: ${info.seccion}   Año Escolar: ${info.año_escolar}`, 0, yPag, { align: 'center', width: doc.page.width });
        yPag += 25;
        tablaY = yPag;
        x = startX;
        doc.font('Helvetica-Bold').fontSize(11);
        cols.forEach(col => {
          doc.rect(x, tablaY, col.width, rowHeight).stroke();
          doc.text(col.label, x + 2, tablaY + 7, { width: col.width - 4, align: 'center' });
          x += col.width;
        });
        tablaY += rowHeight;
        doc.font('Helvetica').fontSize(10);
        rowCount = 0;
      }
    });

    // Espacio antes de la firma
    tablaY += 50;
    if (tablaY > doc.page.height - 120) {
      doc.addPage();
      tablaY = 120;
    }

    // Barra para firma y datos del director centrados
    const barraFirmaInicio = startX + totalWidth / 3;
    const barraFirmaFin = startX + (2 * totalWidth) / 3;
    doc.moveTo(barraFirmaInicio, tablaY).lineTo(barraFirmaFin, tablaY).stroke();
    tablaY += 8;
    doc.fontSize(11).font('Helvetica-Bold').text(
      `${director.titulo} ${director.nombre} ${director.apellido}`,
      startX, tablaY,
      { align: 'center', width: totalWidth }
    );
    tablaY += 16;
    doc.fontSize(11).font('Helvetica-Bold').text(
      `${director.tipo_documento || 'V'}-${director.cedula}`,
      startX, tablaY,
      { align: 'center', width: totalWidth }
    );
    tablaY += 16;
    doc.fontSize(11).font('Helvetica').text(
      "DIRECTOR(A)",
      startX, tablaY,
      { align: 'center', width: totalWidth }
    );

    doc.end();
  } catch (error) {
    console.error("Error generando PDF:", error.message);
    res.status(500).json({ mensaje: "Error generando PDF" });
  }
};

//olvido de usuarios





// Solicitar recuperación (envía correo con enlace)
export const solicitarRecuperacion = async (req, res) => {
    const { email } = req.body;
    try {
        const result = await pool.query('SELECT * FROM "Usuario" WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(404).json({ mensaje: "Correo no registrado" });
        }
        const usuario = result.rows[0];

        const token = crypto.randomBytes(32).toString('hex');
        const expiracion = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

        await pool.query(
            'UPDATE "Usuario" SET reset_token = $1, reset_token_expiracion = $2 WHERE email = $3',
            [token, expiracion, email]
        );

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              // correo de donse se enviaran los datos
                user: 'liceolibertador2025@gmail.com',
                pass: 'slsd krqq nizd pxwn'
            }
        });

        const enlace = `http://localhost:3000/restablecer/${token}`;

        await transporter.sendMail({
           
            from: '"Soporte Liceo" <TU_CORREO@gmail.com>',
            to: email,
            subject: "Recuperación de acceso",
            html: `<p>Hola ${usuario.nombres},</p>
                   <p>Haz clic en el siguiente enlace para restablecer tu contraseña y ver tu usuario:</p>
                   <a href="${enlace}">${enlace}</a>
                   <p>Tu usuario es: <b>${usuario.usuario}</b></p>
                   <p>Este enlace expirará en 1 hora.</p>`
        });

        res.json({ mensaje: "Correo de recuperación enviado" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "Error enviando correo de recuperación" });
    }
};


export const restablecerContrasena = async (req, res) => {
    const { token } = req.params;
    const { nuevaContrasena } = req.body;
    try {
        const result = await pool.query(
            'SELECT * FROM "Usuario" WHERE reset_token = $1 AND reset_token_expiracion > NOW()',
            [token]
        );
       /* if (result.rows.length === 0) {
            return res.status(400).json({ mensaje: "Token inválido o expirado" });
        }*/
        const hash = await bcrypt.hash(nuevaContrasena,  10);

        await pool.query(
            'UPDATE "Usuario" SET contraseña = $1, reset_token = NULL, reset_token_expiracion = NULL WHERE reset_token = $2',
            [hash, token]
        );
        res.json({ mensaje: "Contraseña restablecida correctamente" });
    } catch (error) {
        res.status(500).json({ mensaje: "Error al restablecer la contraseña" });
    }
};


/////// XAVIER NUEVOS CONTROLADORES
// director
export const registrarDirector = async (req, res) => {
  try {
    const {
      nombre,
      apellido,
      cedula,
      tipo_documento,
      email,
      telefono,
      titulo,
      activo
    } = req.body;

    // Validación básica
    if (
      !nombre ||
      !apellido ||
      !cedula ||
      !tipo_documento ||
      !email ||
      !titulo
    ) {
      return res.status(400).json({ mensaje: "Todos los campos obligatorios" });
    }

    // Verificar si ya existe por cédula o email
    const existe = await pool.query(
      'SELECT * FROM directores WHERE cedula = $1 OR email = $2',
      [cedula, email]
    );
    if (existe.rows.length > 0) {
      return res.status(409).json({ mensaje: "Ya existe un director con esa cédula o email" });
    }

    // Insertar nuevo director
    const result = await pool.query(
      `INSERT INTO directores
        (nombre, apellido, cedula, tipo_documento, email, telefono, titulo, activo)
       VALUES (UPPER($1), UPPER($2), $3, $4, $5, $6, UPPER($7), $8)
       RETURNING *`,
      [
        nombre,
        apellido,
        cedula,
        tipo_documento,
        email,
        telefono,
        titulo,
        activo !== undefined ? activo : true
      ]
    );

    res.status(201).json({
      mensaje: "Director registrado correctamente",
      director: result.rows[0]
    });
  } catch (error) {
    console.error("Error registrando director:", error.message);
    res.status(500).json({ mensaje: "Error interno del servidor" });
  }
};
export const listarUsuarios = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT 
                cedula, nombres, apellidos, telefono, usuario, email, 
                COALESCE(rol, 'usuario') AS rol 
             FROM "Usuario" 
             ORDER BY nombres ASC`
        );
        res.json(result.rows);
    } catch (error) {
        console.error("Error listando usuarios:", error.message);
        res.status(500).json({ mensaje: "Error interno del servidor" });
    }
};



export const asignarDirectorAnioEscolar = async (req, res) => {
  try {
    const { director_id, id_año_escolar, fecha_inicio } = req.body;

    // Validación básica
    if (!director_id || !id_año_escolar || !fecha_inicio) {
      return res.status(400).json({ mensaje: "Todos los campos son obligatorios" });
    }

    // Cerrar periodo anterior del mismo año escolar (si existe)
    await pool.query(`
      UPDATE directores_anios_escolares
      SET fecha_fin = CURRENT_DATE
      WHERE id_año_escolar = $1 AND fecha_fin IS NULL
    `, [id_año_escolar]);

    // Insertar nueva asignación
    const result = await pool.query(`
      INSERT INTO directores_anios_escolares (director_id, id_año_escolar, fecha_inicio)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [director_id, id_año_escolar, fecha_inicio]);

    res.status(201).json({
      mensaje: "Director asignado correctamente al año escolar",
      asignacion: result.rows[0]
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ mensaje: "Ya existe un director asignado a ese año escolar" });
    }
    console.error("Error asignando director:", error.message);
    res.status(500).json({ mensaje: "Error interno del servidor" });
  }
};


export const listarDirectores = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, nombre, apellido, cedula, email, telefono, titulo, activo FROM directores ORDER BY apellido, nombre'
    );
    res.json({ directores: result.rows });
  } catch (error) {
    res.status(500).json({ mensaje: "Error listando directores" });
  }
};


export const editarUsuario = async (req, res) => {
    try {
        const { cedula } = req.params;
        const { nombres, apellidos, telefono, usuario, email, rol } = req.body;

        if (!cedula || !nombres || !apellidos || !telefono || !usuario || !email || !rol) {
            return res.status(400).json({ mensaje: "Todos los campos son obligatorios." });
        }

        const query = `
            UPDATE "Usuario"
            SET nombres = UPPER($1), apellidos = UPPER($2), telefono = $3, usuario = $4, email = $5, rol = $6
            WHERE cedula = $7
            RETURNING *
        `;
        const values = [nombres, apellidos, telefono, usuario, email, rol, cedula];

        const result = await pool.query(query, values);

        if (result.rowCount === 0) {
            return res.status(404).json({ mensaje: "Usuario no encontrado." });
        }

        res.json({ mensaje: "Usuario actualizado correctamente.", usuario: result.rows[0] });
    } catch (error) {
        console.error("Error editando usuario:", error.message);
        res.status(500).json({ mensaje: "Error interno del servidor" });
    }
};


export const crearAnioEscolar = async (req, res) => {
    try {
        const { nombre } = req.body;
        if (!nombre) {
            return res.status(400).json({ mensaje: "El nombre del año escolar es obligatorio." });
        }

        // Verifica que no exista un año escolar con el mismo nombre
        const existe = await pool.query(
            'SELECT * FROM "año_escolar" WHERE nombre = $1',
            [nombre]
        );
        if (existe.rows.length > 0) {
            return res.status(409).json({ mensaje: "Ya existe un año escolar con ese nombre." });
        }

        const result = await pool.query(
            'INSERT INTO "año_escolar" (nombre) VALUES ($1) RETURNING *',
            [nombre]
        );
        res.status(201).json({ mensaje: "Año escolar creado correctamente", anioEscolar: result.rows[0] });
    } catch (error) {
        console.error("Error creando año escolar:", error.message);
        res.status(500).json({ mensaje: "Error interno del servidor" });
    }
};


// ...existing code...

export const eliminarUsuario = async (req, res) => {
    try {
        const { cedula } = req.params;
        const result = await pool.query(
            `DELETE FROM "Usuario" WHERE cedula = $1 RETURNING *`,
            [cedula]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ mensaje: "Usuario no encontrado." });
        }
        res.json({ mensaje: "Usuario eliminado correctamente." });
    } catch (error) {
      if (error.code === '23503') {
            return res.status(409).json({ mensaje: "No se puede eliminar el usuario porque está relacionado con otros registros." });
        }
        
        console.error("Error eliminando usuario:", error.message);
        res.status(500).json({ mensaje: "Error interno del servidor" });
    }
};

// ...existing code...
export const imprimirComprobanteInscripcion = async (req, res) => {
  try {
    const { id_inscripcion } = req.params;

    // 1. Traer datos de la inscripción, estudiante, sección, año, año escolar
    const inscripcionResult = await pool.query(`
      SELECT 
        i.id_inscripcion,
        i.fecha_inscripcion,
        i.fk_año_escolar,
        e.nombres,
        e.apellidos,
        e.cedula,
        td.nombre AS tipo_documento,
        s.nombre AS nombre_seccion,
        a.nombre AS nombre_año,
        ae.nombre AS año_escolar
      FROM "Inscripcion" i
      JOIN "Estudiante" e ON i.cedula_estudiante = e.cedula
      LEFT JOIN "tipo_documento" td ON e.fk_documento = td.id_documento
      JOIN "Seccion" s ON i.id_seccion = s.id_seccion
      JOIN "Año" a ON s.id_año = a.id_año
      JOIN "año_escolar" ae ON i.fk_año_escolar = ae.id_año_escolar
      WHERE i.id_inscripcion = $1
      LIMIT 1
    `, [id_inscripcion]);
    if (inscripcionResult.rows.length === 0) {
      return res.status(404).json({ mensaje: "Inscripción no encontrada." });
    }
    const inscripcion = inscripcionResult.rows[0];
    const id_año_escolar = inscripcion.fk_año_escolar;

    // 2. Traer materias inscritas con docente asignado y tipo de documento del docente
    const materiasResult = await pool.query(`
      SELECT 
        m.nombre AS nombre_materia, 
        m.codigo_materia,
        u.nombres AS nombre_docente,
        u.apellidos AS apellido_docente,
        u.cedula AS cedula_docente,
        td.nombre AS tipo_documento_docente
      FROM "MateriaInscrita" mi
      JOIN "Año_Materia" am ON mi.id_año_materia = am.id_año_materia
      JOIN "Materia" m ON am.codigo_materia = m.codigo_materia
      JOIN "AsignacionDocente" ad ON ad.id_año_materia = am.id_año_materia AND ad.id_seccion = (
        SELECT id_seccion FROM "Inscripcion" WHERE id_inscripcion = $1
      ) AND ad.fk_año_escolar = (
        SELECT fk_año_escolar FROM "Inscripcion" WHERE id_inscripcion = $1
      )
      LEFT JOIN "Docente" d ON ad.id_docente = d.id_docente
      LEFT JOIN "Usuario" u ON d.fk_cedula = u.cedula
      LEFT JOIN "tipo_documento" td ON u.fk_documento = td.id_documento
      WHERE mi.id_inscripcion = $1
      ORDER BY m.nombre ASC
    `, [id_inscripcion]);
    const materias = materiasResult.rows;

    // 3. Datos del director (tabla intermedia)
    let director = { nombre: "MARIA DE JESUS", apellido: "BONILLA NIÑO", titulo: "MsC", cedula: "12630931", tipo_documento: "V" };
    if (id_año_escolar) {
      const directorResult = await pool.query(`
        SELECT d.nombre, d.apellido, d.titulo, d.cedula, td.nombre AS tipo_documento
        FROM directores_anios_escolares dae
        JOIN directores d ON dae.director_id = d.id
        LEFT JOIN tipo_documento td ON d.tipo_documento = td.id_documento
        WHERE dae.id_año_escolar = $1
          AND (dae.fecha_fin IS NULL OR dae.fecha_fin >= CURRENT_DATE)
        ORDER BY dae.fecha_inicio DESC
        LIMIT 1
      `, [id_año_escolar]);
      if (directorResult.rows.length > 0) {
        director = directorResult.rows[0];
      }
    }

    // 4. Crear PDF con márgenes amplios
    const doc = new PDFDocument({ 
      size: 'A4', 
      layout: 'portrait',
      margins: { top: 60, bottom: 60, left: 60, right: 60 }
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=comprobante_inscripcion_${inscripcion.cedula}.pdf`);
    doc.pipe(res);

    // --- Logos ---
    const escudoPath = path.join(__dirname, '../assets/cardenas.jpeg');
    const logoPath = path.join(__dirname, '../assets/purologo.png');
    if (fs.existsSync(escudoPath)) {
      doc.image(escudoPath, doc.page.margins.left, doc.page.margins.top - 10, { width: 55, height: 55 });
    }
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, doc.page.width - doc.page.margins.right - 55, doc.page.margins.top - 10, { width: 55, height: 55 });
    }

    // --- Membrete centrado ---
    doc.fontSize(12).font('Helvetica-Bold');
    doc.text(
      `República Bolivariana de Venezuela\n` +
      `Ministerio del Poder Popular para la Educación\n` +
      `Liceo Nacional Libertador\n` +
      `Cód. DEA: OD06002005   Cód. Adm.: 18 007933480\n` +
      `Palo Gordo, Municipio Cárdenas, Estado Táchira`,
      doc.page.margins.left, doc.page.margins.top,
      { align: 'center', width: doc.page.width - doc.page.margins.left - doc.page.margins.right }
    );

    // --- Título ---
    let y = doc.page.margins.top + 90;
    doc.fontSize(16).font('Helvetica-Bold').text(
      'COMPROBANTE DE INSCRIPCIÓN',
      doc.page.margins.left, y,
      { align: 'center', width: doc.page.width - doc.page.margins.left - doc.page.margins.right }
    );
    y += 35;

    // --- Datos del estudiante ---
    doc.fontSize(12).font('Helvetica');
    doc.text(`Estudiante: ${(inscripcion.nombres + " " + inscripcion.apellidos).toUpperCase()}`, doc.page.margins.left, y, { align: 'left' });
    y += 18;
    doc.text(`Cédula: ${(inscripcion.tipo_documento || 'V')}-${inscripcion.cedula}`, doc.page.margins.left, y, { align: 'left' });
    y += 18;
    doc.text(`Año: ${inscripcion.nombre_año}    Sección: ${inscripcion.nombre_seccion}    Año Escolar: ${inscripcion.año_escolar}`, doc.page.margins.left, y, { align: 'left' });
    y += 18;
    doc.text(`Fecha de inscripción: ${new Date(inscripcion.fecha_inscripcion).toLocaleDateString('es-VE')}`, doc.page.margins.left, y, { align: 'left' });
    y += 30;

    // --- Tabla de materias inscritas ---
    doc.fontSize(13).font('Helvetica-Bold').text('MATERIAS INSCRITAS:', doc.page.margins.left, y, { align: 'left' });
    y += 20;

    // Definir columnas de la tabla (más espacio para docente)
    const tableCols = [
      { key: 'nombre_materia', label: 'MATERIA', width: 150 },
      { key: 'codigo_materia', label: 'CÓDIGO', width: 70 },
      { key: 'nombre_docente', label: 'DOCENTE', width: 210 },
      { key: 'cedula_docente', label: 'DOCUMENTO', width: 90 }
    ];
    const tableTotalWidth = tableCols.reduce((sum, col) => sum + col.width, 0);
    const tableStartX = (doc.page.width - tableTotalWidth) / 2;
    let tableY = y;

    // Encabezado de la tabla
    let x = tableStartX;
    doc.font('Helvetica-Bold').fontSize(11);
    tableCols.forEach(col => {
      doc.rect(x, y, col.width, 28).stroke();
      doc.text(col.label, x + 2, y + 8, { width: col.width - 4, align: 'center' });
      x += col.width;
    });

    // Filas de materias
    tableY += 28;
    doc.font('Helvetica').fontSize(10);
    materias.forEach(mat => {
      x = tableStartX;
      tableCols.forEach(col => {
        let valor = mat[col.key];
        if (col.key === 'nombre_materia' && valor) {
          valor = valor.toUpperCase();
        }
        if (col.key === 'nombre_docente') {
          // Nombre completo en mayúsculas, apellidos incluidos
          valor = ((mat.nombre_docente || '') + ' ' + (mat.apellido_docente || '')).toUpperCase().trim();
        }
        if (col.key === 'cedula_docente') {
          valor = (mat.tipo_documento_docente ? mat.tipo_documento_docente + '-' : '') + (mat.cedula_docente || '');
        }
        // Ajuste: Si el texto es muy largo, reducir tamaño de fuente o truncar
        doc.rect(x, tableY, col.width, 26).stroke();
        doc.text(valor ?? '', x + 2, tableY + 7, { width: col.width - 4, align: 'center', ellipsis: true });
        x += col.width;
      });
      tableY += 26;
    });

    // --- Pie: espacio para firma al pie de página ---
    // Centrar la línea y los textos respecto a la tabla
    const pieY = doc.page.height - doc.page.margins.bottom - 80;
    const firmaLineStart = tableStartX + tableTotalWidth / 4;
    const firmaLineEnd = tableStartX + (3 * tableTotalWidth) / 4;
    doc.moveTo(firmaLineStart, pieY).lineTo(firmaLineEnd, pieY).stroke();

    let firmaY = pieY + 8;
    doc.fontSize(12).font('Helvetica-Bold').text(
      `${director.titulo} ${director.nombre} ${director.apellido}`,
      tableStartX, firmaY,
      { align: 'center', width: tableTotalWidth }
    );
    firmaY += 16;
    doc.fontSize(12).font('Helvetica-Bold').text(
      `${director.tipo_documento || 'V'}-${director.cedula}`,
      tableStartX, firmaY,
      { align: 'center', width: tableTotalWidth }
    );
    firmaY += 16;
    doc.fontSize(12).font('Helvetica').text(
      "DIRECTOR(A)",
      tableStartX, firmaY,
      { align: 'center', width: tableTotalWidth }
    );

    doc.end();
  } catch (error) {
    console.error("Error generando comprobante de inscripción:", error.message);
    res.status(500).json({ mensaje: "Error generando comprobante de inscripción" });
  }
};
// Listar asignaciones paginadas
export const listarAsignacionesDocente = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;

    // Total de asignaciones
    const totalResult = await pool.query('SELECT COUNT(*) FROM "AsignacionDocente"');
    const total = parseInt(totalResult.rows[0].count);

    // Consulta paginada
    const result = await pool.query(`
      SELECT 
        ad.id_asignacion,
        u.nombres AS nombre_docente,
        u.apellidos AS apellido_docente,
        u.cedula AS cedula_docente,
        td.nombre AS tipo_documento_docente,
        m.nombre AS nombre_materia,
        m.codigo_materia,
        a.nombre AS año,
        s.nombre AS seccion,
        ae.nombre AS año_escolar
      FROM "AsignacionDocente" ad
      JOIN "Docente" d ON ad.id_docente = d.id_docente
      JOIN "Usuario" u ON d.fk_cedula = u.cedula
      LEFT JOIN "tipo_documento" td ON u.fk_documento = td.id_documento
      JOIN "Año_Materia" am ON ad.id_año_materia = am.id_año_materia
      JOIN "Materia" m ON am.codigo_materia = m.codigo_materia
      JOIN "Año" a ON am.id_año = a.id_año
      JOIN "Seccion" s ON ad.id_seccion = s.id_seccion
      JOIN "año_escolar" ae ON ad.fk_año_escolar = ae.id_año_escolar
      ORDER BY ae.nombre DESC, a.nombre, s.nombre, m.nombre, u.nombres
      
    `)

    res.json({
      asignaciones: result.rows,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error("Error listando asignaciones:", error.message);
    res.status(500).json({ mensaje: "Error interno del servidor" });
  }
};

// Eliminar asignación
export const eliminarAsignacionDocente = async (req, res) => {
  try {
    const { id_asignacion } = req.params;
    const result = await pool.query(
      `DELETE FROM "AsignacionDocente" WHERE id_asignacion = $1 RETURNING *`,
      [id_asignacion]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ mensaje: "Asignación no encontrada." });
    }
    res.json({ mensaje: "Asignación eliminada correctamente." });
  } catch (error) {
    console.error("Error eliminando asignación:", error.message);
    res.status(500).json({ mensaje: "Error interno del servidor" });
  }
};

// Editar asignación (puedes editar materia, sección y año escolar)
export const editarAsignacionDocente = async (req, res) => {
  try {
    const { id_asignacion } = req.params;
    const { id_docente, id_año_materia, id_seccion, fk_año_escolar } = req.body;

    if (!id_docente || !id_año_materia || !id_seccion || !fk_año_escolar) {
      return res.status(400).json({ mensaje: "Todos los campos son obligatorios." });
    }

    const result = await pool.query(
      `UPDATE "AsignacionDocente"
       SET id_docente = $1, id_año_materia = $2, id_seccion = $3, fk_año_escolar = $4
       WHERE id_asignacion = $5 RETURNING *`,
      [id_docente, id_año_materia, id_seccion, fk_año_escolar, id_asignacion]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ mensaje: "Asignación no encontrada." });
    }
    res.json({ mensaje: "Asignación actualizada correctamente.", asignacion: result.rows[0] });
  } catch (error) {
    console.error("Error editando asignación:", error.message);
    res.status(500).json({ mensaje: "Error interno del servidor" });
  }
};

export const listarDocentes = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.id_docente, u.nombres AS nombre, u.apellidos AS apellido, u.cedula
      FROM "Docente" d
      JOIN "Usuario" u ON d.fk_cedula = u.cedula
      ORDER BY u.nombres, u.apellidos
    `);
    res.json({ docentes: result.rows });
  } catch (error) {
    res.status(500).json({ mensaje: "Error obteniendo docentes" });
  }
};

export const listarMateriasAnio = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT am.id_año_materia, m.nombre AS nombre_materia, a.nombre AS nombre_año
      FROM "Año_Materia" am
      JOIN "Materia" m ON am.codigo_materia = m.codigo_materia
      JOIN "Año" a ON am.id_año = a.id_año
      ORDER BY a.nombre, m.nombre
    `);
    res.json({ añosMateria: result.rows });
  } catch (error) {
    res.status(500).json({ mensaje: "Error obteniendo materias por año" });
  }
};

// Listar todos los estudiantes
export const listarEstudiantes = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        e.cedula, 
        e.nombres, 
        e.apellidos, 
        n.nombre AS nacionalidad, 
        e.sexo, 
        e.fecha_nacimiento, 
        e.lugar_nacimiento,
        td.nombre AS tipo_documento
      FROM "Estudiante" e
      LEFT JOIN "tipo_documento" td ON e.fk_documento = td.id_documento
      LEFT JOIN "nacionalidad" n ON e.nacionalidad = n.id_nacionalidad
      ORDER BY e.nombres, e.apellidos
    `);
    res.json({ estudiantes: result.rows });
  } catch (error) {
    console.error("Error listando estudiantes:", error.message);
    res.status(500).json({ mensaje: "Error interno del servidor" });
  }
};

// Eliminar estudiante por cédula
export const eliminarEstudiante = async (req, res) => {
  try {
    const { cedula } = req.params;
    // Elimina inscripciones y materias inscritas asociadas (en cascada si FK lo permite)
    await pool.query(`DELETE FROM "MateriaInscrita" WHERE id_inscripcion IN (SELECT id_inscripcion FROM "Inscripcion" WHERE cedula_estudiante = $1)`, [cedula]);
    await pool.query(`DELETE FROM "Inscripcion" WHERE cedula_estudiante = $1`, [cedula]);
    const result = await pool.query(`DELETE FROM "Estudiante" WHERE cedula = $1 RETURNING *`, [cedula]);
    if (result.rowCount === 0) {
      return res.status(404).json({ mensaje: "Estudiante no encontrado." });
    }
    res.json({ mensaje: "Estudiante eliminado correctamente." });
  } catch (error) {
    if (error.code === '23503') {
      // Violación de llave foránea
      return res.status(409).json({ mensaje: "No se puede eliminar el estudiante porque está relacionado con otros registros." });
    }
    console.error("Error eliminando estudiante:", error.message);
    res.status(500).json({ mensaje: "No se pudo eliminar el estudiante. Intente nuevamente o contacte al administrador." });
  }
};

// Editar estudiante (incluyendo cédula)
export const editarEstudiante = async (req, res) => {
  try {
    const { cedula } = req.params; // cédula actual
    const {
      nueva_cedula,
      nombres,
      apellidos,
      nacionalidad,
      sexo,
      fecha_nacimiento,
      lugar_nacimiento,
      fk_documento
    } = req.body;

    // Validar campos obligatorios
    if (!nueva_cedula || !nombres || !apellidos || !nacionalidad || !sexo || !fecha_nacimiento || !lugar_nacimiento || !fk_documento) {
      return res.status(400).json({ mensaje: "Todos los campos son obligatorios." });
    }

    // Si la cédula cambia, actualiza también en Inscripcion y otras tablas relacionadas
    if (cedula !== nueva_cedula) {
      // Verifica que la nueva cédula no exista
      const existe = await pool.query(`SELECT 1 FROM "Estudiante" WHERE cedula = $1`, [nueva_cedula]);
      if (existe.rows.length > 0) {
        return res.status(409).json({ mensaje: "Ya existe un estudiante con esa cédula." });
      }
      // Actualiza en Inscripcion
      await pool.query(`UPDATE "Inscripcion" SET cedula_estudiante = $1 WHERE cedula_estudiante = $2`, [nueva_cedula, cedula]);
    }

    // Actualiza el estudiante
    const result = await pool.query(`
      UPDATE "Estudiante"
      SET cedula = $1, nombres = UPPER($2), apellidos = UPPER($3), nacionalidad = $4, sexo = $5, fecha_nacimiento = $6, lugar_nacimiento = UPPER($7), fk_documento = $8
      WHERE cedula = $9
      RETURNING *
    `, [nueva_cedula, nombres, apellidos, nacionalidad, sexo, fecha_nacimiento, lugar_nacimiento, fk_documento, cedula]);

    if (result.rowCount === 0) {
      return res.status(404).json({ mensaje: "Estudiante no encontrado." });
    }

    res.json({ mensaje: "Estudiante actualizado correctamente.", estudiante: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      // Duplicado de clave única
      return res.status(409).json({ mensaje: "Ya existe un estudiante con esa cédula." });
    }
    if (error.code === '23503') {
      // Violación de llave foránea
      return res.status(409).json({ mensaje: "No se puede actualizar el estudiante porque hay datos relacionados que lo impiden." });
    }
    console.error("Error editando estudiante:", error.message);
    res.status(500).json({ mensaje: "No se pudo editar el estudiante. Intente nuevamente o contacte al administrador." });
  }
};
////////////////////////////pdf


// ...código anterior...

function notaALetra(nota) {
  if (nota === '' || nota === null || nota === undefined) return '';
  const n = Number(nota);
  if (n === 20 || n === 19) return 'A';
  if (n >= 15 && n <=18) return 'B';
  if (n >= 11 && n <=14 ) return 'C';
  return 'D';
}
function definitivaLetra(l1, l2, l3) {
  if (!l1 || !l2 || !l3) return '';
  // Si las tres son iguales
  if (l1 === l2 && l2 === l3) return l1;

  // Orden de letras: A > B > C > D
  const orden = ['A', 'B', 'C', 'D'];
  const letras = [l1, l2, l3];

  // Casos especiales: BDB o BBD => C
  if (
    (l1 === 'B' && l2 === 'D' && l3 === 'B') ||
    (l1 === 'B' && l2 === 'B' && l3 === 'D') ||
    (l1 === 'D' && l2 === 'B' && l3 === 'B')
  ) {
    return 'C';
  }

  // Si hay dos iguales, devolver la más alta de esas dos
  for (const letra of orden) {
    if (letras.filter(l => l === letra).length === 2) return letra;
  }

  // Si las tres son diferentes, devolver la intermedia
  const presentes = letras.map(l => orden.indexOf(l)).sort((a, b) => a - b);
  let intermedia = orden[presentes[1]];

  

  return intermedia;
}

export const imprimirListadoNotasSeccion = async (req, res) => {
  try {
    const { id_seccion, id_año_escolar } = req.query;

    // 1. Traer datos de la sección, año y año escolar
    const seccionResult = await pool.query(`
      SELECT s.nombre AS nombre_seccion, a.nombre AS nombre_año, ae.nombre AS año_escolar
      FROM "Seccion" s
      JOIN "Año" a ON s.id_año = a.id_año
      JOIN "año_escolar" ae ON ae.id_año_escolar = $2
      WHERE s.id_seccion = $1
      LIMIT 1
    `, [id_seccion, id_año_escolar]);
    if (seccionResult.rows.length === 0) {
      return res.status(404).json({ mensaje: "Sección o año escolar no encontrada." });
    }
    const info = seccionResult.rows[0];

    // 2. Traer todos los estudiantes inscritos en esa sección y año escolar
    const estudiantesResult = await pool.query(`
      SELECT e.cedula, td.nombre AS tipo_documento, e.nombres, e.apellidos, i.id_inscripcion
      FROM "Inscripcion" i
      JOIN "Estudiante" e ON i.cedula_estudiante = e.cedula
      LEFT JOIN "tipo_documento" td ON e.fk_documento = td.id_documento
      WHERE i.id_seccion = $1 AND i.fk_año_escolar = $2
      ORDER BY e.apellidos, e.nombres
    `, [id_seccion, id_año_escolar]);
    const estudiantes = estudiantesResult.rows;

    if (estudiantes.length === 0) {
      return res.status(404).json({ mensaje: "No hay estudiantes inscritos en esta sección y año escolar." });
    }

    // 3. Traer todas las materias que ve esa sección en ese año escolar, con docente
    const materiasResult = await pool.query(`
      SELECT DISTINCT m.codigo_materia, m.nombre AS nombre_materia, am.id_año_materia,
        u.nombres AS nombre_docente, u.apellidos AS apellido_docente
      FROM "Año_Materia" am
      JOIN "Materia" m ON am.codigo_materia = m.codigo_materia
      JOIN "AsignacionDocente" ad ON ad.id_año_materia = am.id_año_materia
      LEFT JOIN "Docente" d ON ad.id_docente = d.id_docente
      LEFT JOIN "Usuario" u ON d.fk_cedula = u.cedula
      WHERE ad.id_seccion = $1 AND ad.fk_año_escolar = $2
      order by id_año_materia asc
    `, [id_seccion, id_año_escolar]);
    let materias = materiasResult.rows;

    // Identificar materias especiales por nombre (case-insensitive)
    const nombresEspeciales = [
      "orientacion",
      "convivencia y participacion en grupos de recreacion"
    ];
    const idsEspeciales = materias
      .filter(m =>
        nombresEspeciales.includes(m.nombre_materia.trim().toLowerCase())
      )
      .map(m => m.codigo_materia);

    // Si no las encuentra por nombre, toma las dos últimas
    let idsEspecialesFinal = idsEspeciales;
    if (idsEspeciales.length < 2 && materias.length >= 2) {
      idsEspecialesFinal = [
        materias[materias.length - 2].codigo_materia,
        materias[materias.length - 1].codigo_materia
      ];
    }

    // 4. Traer todas las notas de los estudiantes para esas materias
    const inscripcionIds = estudiantes.map(e => e.id_inscripcion);
    const añoMateriaIds = materias.map(m => m.id_año_materia);

    const notasResult = await pool.query(`
      SELECT mi.id_inscripcion, mi.id_año_materia, mi.nota_final,
        (SELECT nota FROM "Evaluacion" WHERE fk_materia_inscrita = mi.id_materia_inscrita AND fk_momento = 1 LIMIT 1) AS lapso1,
        (SELECT nota FROM "Evaluacion" WHERE fk_materia_inscrita = mi.id_materia_inscrita AND fk_momento = 2 LIMIT 1) AS lapso2,
        (SELECT nota FROM "Evaluacion" WHERE fk_materia_inscrita = mi.id_materia_inscrita AND fk_momento = 3 LIMIT 1) AS lapso3
      FROM "MateriaInscrita" mi
      WHERE mi.id_inscripcion = ANY($1) AND mi.id_año_materia = ANY($2)
    `, [inscripcionIds, añoMateriaIds]);
    const notas = notasResult.rows;

    // 5. Preparar estructura: cada estudiante, cada materia, sus notas
    const estudiantesConNotas = estudiantes.map(est => {
      const materiasNotas = materias.map(mat => {
        const nota = notas.find(n =>
          n.id_inscripcion === est.id_inscripcion && n.id_año_materia === mat.id_año_materia
        );
        // Si es materia especial, convertir a letra
        if (idsEspecialesFinal.includes(mat.codigo_materia)) {
          const l1 = notaALetra(nota?.lapso1 ?? '');
          const l2 = notaALetra(nota?.lapso2 ?? '');
          const l3 = notaALetra(nota?.lapso3 ?? '');
          return {
            ...mat,
            lapso1: l1,
            lapso2: l2,
            lapso3: l3,
            definitiva: definitivaLetra(l1, l2, l3)
          };
        } else {
          return {
            ...mat,
            lapso1: nota?.lapso1 ?? '',
            lapso2: nota?.lapso2 ?? '',
            lapso3: nota?.lapso3 ?? '',
            definitiva: nota?.nota_final ?? ''
          };
        }
      });
      return {
        ...est,
        materias: materiasNotas
      };
    });

    // --- Traer director una sola vez ---
    let director = { nombre: "MARIA DE JESUS", apellido: "BONILLA NIÑO", titulo: "MsC", cedula: "12630931", tipo_documento: "V" };
    if (id_año_escolar) {
      const directorResult = await pool.query(`
        SELECT d.nombre, d.apellido, d.titulo, d.cedula, td.nombre AS tipo_documento
        FROM directores_anios_escolares dae
        JOIN directores d ON dae.director_id = d.id
        LEFT JOIN tipo_documento td ON d.tipo_documento = td.id_documento
        WHERE dae.id_año_escolar = $1
          AND (dae.fecha_fin IS NULL OR dae.fecha_fin >= CURRENT_DATE)
        ORDER BY dae.fecha_inicio DESC
        LIMIT 1
      `, [id_año_escolar]);
      if (directorResult.rows.length > 0) {
        director = directorResult.rows[0];
      }
    }

    // --- PDF ---
    const doc = new PDFDocument({ size: [864, 1700], layout: 'landscape', margin: 30 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=notas_${info.nombre_año}_${info.nombre_seccion}_${info.año_escolar}.pdf`);
    doc.pipe(res);

    // --- LOGOS ---
    const logoIzqPath = path.join(__dirname, '../assets/cardenas.jpeg');
    const logoDerPath = path.join(__dirname, '../assets/purologo.png');
    if (fs.existsSync(logoIzqPath)) {
      doc.image(logoIzqPath, 50, 20, { width: 80 });
    }
    if (fs.existsSync(logoDerPath)) {
      doc.image(logoDerPath, doc.page.width - 110, 20, { width: 85 });
    }

    // --- Encabezado ---
    doc.fontSize(10).font('Helvetica-Bold').text(
      "República Bolivariana de Venezuela\nMinisterio del Poder Popular para la Educación",
      0, 25, { align: 'center', width: doc.page.width }
    );
    doc.moveDown(0.2);
    doc.fontSize(10).font('Helvetica-Bold').text(
      "Liceo Nacional Libertador",
      { align: 'center', width: doc.page.width }
    );
    doc.fontSize(9).font('Helvetica').text(
      "Cód. DEA: OD06002005   Cód. Adm.: 18 007933480",
      { align: 'center', width: doc.page.width }
    );
    doc.fontSize(9).font('Helvetica').text(
      "Palo Gordo, Municipio Cárdenas, Estado Táchira",
      { align: 'center', width: doc.page.width }
    );

    doc.moveDown(1.2);
    doc.fontSize(13).font('Helvetica-Bold').text(
      `Listado de Notas - ${info.nombre_año} "${info.nombre_seccion}" - Año Escolar ${info.año_escolar} - Lapso:_________`,
      { align: 'center', width: doc.page.width }
    );
    doc.moveDown(0.5);

    // --- Ajuste de columnas ---
    const notaWidth = 22;
    const defWidth = 26;
    const csWidth = 22; // ancho para c/s
    const fontSize = 6.5;
    const mpColWidth = 22; // ancho pequeño para MAT REP
    const headerCellHeight = 30;

    // Columnas fijas
    const colsFijas = [
      { key: 'contador', label: 'N°', width: 18 },
      { key: 'tipo_documento', label: 'TIPO', width: 22 },
      { key: 'cedula', label: 'CÉDULA', width: 45 },
      { key: 'nombres', label: 'NOMBRES', width: 83 },
      { key: 'apellidos', label: 'APELLIDOS', width: 88 }
    ];

    // Materias
    const colsMaterias = materias.map(mat => ({
      key: mat.codigo_materia,
      nombre_materia: mat.nombre_materia,
      nombre_docente: mat.nombre_docente,
      apellido_docente: mat.apellido_docente
    }));

    // Insertar columna "MAT REP" entre la última y la antepenúltima materia
    let mpIndex = colsMaterias.length - 2;
    if (mpIndex < 0) mpIndex = 0;
    const materiasCabecera = [
      ...colsMaterias.slice(0, mpIndex),
      { key: 'MAT REP', nombre_materia: 'MAT REP', nombre_docente: '', apellido_docente: '', width: mpColWidth },
      ...colsMaterias.slice(mpIndex)
    ];

    // --- Calcular ancho total de la tabla centrada ---
    const anchoMateria = notaWidth * 3 + csWidth + defWidth;
    const anchoTabla = colsFijas.reduce((sum, col) => sum + col.width, 0)
      + materiasCabecera.reduce((sum, mat) => sum + (mat.key === 'MAT REP' ? mpColWidth : anchoMateria), 0);
    const startX = (doc.page.width - anchoTabla) / 2;

    // --- Encabezado de docentes y materias ---
    let y = 140;
    let x = startX + colsFijas.reduce((sum, col) => sum + col.width, 0);
    materiasCabecera.forEach((mat) => {
      let width = mat.key === 'MAT REP' ? mpColWidth : anchoMateria;
      doc.rect(x, y, width, headerCellHeight).stroke();
      if (mat.key === 'MAT REP') {
        doc.font('Helvetica-Bold').fontSize(fontSize + 1).text(
          mat.nombre_materia,
          x, y + (headerCellHeight / 2) - 6,
          { width: width, align: 'center' }
        );
      } else {
        const primerNombre = (mat.nombre_docente || '').split(' ')[0].toUpperCase();
        const primerApellido = (mat.apellido_docente || '').split(' ')[0].toUpperCase();
        doc.font('Helvetica-Bold').fontSize(fontSize).text(
          `${primerNombre} ${primerApellido}`.trim(),
          x + 2, y + 2,
          { width: width - 4, align: 'center' }
        );
        doc.font('Helvetica-Bold').fontSize(fontSize).text(
          (mat.nombre_materia || ''),
          x + 2, y + headerCellHeight / 2,
          { width: width - 4, align: 'center' }
        );
      }
      x += width;
    });

    // --- Encabezado de tabla ---
    y += headerCellHeight;
    x = startX;
    doc.font('Helvetica-Bold').fontSize(fontSize);

    // Columnas de notas por materia (ahora con c/s)
    const colsNotas = materias.map(mat => [
      { key: `lapso1_${mat.codigo_materia}`, label: '1', width: notaWidth },
      { key: `lapso2_${mat.codigo_materia}`, label: '2', width: notaWidth },
      { key: `lapso3_${mat.codigo_materia}`, label: '3', width: notaWidth },
      { key: `cs_${mat.codigo_materia}`, label: 'c/s', width: csWidth }, // columna c/s
      { key: `definitiva_${mat.codigo_materia}`, label: 'Def', width: defWidth }
    ]).flat();

    // Insertar columna "MAT REP" en la posición correcta en las columnas de la tabla
    const mpColIndex = colsNotas.length - 10;
    const allCols = [
      ...colsFijas,
      ...colsNotas.slice(0, mpColIndex),
      { key: 'MAT REP', label: '', width: mpColWidth },
      ...colsNotas.slice(mpColIndex)
    ];

    allCols.forEach(col => {
      doc.rect(x, y, col.width, 18).stroke();
      doc.text(col.label, x + 2, y + 4, { width: col.width - 4, align: 'center' });
      x += col.width;
    });

    // --- Dibujar filas ---
    y += 18;
    doc.font('Helvetica').fontSize(fontSize);
    const rowHeight = 16;
    const firmaHeight = 60;

    estudiantesConNotas.forEach((est, idx) => {
      x = startX;
      allCols.forEach(col => {
        doc.rect(x, y, col.width, rowHeight).stroke();
        let valor = '';
        if (col.key === 'contador') valor = idx + 1;
        else if (col.key === 'tipo_documento') valor = est.tipo_documento;
        else if (col.key === 'cedula') valor = est.cedula;
        else if (col.key === 'nombres') valor = est.nombres.toUpperCase();
        else if (col.key === 'apellidos') valor = est.apellidos.toUpperCase();
        else if (col.key === 'MAT REP') valor = '';
        else if (col.key.startsWith('lapso1_') || col.key.startsWith('lapso2_') || col.key.startsWith('lapso3_') || col.key.startsWith('definitiva_')) {
          const codigo = col.key.split('_')[1];
          const m = est.materias.find(m => m.codigo_materia === codigo) || {};
          if (col.key.startsWith('lapso1_')) valor = m.lapso1 ?? '';
          if (col.key.startsWith('lapso2_')) valor = m.lapso2 ?? '';
          if (col.key.startsWith('lapso3_')) valor = m.lapso3 ?? '';
          if (col.key.startsWith('definitiva_')) valor = m.definitiva ?? '';
        } else if (col.key.startsWith('cs_')) {
          valor = ''; // columna c/s vacía
        }
        doc.text(valor, x + 2, y + 4, { width: col.width - 4, align: 'center' });
        x += col.width;
      });
      y += rowHeight;

      // Si la siguiente fila no cabe antes de la firma, salto de página
      if (y + rowHeight + firmaHeight > doc.page.height - 30 && idx < estudiantesConNotas.length - 1) {
        dibujarFirmaPie(doc, y, director, startX, anchoTabla);
        doc.addPage();
        y = 60;
        // Redibujar encabezados
        x = startX + colsFijas.reduce((sum, col) => sum + col.width, 0);
        materiasCabecera.forEach((mat) => {
          let width = mat.key === 'MAT REP' ? mpColWidth : anchoMateria;
          doc.rect(x, y, width, headerCellHeight).stroke();
          if (mat.key === 'MAT REP') {
            doc.font('Helvetica-Bold').fontSize(fontSize + 1).text(
              mat.nombre_materia,
              x, y + (headerCellHeight / 2) - 6,
              { width: width, align: 'center' }
            );
          } else {
            const primerNombre = (mat.nombre_docente || '').split(' ')[0].toUpperCase();
            const primerApellido = (mat.apellido_docente || '').split(' ')[0].toUpperCase();
            doc.font('Helvetica-Bold').fontSize(fontSize).text(
              `${primerNombre} ${primerApellido}`.trim(),
              x + 2, y + 2,
              { width: width - 4, align: 'center' }
            );
            doc.font('Helvetica-Bold').fontSize(fontSize).text(
              (mat.nombre_materia || ''),
              x + 2, y + headerCellHeight / 2,
              { width: width - 4, align: 'center' }
            );
          }
          x += width;
        });
        y += headerCellHeight;
        x = startX;
        doc.font('Helvetica-Bold').fontSize(fontSize);
        allCols.forEach(col => {
          doc.rect(x, y, col.width, 18).stroke();
          doc.text(col.label, x + 2, y + 4, { width: col.width - 4, align: 'center' });
          x += col.width;
        });
        y += 18;
        doc.font('Helvetica').fontSize(fontSize);
      }
    });

    // Firma justo después de la última fila (en la misma página si cabe, si no, en la siguiente)
    /*if (y + firmaHeight > doc.page.height - 30) {
      doc.addPage();
      y = 60;
    }
    dibujarFirmaPie(doc, y, director, startX, anchoTabla);*/

    doc.end();
  } catch (error) {
    console.error("Error generando listado de notas por sección:", error.message);
    if (!res.headersSent) {
      res.status(500).json({ mensaje: "Error generando PDF" });
    }
  }
};

function dibujarFirmaPie(doc, y, director, startX, anchoTabla) {
  const firmaY = y + 50;
  doc.moveTo(startX + anchoTabla / 2 - 80, firmaY).lineTo(startX + anchoTabla / 2 + 80, firmaY).stroke();
  doc.fontSize(10).font('Helvetica-Bold').text(
    `${director.titulo || ''} ${director.nombre || ''} ${director.apellido || ''}`,
    startX + anchoTabla / 2 - 120, firmaY + 8, { width: 240, align: 'center' }
  );
  doc.fontSize(10).font('Helvetica').text(
    `${director.tipo_documento || 'V'}-${director.cedula || ''}`,
    startX + anchoTabla / 2 - 120, firmaY + 22, { width: 240, align: 'center' }
  );
  doc.fontSize(10).font('Helvetica').text(
    "DIRECTOR(A)",
    startX + anchoTabla / 2 - 120, firmaY + 36, { width: 240, align: 'center' }
  );
}




export const obtenerAniosEscolaresFiltrado = async (req, res) => {
  try {
    const resultado = await pool.query(
      'SELECT id_año_escolar, nombre FROM "año_escolar" ORDER BY id_año_escolar DESC'
    );
    res.json({ listaAniosEscolares: resultado.rows || [] });
  } catch (error) {
    console.error("Error obteniendo años escolares:", error.message);
    res.status(500).json({ mensaje: "Error interno del servidor" });
  }
};

export const obtenerSeccionesPorAnio = async (req, res) => {
  try {
    const { id_año } = req.query;
    if (!id_año) {
      return res.status(400).json({ mensaje: "Debe enviar el id_año" });
    }
    const resultado = await pool.query(
      `SELECT s.id_seccion, s.nombre AS nombre_seccion, a.nombre AS nombre_año
       FROM "Seccion" s
       JOIN "Año" a ON s.id_año = a.id_año
       WHERE a.id_año = $1
       ORDER BY s.nombre ASC`,
      [id_año]
    );
    // Nombre compuesto: "Primero A", "Primero B", etc.
    const secciones = resultado.rows.map(s => ({
      ...s,
      nombre_completo: `${s.nombre_año} ${s.nombre_seccion}`
    }));
    res.json({ listaSecciones: secciones });
  } catch (error) {
    console.error("Error obteniendo secciones:", error.message);
    res.status(500).json({ mensaje: "Error interno del servidor" });
  }
};


//////




// Listar años escolares (para select)
export const adminNotasAniosEscolares = async (req, res) => {
  try {
    const result = await pool.query('SELECT id_año_escolar, nombre FROM "año_escolar" ORDER BY id_año_escolar DESC');
    res.json({ aniosEscolaresAdmin: result.rows });
  } catch (error) {
    res.status(500).json({ mensaje: "Error obteniendo años escolares" });
  }
};

// Listar años (grados) (para select)
export const adminNotasAnios = async (req, res) => {
  try {
    const result = await pool.query('SELECT id_año, nombre FROM "Año" ORDER BY id_año ASC');
    res.json({ aniosAdmin: result.rows });
  } catch (error) {
    res.status(500).json({ mensaje: "Error obteniendo años" });
  }
};

// Listar secciones por año (para select)
export const adminNotasSecciones = async (req, res) => {
  try {
    const { id_año } = req.query;
    if (!id_año) return res.status(400).json({ mensaje: "Falta id_año" });
    const result = await pool.query(
      `SELECT s.id_seccion, s.nombre AS nombre_seccion
       FROM "Seccion" s
       WHERE s.id_año = $1
       ORDER BY s.nombre ASC`, [id_año]
    );
    res.json({ seccionesAdmin: result.rows });
  } catch (error) {
    res.status(500).json({ mensaje: "Error obteniendo secciones" });
  }
};

// Listar materias por sección y año escolar (para select)
export const adminNotasMaterias = async (req, res) => {
  try {
    const { id_seccion, id_año_escolar } = req.query;
    if (!id_seccion || !id_año_escolar) return res.status(400).json({ mensaje: "Faltan datos" });
    const result = await pool.query(`
      SELECT DISTINCT m.codigo_materia, m.nombre AS nombre_materia, am.id_año_materia
      FROM "Año_Materia" am
      JOIN "Materia" m ON am.codigo_materia = m.codigo_materia
      JOIN "AsignacionDocente" ad ON ad.id_año_materia = am.id_año_materia
      WHERE ad.id_seccion = $1 AND ad.fk_año_escolar = $2
      ORDER BY m.nombre
    `, [id_seccion, id_año_escolar]);
    res.json({ materiasAdmin: result.rows });
  } catch (error) {
    res.status(500).json({ mensaje: "Error obteniendo materias" });
  }
};

// Listar estudiantes y notas de una materia específica (incluye nota de reparación)
export const adminNotasEstudiantesMateria = async (req, res) => {
  try {
    const { id_seccion, id_año_escolar, id_año_materia } = req.query;
    if (!id_seccion || !id_año_escolar || !id_año_materia) return res.status(400).json({ mensaje: "Faltan datos" });

    // Estudiantes inscritos en la sección y año escolar
    const estudiantesResult = await pool.query(`
      SELECT e.cedula, e.nombres, e.apellidos, i.id_inscripcion
      FROM "Inscripcion" i
      JOIN "Estudiante" e ON i.cedula_estudiante = e.cedula
      WHERE i.id_seccion = $1 AND i.fk_año_escolar = $2
      ORDER BY e.apellidos, e.nombres
    `, [id_seccion, id_año_escolar]);
    const estudiantes = estudiantesResult.rows;

    // Notas de la materia seleccionada (incluye rep)
    const inscripcionIds = estudiantes.map(e => e.id_inscripcion);
    let notas = [];
    if (inscripcionIds.length > 0) {
      const notasResult = await pool.query(`
        SELECT mi.id_inscripcion, mi.nota_final,
          (SELECT nota FROM "Evaluacion" WHERE fk_materia_inscrita = mi.id_materia_inscrita AND fk_momento = 1 LIMIT 1) AS lapso1,
          (SELECT nota FROM "Evaluacion" WHERE fk_materia_inscrita = mi.id_materia_inscrita AND fk_momento = 2 LIMIT 1) AS lapso2,
          (SELECT nota FROM "Evaluacion" WHERE fk_materia_inscrita = mi.id_materia_inscrita AND fk_momento = 3 LIMIT 1) AS lapso3,
          (SELECT rep FROM "Evaluacion" WHERE fk_materia_inscrita = mi.id_materia_inscrita AND fk_momento = 4 LIMIT 1) AS rep,
          mi.id_materia_inscrita
        FROM "MateriaInscrita" mi
        WHERE mi.id_inscripcion = ANY($1) AND mi.id_año_materia = $2
      `, [inscripcionIds, id_año_materia]);
      notas = notasResult.rows;
    }

    // Unir estudiantes y notas
    const estudiantesNotas = estudiantes.map(est => {
      const nota = notas.find(n => n.id_inscripcion === est.id_inscripcion) || {};
      return {
        ...est,
        lapso1: nota.lapso1 ?? '',
        lapso2: nota.lapso2 ?? '',
        lapso3: nota.lapso3 ?? '',
        rep: nota.rep ?? '',
        definitiva: nota.nota_final ?? '',
        id_materia_inscrita: nota.id_materia_inscrita ?? null
      };
    });

    res.json({ estudiantesNotasAdmin: estudiantesNotas });
  } catch (error) {
    res.status(500).json({ mensaje: "Error obteniendo notas" });
  }
};

// Editar nota de un estudiante (lapso 1, 2, 3 o rep)
export const adminNotasEditar = async (req, res) => {
  try {
    const { id_materia_inscrita, lapso, nueva_nota, rep } = req.body;
    if (!id_materia_inscrita || !lapso || (typeof nueva_nota === 'undefined' && typeof rep === 'undefined')) {
      return res.status(400).json({ mensaje: "Faltan datos" });
    }

    // Si es lapso 4, se edita rep, si no, nota
    if (parseInt(lapso) === 4) {
      // Buscar si ya existe la evaluación de reparación
      const evalResult = await pool.query(`
        SELECT * FROM "Evaluacion"
        WHERE fk_materia_inscrita = $1 AND fk_momento = 4
      `, [id_materia_inscrita]);
      if (evalResult.rows.length > 0) {
        await pool.query(`
          UPDATE "Evaluacion" SET rep = $1 WHERE fk_materia_inscrita = $2 AND fk_momento = 4
        `, [rep, id_materia_inscrita]);
      } else {
        await pool.query(`
          INSERT INTO "Evaluacion" (fk_materia_inscrita, fk_momento, rep)
          VALUES ($1, 4, $2)
        `, [id_materia_inscrita, rep]);
      }
    } else {
      // Buscar si ya existe la evaluación del lapso
      const evalResult = await pool.query(`
        SELECT * FROM "Evaluacion"
        WHERE fk_materia_inscrita = $1 AND fk_momento = $2
      `, [id_materia_inscrita, lapso]);
      if (evalResult.rows.length > 0) {
        await pool.query(`
          UPDATE "Evaluacion" SET nota = $1 WHERE fk_materia_inscrita = $2 AND fk_momento = $3
        `, [nueva_nota, id_materia_inscrita, lapso]);
      } else {
        await pool.query(`
          INSERT INTO "Evaluacion" (fk_materia_inscrita, fk_momento, nota)
          VALUES ($1, $2, $3)
        `, [id_materia_inscrita, lapso, nueva_nota]);
      }
    }

    // Recalcular definitiva y estado
    const lapsos = await pool.query(`
      SELECT nota FROM "Evaluacion"
      WHERE fk_materia_inscrita = $1 AND fk_momento IN (1,2,3)
      ORDER BY fk_momento ASC
    `, [id_materia_inscrita]);
    const notasValidas = lapsos.rows.map(ev => Number(ev.nota)).filter(n => !isNaN(n));

    // Traer la nota de reparación (solo momento 4)
    const repResult = await pool.query(
      `SELECT rep FROM "Evaluacion" WHERE fk_materia_inscrita = $1 AND fk_momento = 4 LIMIT 1`,
      [id_materia_inscrita]
    );
    const notaRep = repResult.rows.length > 0 ? Number(repResult.rows[0].rep) : null;

    let definitiva = null;
    let estado = null;
    if (notasValidas.length === 3) {
      const promedio = notasValidas.reduce((a, b) => a + b, 0) / 3;
      definitiva = Math.round(promedio);
      if (definitiva >= 10) {
        estado = 'aprobada';
      } else if (notaRep !== null && !isNaN(notaRep)) {
        estado = notaRep >= 10 ? 'aprobada' : 'reprobada';
      } else {
        estado = 'reprobada';
      }
    } else if (notaRep !== null && !isNaN(notaRep)) {
      definitiva = null;
      estado = notaRep >= 10 ? 'aprobada' : 'reprobada';
    } else {
      definitiva = null;
      estado = null;
    }

    await pool.query(`
      UPDATE "MateriaInscrita" SET estado = $1, nota_final = $2 WHERE id_materia_inscrita = $3
    `, [estado, definitiva, id_materia_inscrita]);

    res.json({ mensaje: "Nota actualizada correctamente" });
  } catch (error) {
    res.status(500).json({ mensaje: "Error actualizando nota" });
  }
};





// Listar años escolares
export const listarAniosEscolaresAdmin = async (req, res) => {
  try {
    const result = await pool.query('SELECT id_año_escolar, nombre FROM "año_escolar" ORDER BY id_año_escolar DESC');
    res.json({ aniosEscolaresAdmin: result.rows });
  } catch (error) {
    res.status(500).json({ mensaje: "Error listando años escolares" });
  }
};

// Editar año escolar
export const editarAnioEscolarAdmin = async (req, res) => {
  try {
    const { id_año_escolar } = req.params;
    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ mensaje: "El nombre es obligatorio" });

    const result = await pool.query(
      'UPDATE "año_escolar" SET nombre = $1 WHERE id_año_escolar = $2 RETURNING *',
      [nombre, id_año_escolar]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ mensaje: "Año escolar no encontrado" });
    }
    res.json({ mensaje: "Año escolar actualizado correctamente", anioEscolar: result.rows[0] });
  } catch (error) {
    res.status(500).json({ mensaje: "Error editando año escolar" });
  }
};

// Eliminar año escolar
export const eliminarAnioEscolarAdmin = async (req, res) => {
  try {
    const { id_año_escolar } = req.params;
    const result = await pool.query(
      'DELETE FROM "año_escolar" WHERE id_año_escolar = $1 RETURNING *',
      [id_año_escolar]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ mensaje: "Año escolar no encontrado" });
    }
    res.json({ mensaje: "Año escolar eliminado correctamente" });
  } catch (error) {
    if (error.code === '23503') {
      return res.status(409).json({ mensaje: "No se puede eliminar: año escolar relacionado con otros registros." });
    }
    res.status(500).json({ mensaje: "Error eliminando año escolar" });
  }
};


// Listar directores con año escolar
export const listarDirectoresconaño = async (req, res) => {
  try {
    const { search } = req.query;
    let query = `
      SELECT d.id, d.nombre, d.apellido, d.cedula, d.email, d.telefono, d.titulo, d.activo,
             td.nombre AS tipo_documento,
             ae.nombre AS año_escolar
      FROM directores d
      LEFT JOIN tipo_documento td ON d.tipo_documento = td.id_documento
      LEFT JOIN directores_anios_escolares dae ON dae.director_id = d.id AND (dae.fecha_fin IS NULL OR dae.fecha_fin >= CURRENT_DATE)
      LEFT JOIN "año_escolar" ae ON dae.id_año_escolar = ae.id_año_escolar
    `;
    const params = [];
    if (search) {
      query += ` WHERE 
        LOWER(d.nombre) LIKE $1 OR
        LOWER(d.apellido) LIKE $1 OR
        d.cedula LIKE $1 OR
        LOWER(ae.nombre) LIKE $1
      `;
      params.push(`%${search.toLowerCase()}%`);
    }
    query += " ORDER BY d.apellido, d.nombre";
    const result = await pool.query(query, params);
    res.json({ directores: result.rows });
  } catch (error) {
    res.status(500).json({ mensaje: "Error listando directores" });
  }
};

// Editar director
export const editarDirector = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, apellido, cedula, email, telefono, titulo, activo } = req.body;
    const result = await pool.query(
      `UPDATE directores SET
        nombre = $1, apellido = $2, cedula = $3,
        email = $4, telefono = $5, titulo = $6, activo = $7
      WHERE id = $8 RETURNING *`,
      [nombre, apellido, cedula, email, telefono, titulo, activo, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ mensaje: "Director no encontrado" });
    }
    res.json({ mensaje: "Director actualizado", director: result.rows[0] });
  } catch (error) {
    console.error("Error editando director:", error); // <-- Agrega esto
    res.status(500).json({ mensaje: "Error editando director" });
  }
};

// Eliminar director (en cascada)
export const eliminarDirector = async (req, res) => {
  try {
    const { id } = req.params;
    // Elimina en cascada por FK ON DELETE CASCADE en la tabla intermedia
    const result = await pool.query('DELETE FROM directores WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ mensaje: "Director no encontrado" });
    }
    res.json({ mensaje: "Director eliminado" });
  } catch (error) {
    res.status(500).json({ mensaje: "Error eliminando director" });
  }
};




import ExcelJS from "exceljs";






export const exportarListadoNotasSeccionExcel = async (req, res) => {
  try {
    const { id_seccion, id_año_escolar } = req.query;

    // 1. Traer datos de la sección, año y año escolar
    const seccionResult = await pool.query(`
      SELECT s.nombre AS nombre_seccion, a.nombre AS nombre_año, ae.nombre AS año_escolar
      FROM "Seccion" s
      JOIN "Año" a ON s.id_año = a.id_año
      JOIN "año_escolar" ae ON ae.id_año_escolar = $2
      WHERE s.id_seccion = $1
      LIMIT 1
    `, [id_seccion, id_año_escolar]);
    if (seccionResult.rows.length === 0) {
      return res.status(404).json({ mensaje: "Sección o año escolar no encontrada." });
    }
    const info = seccionResult.rows[0];

    // 2. Traer todos los estudiantes inscritos en esa sección y año escolar
    const estudiantesResult = await pool.query(`
      SELECT e.cedula, td.nombre AS tipo_documento, e.nombres, e.apellidos, i.id_inscripcion
      FROM "Inscripcion" i
      JOIN "Estudiante" e ON i.cedula_estudiante = e.cedula
      LEFT JOIN "tipo_documento" td ON e.fk_documento = td.id_documento
      WHERE i.id_seccion = $1 AND i.fk_año_escolar = $2
      ORDER BY e.apellidos, e.nombres
    `, [id_seccion, id_año_escolar]);
    const estudiantes = estudiantesResult.rows;

    if (estudiantes.length === 0) {
      return res.status(404).json({ mensaje: "No hay estudiantes inscritos en esta sección y año escolar." });
    }

    // 3. Traer todas las materias que ve esa sección en ese año escolar, con docente
    const materiasResult = await pool.query(`
      SELECT DISTINCT m.codigo_materia, m.nombre AS nombre_materia, am.id_año_materia,
        u.nombres AS nombre_docente, u.apellidos AS apellido_docente
      FROM "Año_Materia" am
      JOIN "Materia" m ON am.codigo_materia = m.codigo_materia
      JOIN "AsignacionDocente" ad ON ad.id_año_materia = am.id_año_materia
      LEFT JOIN "Docente" d ON ad.id_docente = d.id_docente
      LEFT JOIN "Usuario" u ON d.fk_cedula = u.cedula
      WHERE ad.id_seccion = $1 AND ad.fk_año_escolar = $2
      ORDER BY am.id_año_materia asc
    `, [id_seccion, id_año_escolar]);
    let materias = materiasResult.rows;

    // Identificar materias especiales por nombre (case-insensitive)
    const nombresEspeciales = [
      "orientacion",
      "convivencia y participacion en grupos de recreacion"
    ];
    const idsEspeciales = materias
      .filter(m =>
        nombresEspeciales.includes(m.nombre_materia.trim().toLowerCase())
      )
      .map(m => m.codigo_materia);

    // Si no las encuentra por nombre, toma las dos últimas
    let idsEspecialesFinal = idsEspeciales;
    if (idsEspeciales.length < 2 && materias.length >= 2) {
      idsEspecialesFinal = [
        materias[materias.length - 2].codigo_materia,
        materias[materias.length - 1].codigo_materia
      ];
    }

    // 4. Traer todas las notas de los estudiantes para esas materias
    const inscripcionIds = estudiantes.map(e => e.id_inscripcion);
    const añoMateriaIds = materias.map(m => m.id_año_materia);

    const notasResult = await pool.query(`
      SELECT mi.id_inscripcion, mi.id_año_materia, mi.nota_final,
        (SELECT nota FROM "Evaluacion" WHERE fk_materia_inscrita = mi.id_materia_inscrita AND fk_momento = 1 LIMIT 1) AS lapso1,
        (SELECT nota FROM "Evaluacion" WHERE fk_materia_inscrita = mi.id_materia_inscrita AND fk_momento = 2 LIMIT 1) AS lapso2,
        (SELECT nota FROM "Evaluacion" WHERE fk_materia_inscrita = mi.id_materia_inscrita AND fk_momento = 3 LIMIT 1) AS lapso3
      FROM "MateriaInscrita" mi
      WHERE mi.id_inscripcion = ANY($1) AND mi.id_año_materia = ANY($2)
    `, [inscripcionIds, añoMateriaIds]);
    const notas = notasResult.rows;

    // 5. Preparar estructura: cada estudiante, cada materia, sus notas
    const estudiantesConNotas = estudiantes.map(est => {
      const materiasNotas = materias.map(mat => {
        const nota = notas.find(n =>
          n.id_inscripcion === est.id_inscripcion && n.id_año_materia === mat.id_año_materia
        );
        // Si es materia especial, convertir a letra
        if (idsEspecialesFinal.includes(mat.codigo_materia)) {
          const l1 = notaALetra(nota?.lapso1 ?? '');
          const l2 = notaALetra(nota?.lapso2 ?? '');
          const l3 = notaALetra(nota?.lapso3 ?? '');
          return {
            ...mat,
            lapso1: l1,
            lapso2: l2,
            lapso3: l3,
            definitiva: definitivaLetra(l1, l2, l3)
          };
        } else {
          return {
            ...mat,
            lapso1: nota?.lapso1 ?? '',
            lapso2: nota?.lapso2 ?? '',
            lapso3: nota?.lapso3 ?? '',
            definitiva: nota?.nota_final ?? ''
          };
        }
      });
      return {
        ...est,
        materias: materiasNotas
      };
    });

    // --- Traer director una sola vez ---
    let director = { nombre: "MARIA DE JESUS", apellido: "BONILLA NIÑO", titulo: "MsC", cedula: "12630931", tipo_documento: "V" };
    if (id_año_escolar) {
      const directorResult = await pool.query(`
        SELECT d.nombre, d.apellido, d.titulo, d.cedula, td.nombre AS tipo_documento
        FROM directores_anios_escolares dae
        JOIN directores d ON dae.director_id = d.id
        LEFT JOIN tipo_documento td ON d.tipo_documento = td.id_documento
        WHERE dae.id_año_escolar = $1
          AND (dae.fecha_fin IS NULL OR dae.fecha_fin >= CURRENT_DATE)
        ORDER BY dae.fecha_inicio DESC
        LIMIT 1
      `, [id_año_escolar]);
      if (directorResult.rows.length > 0) {
        director = directorResult.rows[0];
      }
    }

    // --- Columnas fijas y por materia ---
    const colsFijas = [
      { key: 'contador', label: 'N°', width: 5 },
      { key: 'tipo_documento', label: 'TIPO', width: 8 },
      { key: 'cedula', label: 'CÉDULA', width: 12 },
      { key: 'nombres', label: 'NOMBRES', width: 25 },
      { key: 'apellidos', label: 'APELLIDOS', width: 25 }
    ];
    const materiasCount = materias.length;
    const colsMaterias = materias.flatMap(mat => [
      { key: `lapso1_${mat.codigo_materia}`, label: 'L1', width: 6 },
      { key: `lapso2_${mat.codigo_materia}`, label: 'L2', width: 6 },
      { key: `lapso3_${mat.codigo_materia}`, label: 'L3', width: 6 },
      { key: `extra_${mat.codigo_materia}`, label: 'c/s', width: 4 },
      { key: `definitiva_${mat.codigo_materia}`, label: 'Def', width: 7 }
    ]);
    // Índice donde insertar la columna vacía (antes de las dos últimas materias)
    const insertIdx = materiasCount > 2
      ? colsFijas.length + (materiasCount - 2) * 5
      : colsFijas.length;
    const allCols = [
      ...colsFijas,
      ...colsMaterias.slice(0, insertIdx - colsFijas.length),
      { key: 'columna_vacia', label: '', width: 6 }, // columna vacía
      ...colsMaterias.slice(insertIdx - colsFijas.length)
    ];
    const totalCols = allCols.length;

    // --- Crear el archivo Excel ---
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Notas');

    // --- Membrete y título centrados (antes de definir columnas) ---
    sheet.addRow([]);
    sheet.addRow(["República Bolivariana de Venezuela"]);
    sheet.addRow(["Ministerio del Poder Popular para la Educación"]);
    sheet.addRow(["Liceo Nacional Libertador"]);
    sheet.addRow(["Cód. DEA: OD06002005   Cód. Adm.: 18 007933480   Palo Gordo, Municipio Cárdenas, Estado Táchira"]);
    sheet.addRow([`Listado de Notas - ${info.nombre_año} "${info.nombre_seccion}" - Año Escolar ${info.año_escolar} - Lapso: `]);
    for (let i = 2; i <= 6; i++) {
      sheet.mergeCells(i, 1, i, totalCols);
      sheet.getRow(i).alignment = { horizontal: 'center' };
      sheet.getRow(i).font = { bold: true, size: i === 6 ? 13 : 11 };
    }

    // --- Fila de nombres de docentes (agrupados por materia) ---
    let filaDocentes = [];
    for (let i = 0; i < colsFijas.length; i++) filaDocentes.push("");
    materias.forEach((mat, idx) => {
      if (idx === materiasCount - 2) filaDocentes.push(""); // columna vacía
      filaDocentes.push(
        ...Array(5).fill(`${(mat.nombre_docente || '').split(' ')[0].toUpperCase()} ${(mat.apellido_docente || '').split(' ')[0].toUpperCase()}`)
      );
    });
    sheet.addRow(filaDocentes);
    // Merge por materia
    let colIdx = colsFijas.length + 1;
    materias.forEach((_, idx) => {
      if (idx === materiasCount - 2) colIdx++; // saltar columna vacía
      sheet.mergeCells(sheet.lastRow.number, colIdx, sheet.lastRow.number, colIdx + 4);
      colIdx += 5;
    });

    // --- Fila de nombres de materias (agrupados por materia) ---
    let filaMaterias = [];
    for (let i = 0; i < colsFijas.length; i++) filaMaterias.push("");
    materias.forEach((mat, idx) => {
      if (idx === materiasCount - 2) filaMaterias.push("MAT REP"); // columna vacía
      filaMaterias.push(...Array(5).fill(mat.nombre_materia.toUpperCase()));
    });
    sheet.addRow(filaMaterias);
    // Merge por materia
    colIdx = colsFijas.length + 1;
    materias.forEach((_, idx) => {
      if (idx === materiasCount - 2) colIdx++; // saltar columna vacía
      sheet.mergeCells(sheet.lastRow.number, colIdx, sheet.lastRow.number, colIdx + 4);
      colIdx += 5;
    });
    // Ajusta la altura y el formato de la fila de materias
    const rowMaterias = sheet.getRow(sheet.lastRow.number);
    rowMaterias.height = 30;
    rowMaterias.font = { bold: true, size: 9 };
    rowMaterias.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

    // --- Fila de subcolumnas (L1, L2, L3, c/s, Def) + columna vacía ---
    const filaSub = [];
    colsFijas.forEach(col => filaSub.push(col.label));
    materias.forEach((_, idx) => {
      if (idx === materiasCount - 2) filaSub.push(''); // header vacía
      filaSub.push('1', '2', '3', 'c/s', 'Def');
    });
    sheet.addRow(filaSub);
    sheet.getRow(sheet.lastRow.number).font = { bold: true };
    sheet.getRow(sheet.lastRow.number).alignment = { horizontal: 'center', vertical: 'middle' };

    // --- Ahora sí, define las columnas (solo para ancho y formato, no headers automáticos) ---
    sheet.columns = allCols.map(col => ({ key: col.key, width: col.width }));

    // --- Filas de estudiantes ---
    estudiantesConNotas.forEach((est, idx) => {
      const materiasNotas = est.materias.flatMap((m, i) => {
        // Si es materia especial, ya viene en letras
        if (idsEspecialesFinal.includes(m.codigo_materia)) {
          if (i === materiasCount - 2) return ['', m.lapso1, m.lapso2, m.lapso3, '', m.definitiva];
          return [m.lapso1, m.lapso2, m.lapso3, '', m.definitiva];
        } else {
          if (i === materiasCount - 2) return ['', m.lapso1, m.lapso2, m.lapso3, '', m.definitiva];
          return [m.lapso1, m.lapso2, m.lapso3, '', m.definitiva];
        }
      });
      const fila = [
        idx + 1,
        est.tipo_documento,
        est.cedula,
        est.nombres.toUpperCase(),
        est.apellidos.toUpperCase(),
        ...materiasNotas
      ];
      sheet.addRow(fila);
    });

    // --- Ajustar alineación y bordes ---
    sheet.eachRow((row, rowNumber) => {
      row.eachCell(cell => {
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
      if (rowNumber <= 9) row.font = { bold: true };
    });

    // --- Pie de firma perfectamente centrado ---
    /*let firmaRow = sheet.lastRow.number + 4;
    sheet.addRow([]);
    sheet.mergeCells(firmaRow, 1, firmaRow, totalCols);
    sheet.getCell(firmaRow, 1).value = `${director.titulo || ''} ${director.nombre || ''} ${director.apellido || ''}`;
    sheet.getCell(firmaRow, 1).alignment = { horizontal: 'center' };
    sheet.getCell(firmaRow, 1).font = { bold: true };

    sheet.addRow([]);
    sheet.mergeCells(firmaRow + 1, 1, firmaRow + 1, totalCols);
    sheet.getCell(firmaRow + 1, 1).value = `${director.tipo_documento || 'V'}-${director.cedula || ''}`;
    sheet.getCell(firmaRow + 1, 1).alignment = { horizontal: 'center' };

    sheet.addRow([]);
    sheet.mergeCells(firmaRow + 2, 1, firmaRow + 2, totalCols);
    sheet.getCell(firmaRow + 2, 1).value = "DIRECTOR(A)";
    sheet.getCell(firmaRow + 2, 1).alignment = { horizontal: 'center' };*/

    // --- Enviar el archivo Excel ---
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=notas_${info.nombre_año}_${info.nombre_seccion}_${info.año_escolar}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error generando Excel de notas por sección:", error.message);
    if (!res.headersSent) {
      res.status(500).json({ mensaje: "Error generando Excel" });
    }
  }
};

// Ejemplo en Express
export const getCortes = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM "cortes" ORDER BY id_corte');
    res.json({ cortes: result.rows });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al obtener cortes" });
  }
};

export const crearCorte = async (req, res) => {
  try {
    const { nombre, fecha_inicio, fecha_fin } = req.body;
    if (!nombre || !fecha_inicio || !fecha_fin) {
      return res.status(400).json({ mensaje: "Todos los campos son obligatorios" });
    }
    await pool.query(
      `INSERT INTO "cortes" (nombre, fecha_inicio, fecha_fin) VALUES ($1, $2, $3)`,
      [nombre, fecha_inicio, fecha_fin]
    );
    res.json({ mensaje: "Corte creado correctamente" });
  } catch (error) {
    res.status(500).json({ mensaje: "Error interno del servidor" });
  }
};

export const listarCortes = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM "cortes" ORDER BY id_corte');
    res.json({ cortes: result.rows });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al obtener cortes" });
  }
};

export const editarCorte = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, fecha_inicio, fecha_fin } = req.body;
    await pool.query(
      `UPDATE "cortes" SET nombre = $1, fecha_inicio = $2, fecha_fin = $3 WHERE id_corte = $4`,
      [nombre, fecha_inicio, fecha_fin, id]
    );
    res.json({ mensaje: "Corte actualizado correctamente" });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al actualizar corte" });
  }
};

export const eliminarCorte = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(`DELETE FROM "cortes" WHERE id_corte = $1`, [id]);
    res.json({ mensaje: "Corte eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al eliminar corte" });
  }
};

export const generarBoletinEstudiante = async (req, res) => {
  try {
    const cedula = req.params.cedula;

    // 1. Obtener inscripción más reciente (sin docente guía aquí)
    const inscripcionResult = await pool.query(`
      SELECT 
        i.id_inscripcion,
        s.nombre AS seccion,
        a.nombre AS año,
        ae.nombre AS año_escolar
      FROM "Inscripcion" i
      JOIN "Seccion" s ON s.id_seccion = i.id_seccion
      JOIN "Año" a ON s.id_año = a.id_año
      JOIN "año_escolar" ae ON i.fk_año_escolar = ae.id_año_escolar
      WHERE i.cedula_estudiante = $1
      ORDER BY i.fk_año_escolar DESC, i.id_inscripcion DESC
      LIMIT 1;
    `, [cedula]);

    if (inscripcionResult.rows.length === 0) {
      return res.status(404).json({ mensaje: "Estudiante no encontrado o no inscrito." });
    }

    const inscripcion = inscripcionResult.rows[0];

    // 2. Datos del estudiante
    const estudianteResult = await pool.query(`
      SELECT nombres, apellidos FROM "Estudiante" WHERE cedula = $1
    `, [cedula]);
    const estudiante = estudianteResult.rows[0];

    // 2.1. Buscar docente guía (solo el de "orientación y convivencia")
    const docenteGuiaResult = await pool.query(`
      SELECT u.nombres AS docente_nombre, u.apellidos AS docente_apellido
      FROM "MateriaInscrita" mi
      JOIN "Año_Materia" am ON am.id_año_materia = mi.id_año_materia
      JOIN "Materia" m ON m.codigo_materia = am.codigo_materia
      JOIN "Inscripcion" i ON mi.id_inscripcion = i.id_inscripcion
      JOIN "AsignacionDocente" ad ON ad.id_año_materia = am.id_año_materia AND ad.id_seccion = i.id_seccion AND ad.fk_año_escolar = i.fk_año_escolar
      JOIN "Docente" d ON d.id_docente = ad.id_docente
      JOIN "Usuario" u ON u.cedula = d.fk_cedula
      WHERE mi.id_inscripcion = $1
        AND m.nombre ILIKE '%Orientación y Convivencia%'
      LIMIT 1
    `, [inscripcion.id_inscripcion]);
    const docenteGuia = docenteGuiaResult.rows[0] || { docente_nombre: '', docente_apellido: '' };

    // 3. Materias y notas por momento (INJUSTIF y JUSTIF vacíos)
    const materiasResult = await pool.query(`
      SELECT 
        m.nombre AS nombre_materia, 
        mi.nota_final,
        mi.id_materia_inscrita,
        (SELECT nota FROM "Evaluacion" ev WHERE ev.fk_materia_inscrita = mi.id_materia_inscrita AND ev.fk_momento = 1 LIMIT 1) AS momento1,
        (SELECT nota FROM "Evaluacion" ev WHERE ev.fk_materia_inscrita = mi.id_materia_inscrita AND ev.fk_momento = 2 LIMIT 1) AS momento2,
        (SELECT nota FROM "Evaluacion" ev WHERE ev.fk_materia_inscrita = mi.id_materia_inscrita AND ev.fk_momento = 3 LIMIT 1) AS momento3
      FROM "MateriaInscrita" mi
      JOIN "Año_Materia" am ON am.id_año_materia = mi.id_año_materia
      JOIN "Materia" m ON m.codigo_materia = am.codigo_materia
      WHERE mi.id_inscripcion = $1
      ORDER BY m.nombre ASC;
    `, [inscripcion.id_inscripcion]);

    // Traer las notas de reparación (rep) para cada materia inscrita
    const idsMateriasInscritas = materiasResult.rows.map(m => m.id_materia_inscrita);
    let reps = [];
    if (idsMateriasInscritas.length > 0) {
      const repsResult = await pool.query(`
        SELECT fk_materia_inscrita, rep
        FROM "Evaluacion"
        WHERE fk_materia_inscrita = ANY($1) AND fk_momento = 4
      `, [idsMateriasInscritas]);
      reps = repsResult.rows;
    }

    // Mostrar en letra si es Orientación y Convivencia
    const materias = materiasResult.rows.map(m => {
      const nombreMateria = (m.nombre_materia || '').trim().toLowerCase();
      // Buscar rep para esta materia
      const repObj = reps.find(r => r.fk_materia_inscrita === m.id_materia_inscrita);
      const repNota = repObj ? repObj.rep : '';

      if (
        nombreMateria === 'orientación y convivencia' ||
        nombreMateria === 'participación en grupos de recreación'
      ) {
        return {
          ...m,
          momento1: notaALetra(m.momento1),
          momento2: notaALetra(m.momento2),
          momento3: notaALetra(m.momento3),
          nota_final: definitivaLetra(
            notaALetra(m.momento1),
            notaALetra(m.momento2),
            notaALetra(m.momento3)
          ),
          rep: repNota,
          injustif1: '', justif1: '',
          injustif2: '', justif2: '',
          injustif3: '', justif3: ''
        };
      }
      // Para materias numéricas, la definitiva es la suma de los tres momentos (si existen)
      let sumaFinal = '';
      if (
        m.momento1 !== null && m.momento1 !== undefined && m.momento1 !== '' &&
        m.momento2 !== null && m.momento2 !== undefined && m.momento2 !== '' &&
        m.momento3 !== null && m.momento3 !== undefined && m.momento3 !== ''
      ) {
        sumaFinal = (
          Number(m.momento1) +
          Number(m.momento2) +
          Number(m.momento3)
        ).toString();
      }
      return {
        ...m,
        suma_final: sumaFinal,
        rep: repNota,
        injustif1: '', justif1: '',
        injustif2: '', justif2: '',
        injustif3: '', justif3: ''
      };
    });

    // 4. Materias pendientes (máximo 2 registros)
    const pendientesResult = await pool.query(`
      SELECT m.nombre AS nombre_materia,
        (SELECT nota FROM "Evaluacion" ev WHERE ev.fk_materia_inscrita = mi.id_materia_inscrita AND ev.fk_momento = 1 LIMIT 1) AS momento1,
        (SELECT nota FROM "Evaluacion" ev WHERE ev.fk_materia_inscrita = mi.id_materia_inscrita AND ev.fk_momento = 2 LIMIT 1) AS momento2,
        (SELECT nota FROM "Evaluacion" ev WHERE ev.fk_materia_inscrita = mi.id_materia_inscrita AND ev.fk_momento = 3 LIMIT 1) AS momento3
      FROM "MateriaInscrita" mi
      JOIN "Año_Materia" am ON am.id_año_materia = mi.id_año_materia
      JOIN "Materia" m ON m.codigo_materia = am.codigo_materia
      JOIN "Inscripcion" i ON mi.id_inscripcion = i.id_inscripcion
      WHERE i.cedula_estudiante = $1 AND mi.estado = 'reprobada'
        AND i.id_inscripcion != $2
      LIMIT 2
    `, [cedula, inscripcion.id_inscripcion]);
    let materiasPendientes = pendientesResult.rows;
    while (materiasPendientes.length < 2) {
      materiasPendientes.push({ nombre_materia: '', momento1: '', momento2: '', momento3: '' });
    }

    // 5. Configuración de hoja y columnas
    const margen = 40;
    const colWidths = [
      200, // Materia
      60, 60, 60, // Momento 1: Nota, Injustif, Justif
      60, 60, 60, // Momento 2
      60, 60, 60, // Momento 3
      60, // FINAL
      60  // REP
    ];
    const tablaWidth = colWidths.reduce((a, b) => a + b, 0);
    const pageWidth = 1000;
    const pageHeight = 650;

    // 6. Crear PDF en formato horizontal (oficio)
    const doc = new PDFDocument({ size: [pageHeight, pageWidth], layout: 'landscape', margin: margen });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=boletin_${cedula}.pdf`);
    doc.pipe(res);

    // 7. Encabezado con espacio para logos
    const logoSize = 80;
    const logoY = 30;
    const logoLeft = margen;
    const logoRight = pageWidth - margen - logoSize;
    if (fs.existsSync(path.join(__dirname, '../assets/cardenas.jpeg'))) {
      doc.image(path.join(__dirname, '../assets/cardenas.jpeg'), logoLeft, logoY, { width: logoSize, height: logoSize });
    }
    if (fs.existsSync(path.join(__dirname, '../assets/purologo.png'))) {
      doc.image(path.join(__dirname, '../assets/purologo.png'), logoRight, logoY, { width: logoSize, height: logoSize });
    }

    doc.fontSize(10).font('Helvetica-Bold').text('REPÚBLICA BOLIVARIANA DE VENEZUELA', 0, 40, { align: 'center', width: pageWidth });
    doc.text('MINISTERIO DEL PODER POPULAR PARA LA EDUCACIÓN', { align: 'center', width: pageWidth });
    doc.text('LICEO NACIONAL LIBERTADOR', { align: 'center', width: pageWidth });
    doc.fontSize(9).font('Helvetica').text('PALO GORDO – MUNICIPIO CÁRDENAS – ESTADO TÁCHIRA', { align: 'center', width: pageWidth });
    doc.fontSize(11).font('Helvetica-Bold').text('INFORME DE RENDIMIENTO ESTUDIANTIL', { align: 'center', width: pageWidth });

    doc.moveDown(2);

    // 8. Datos del estudiante centrados (docente guía solo el de orientación y convivencia)
    doc.fontSize(9).font('Helvetica-Bold')
      .text(`APELLIDOS Y NOMBRES DEL ESTUDIANTE: ${estudiante.apellidos} ${estudiante.nombres}`, { align: 'center', width: pageWidth });
    doc.text(
      `AÑO: ${inscripcion.año}    SECCIÓN: ${inscripcion.seccion}    DOCENTE GUÍA: ${docenteGuia.docente_nombre ?? ''} ${docenteGuia.docente_apellido ?? ''}`,
      { align: 'center', width: pageWidth }
    );
    doc.text(`AÑO ESCOLAR: ${inscripcion.año_escolar}`, { align: 'center', width: pageWidth });
    doc.moveDown(1);

    // 9. Tabla de materias (cabecera y filas pegadas, sin espacio extra, centrada)
    const startX = (pageWidth - tablaWidth) / 2;
    let y = doc.y;

    // Cabecera: Áreas de formación
    doc.font('Helvetica-Bold').fontSize(8);
    doc.rect(startX, y, colWidths[0], 40).stroke();
    doc.text('ÁREAS DE FORMACIÓN', startX + 5, y + 10, { width: colWidths[0] - 10, align: 'center' });

    // Cabecera: Momentos y asistencia (centrado)
    let x = startX + colWidths[0];
    ['  I MOMENTO', '  II MOMENTO', '  III MOMENTO'].forEach((mom, idx) => {
      doc.rect(x, y, colWidths[1] + colWidths[2] + colWidths[3], 20).stroke();
      doc.font('Helvetica-Bold').fontSize(7).text(mom, x, y + 4, {
        width: colWidths[1] + colWidths[2] + colWidths[3],
        align: 'justify',
        characterSpacing: 0
      });
      // Subcolumnas en la misma línea
      doc.rect(x, y + 20, colWidths[1], 20).stroke();
      doc.text('NOTA', x, y + 25, { width: colWidths[1], align: 'center' });
      doc.rect(x + colWidths[1], y + 20, colWidths[2], 20).stroke();
      doc.text('INJUSTIF', x + colWidths[1], y + 25, { width: colWidths[2], align: 'center' });
      doc.rect(x + colWidths[1] + colWidths[2], y + 20, colWidths[3], 20).stroke();
      doc.text('JUSTIF', x + colWidths[1] + colWidths[2], y + 25, { width: colWidths[3], align: 'center' });

      // Asistencia sobre las dos columnas de inasistencias
      doc.rect(x + colWidths[1], y, colWidths[2] + colWidths[3], 20).stroke();
      doc.font('Helvetica-Bold').fontSize(7).text('ASISTENCIA', x + colWidths[1], y + 2, { width: colWidths[2] + colWidths[3], align: 'center' });

      x += colWidths[1] + colWidths[2] + colWidths[3];
    });

    // Cabecera: FINAL y REP
    doc.rect(x, y, colWidths[10], 40).stroke();
    doc.font('Helvetica-Bold').fontSize(8).text('FINAL', x, y + 10, { width: colWidths[10], align: 'center' });
    x += colWidths[10];
    doc.rect(x, y, colWidths[11], 40).stroke();
    doc.font('Helvetica-Bold').fontSize(8).text('REP', x, y + 10, { width: colWidths[11], align: 'center' });

    // Filas de materias (centrado)
    y += 40;
    doc.font('Helvetica').fontSize(8);
    materias.forEach(m => {
      let x = startX;
      doc.rect(x, y, colWidths[0], 18).stroke();
      doc.text(m.nombre_materia, x + 5, y + 4, { width: colWidths[0] - 10, align: 'center' });
      x += colWidths[0];

      // Momento 1
      doc.rect(x, y, colWidths[1], 18).stroke();
      doc.text(m.momento1 ?? '', x, y + 4, { width: colWidths[1], align: 'center' });
      x += colWidths[1];
      doc.rect(x, y, colWidths[2], 18).stroke();
      doc.text('', x, y + 4, { width: colWidths[2], align: 'center' });
      x += colWidths[2];
      doc.rect(x, y, colWidths[3], 18).stroke();
      doc.text('', x, y + 4, { width: colWidths[3], align: 'center' });
      x += colWidths[3];

      // Momento 2
      doc.rect(x, y, colWidths[4], 18).stroke();
      doc.text(m.momento2 ?? '', x, y + 4, { width: colWidths[4], align: 'center' });
      x += colWidths[4];
      doc.rect(x, y, colWidths[5], 18).stroke();
      doc.text('', x, y + 4, { width: colWidths[5], align: 'center' });
      x += colWidths[5];
      doc.rect(x, y, colWidths[6], 18).stroke();
      doc.text('', x, y + 4, { width: colWidths[6], align: 'center' });
      x += colWidths[6];

      // Momento 3
      doc.rect(x, y, colWidths[7], 18).stroke();
      doc.text(m.momento3 ?? '', x, y + 4, { width: colWidths[7], align: 'center' });
      x += colWidths[7];
      doc.rect(x, y, colWidths[8], 18).stroke();
      doc.text('', x, y + 4, { width: colWidths[8], align: 'center' });
      x += colWidths[8];
      doc.rect(x, y, colWidths[9], 18).stroke();
      doc.text('', x, y + 4, { width: colWidths[9], align: 'center' });
      x += colWidths[9];

      // FINAL
      doc.rect(x, y, colWidths[10], 18).stroke();
      // Si es apreciativa, mostrar la nota_final (letra), si no, suma_final (número)
      doc.text(
        m.nota_final !== undefined && m.nota_final !== null && m.nota_final !== ''
          ? m.nota_final
          : (m.suma_final !== undefined && m.suma_final !== '' ? m.suma_final : ''),
        x, y + 4, { width: colWidths[10], align: 'center' }
      );
      x += colWidths[10];

      // REP (mostrar la nota de reparación)
      doc.rect(x, y, colWidths[11], 18).stroke();
      doc.text(m.rep !== undefined && m.rep !== null && m.rep !== '' ? m.rep : '', x, y + 4, { width: colWidths[11], align: 'center' });
      x += colWidths[11];

      y += 18;
    });

    // 10. Materias pendientes (siempre dos filas, centrado)
    y += 20;
    doc.font('Helvetica-Bold').fontSize(9).text('MATERIAS PENDIENTES:', 0, y, { align: 'center', width: pageWidth });
    y += 15;
    doc.font('Helvetica-Bold').fontSize(8);

    // Encabezado materias pendientes (agrega IV MOMENTO, centrado)
    const mpColWidths = [180, 60, 60, 60, 60];
    const mpTableWidth = mpColWidths.reduce((a, b) => a + b, 0);
    const mpStartX = (pageWidth - mpTableWidth) / 2;
    let mpX = mpStartX;
    ['MATERIA PENDIENTE', 'I MOMENTO', 'II MOMENTO', 'III MOMENTO', 'IV MOMENTO'].forEach((header, i) => {
      doc.rect(mpX, y, mpColWidths[i], 18).stroke();
      doc.text(header, mpX, y + 4, { width: mpColWidths[i], align: 'center' });
      mpX += mpColWidths[i];
    });
    y += 18;
    doc.font('Helvetica').fontSize(8);

    materiasPendientes.forEach(m => {
      let mpX = mpStartX;
      doc.rect(mpX, y, mpColWidths[0], 18).stroke();
      doc.text(m.nombre_materia, mpX, y + 4, { width: mpColWidths[0], align: 'center' });
      mpX += mpColWidths[0];

      doc.rect(mpX, y, mpColWidths[1], 18).stroke();
      doc.text(m.momento1 ?? '', mpX, y + 4, { width: mpColWidths[1], align: 'center' });
      mpX += mpColWidths[1];

      doc.rect(mpX, y, mpColWidths[2], 18).stroke();
      doc.text(m.momento2 ?? '', mpX, y + 4, { width: mpColWidths[2], align: 'center' });
      mpX += mpColWidths[2];

      doc.rect(mpX, y, mpColWidths[3], 18).stroke();
      doc.text(m.momento3 ?? '', mpX, y + 4, { width: mpColWidths[3], align: 'center' });
      mpX += mpColWidths[3];

      // IV MOMENTO vacío
      doc.rect(mpX, y, mpColWidths[4], 18).stroke();
      doc.text('', mpX, y + 4, { width: mpColWidths[4], align: 'center' });
      mpX += mpColWidths[4];

      y += 18;
    });

    // 11. Firmas (centrado)
    y += 40;
    const recWidth = 180;
    const recHeight = 40;
    const recSpacing = 30;
    const totalFirmasWidth = recWidth * 3 + recSpacing * 2;
    const recStartX = (pageWidth - totalFirmasWidth) / 2;
    const momentNames = ['I MOMENTO', 'II MOMENTO', 'III MOMENTO'];

    for (let i = 0; i < 3; i++) {
      const x = recStartX + i * (recWidth + recSpacing);
      doc.rect(x, y, recWidth, recHeight).stroke();
      const firmas = [
        { label: 'Dpto evaluación', x: x + 5 },
        { label: 'Director(a)', x: x + recWidth / 3 },
        { label: 'Representante', x: x + (2 * recWidth) / 3 }
      ];
      // Subir la línea de firma y el texto de la firma
      const firmaY = y + recHeight / 2 - 10;
      firmas.forEach(f => {
        doc.moveTo(f.x, firmaY + 5).lineTo(f.x + recWidth / 3 - 10, firmaY + 5).stroke();
        doc.font('Helvetica').fontSize(7).text(f.label, f.x, firmaY + 8, { width: recWidth / 3 - 10, align: 'center' });
      });
      // Nombre del momento debajo de las firmas
      doc.font('Helvetica-Bold').fontSize(6).text(momentNames[i], x, y + recHeight - 10, { width: recWidth, align: 'center' });
    }

    doc.end();
  } catch (error) {
    console.error('Error generando boletín:', error.message);
    res.status(500).json({ mensaje: "Error generando boletín PDF" });
  }
};


export const obtenerEstudiantesDelDocente = async (req, res) => {
  try {
    const { id_docente } = req.user;

    const result = await pool.query(`
      SELECT DISTINCT
        e.cedula,
        e.nombres,
        e.apellidos,
        s.nombre AS seccion,
        a.nombre AS año,
        ae.nombre AS año_escolar
      FROM "AsignacionDocente" ad
      JOIN "Seccion" s ON ad.id_seccion = s.id_seccion
      JOIN "Año" a ON s.id_año = a.id_año
      JOIN "año_escolar" ae ON ad.fk_año_escolar = ae.id_año_escolar
      JOIN "Inscripcion" i ON i.id_seccion = ad.id_seccion AND i.fk_año_escolar = ad.fk_año_escolar
      JOIN "Estudiante" e ON i.cedula_estudiante = e.cedula
      WHERE ad.id_docente = $1
      ORDER BY ae.nombre DESC, a.nombre, s.nombre, e.apellidos, e.nombres
    `, [id_docente]);

    res.json({ estudiantes: result.rows });
  } catch (error) {
    console.error("Error obteniendo estudiantes del docente:", error.message);
    res.status(500).json({ mensaje: "Error obteniendo estudiantes del docente" });
  }
};


// Listar años y secciones disponibles para generar boletín por secciones
export const listarAniosYSecciones = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        a.id_año,
        a.nombre AS nombre_año,
        s.id_seccion,
        s.nombre AS nombre_seccion
      FROM "Seccion" s
      JOIN "Año" a ON s.id_año = a.id_año
      ORDER BY a.nombre ASC, s.nombre ASC
    `);

    // Agrupar por año
    const agrupado = {};
    result.rows.forEach(row => {
      if (!agrupado[row.nombre_año]) {
        agrupado[row.nombre_año] = [];
      }
      agrupado[row.nombre_año].push({
        id_seccion: row.id_seccion,
        nombre_seccion: row.nombre_seccion
      });
    });

    res.json({ anios_secciones: agrupado });
  } catch (error) {
    console.error("Error listando años y secciones:", error.message);
    res.status(500).json({ mensaje: "Error listando años y secciones" });
  }
};

// Listar estudiantes por sección
export const listarEstudiantesPorSeccion = async (req, res) => {
  try {
    const { id_seccion } = req.query;
    if (!id_seccion) {
      return res.status(400).json({ mensaje: "Debe indicar el id_seccion" });
    }

    // Buscar el año escolar más reciente para esa sección
    const anioResult = await pool.query(`
      SELECT MAX(i.fk_año_escolar) AS id_año_escolar
      FROM "Inscripcion" i
      WHERE i.id_seccion = $1
    `, [id_seccion]);
    const id_año_escolar = anioResult.rows[0]?.id_año_escolar;

    if (!id_año_escolar) {
      return res.status(404).json({ mensaje: "No hay inscripciones para esta sección." });
    }

    const result = await pool.query(`
      SELECT 
        e.cedula,
        e.nombres,
        e.apellidos,
        i.id_inscripcion,
        ae.nombre AS año_escolar
      FROM "Inscripcion" i
      JOIN "Estudiante" e ON i.cedula_estudiante = e.cedula
      JOIN "año_escolar" ae ON i.fk_año_escolar = ae.id_año_escolar
      WHERE i.id_seccion = $1 AND i.fk_año_escolar = $2
      ORDER BY e.apellidos, e.nombres
    `, [id_seccion, id_año_escolar]);

    res.json({ estudiantes: result.rows });
  } catch (error) {
    console.error("Error listando estudiantes por sección:", error.message);
    res.status(500).json({ mensaje: "Error listando estudiantes por sección" });
  }
};

export const generarBoletinEstudianteExcel = async (req, res) => {
  try {
    const cedula = req.params.cedula;

    // 1. Obtener inscripción más reciente
    const inscripcionResult = await pool.query(`
      SELECT 
        i.id_inscripcion,
        s.nombre AS seccion,
        a.nombre AS año,
        ae.nombre AS año_escolar
      FROM "Inscripcion" i
      JOIN "Seccion" s ON s.id_seccion = i.id_seccion
      JOIN "Año" a ON s.id_año = a.id_año
      JOIN "año_escolar" ae ON i.fk_año_escolar = ae.id_año_escolar
      WHERE i.cedula_estudiante = $1
      ORDER BY i.fk_año_escolar DESC, i.id_inscripcion DESC
      LIMIT 1;
    `, [cedula]);

    if (inscripcionResult.rows.length === 0) {
      return res.status(404).json({ mensaje: "Estudiante no encontrado o no inscrito." });
    }

    const inscripcion = inscripcionResult.rows[0];

    // 2. Datos del estudiante
    const estudianteResult = await pool.query(`
      SELECT nombres, apellidos FROM "Estudiante" WHERE cedula = $1
    `, [cedula]);
    const estudiante = estudianteResult.rows[0];

    // 2.1. Buscar docente guía (solo el de "orientación y convivencia")
    const docenteGuiaResult = await pool.query(`
      SELECT u.nombres AS docente_nombre, u.apellidos AS docente_apellido
      FROM "MateriaInscrita" mi
      JOIN "Año_Materia" am ON am.id_año_materia = mi.id_año_materia
      JOIN "Materia" m ON m.codigo_materia = am.codigo_materia
      JOIN "Inscripcion" i ON mi.id_inscripcion = i.id_inscripcion
      JOIN "AsignacionDocente" ad ON ad.id_año_materia = am.id_año_materia AND ad.id_seccion = i.id_seccion AND ad.fk_año_escolar = i.fk_año_escolar
      JOIN "Docente" d ON d.id_docente = ad.id_docente
      JOIN "Usuario" u ON u.cedula = d.fk_cedula
      WHERE mi.id_inscripcion = $1
        AND m.nombre ILIKE '%Orientación y Convivencia%'
      LIMIT 1
    `, [inscripcion.id_inscripcion]);
    const docenteGuia = docenteGuiaResult.rows[0] || { docente_nombre: '', docente_apellido: '' };

    // 3. Materias y notas por momento
    const materiasResult = await pool.query(`
      SELECT m.nombre AS nombre_materia, mi.nota_final, mi.id_materia_inscrita,
        (SELECT nota FROM "Evaluacion" ev WHERE ev.fk_materia_inscrita = mi.id_materia_inscrita AND ev.fk_momento = 1 LIMIT 1) AS momento1,
        (SELECT nota FROM "Evaluacion" ev WHERE ev.fk_materia_inscrita = mi.id_materia_inscrita AND ev.fk_momento = 2 LIMIT 1) AS momento2,
        (SELECT nota FROM "Evaluacion" ev WHERE ev.fk_materia_inscrita = mi.id_materia_inscrita AND ev.fk_momento = 3 LIMIT 1) AS momento3
      FROM "MateriaInscrita" mi
      JOIN "Año_Materia" am ON am.id_año_materia = mi.id_año_materia
      JOIN "Materia" m ON m.codigo_materia = am.codigo_materia
      WHERE mi.id_inscripcion = $1
      ORDER BY m.nombre ASC;
    `, [inscripcion.id_inscripcion]);

    // Traer las notas de reparación (rep) para cada materia inscrita
    const idsMateriasInscritas = materiasResult.rows.map(m => m.id_materia_inscrita);
    let reps = [];
    if (idsMateriasInscritas.length > 0) {
      const repsResult = await pool.query(`
        SELECT fk_materia_inscrita, rep
        FROM "Evaluacion"
        WHERE fk_materia_inscrita = ANY($1) AND fk_momento = 4
      `, [idsMateriasInscritas]);
      reps = repsResult.rows;
    }

    // Utilidades para letras
    function notaALetra(nota) {
      if (nota === '' || nota === null || nota === undefined) return '';
      const n = Number(nota);
      if (n === 20 || n === 19) return 'A';
      if (n >= 15 && n <= 18) return 'B';
      if (n >= 11 && n <= 14) return 'C';
      return 'D';
    }
    function definitivaLetra(l1, l2, l3) {
      if (!l1 || !l2 || !l3) return '';
      if (l1 === l2 && l2 === l3) return l1;
      const orden = ['A', 'B', 'C', 'D'];
      const letras = [l1, l2, l3];
      if (
        (l1 === 'B' && l2 === 'D' && l3 === 'B') ||
        (l1 === 'B' && l2 === 'B' && l3 === 'D') ||
        (l1 === 'D' && l2 === 'B' && l3 === 'B')
      ) {
        return 'C';
      }
      for (const letra of orden) {
        if (letras.filter(l => l === letra).length === 2) return letra;
      }
      const presentes = letras.map(l => orden.indexOf(l)).sort((a, b) => a - b);
      return orden[presentes[1]];
    }

    const materias = materiasResult.rows.map(m => {
      const nombreMateria = (m.nombre_materia || '').trim().toLowerCase();
      // Buscar rep para esta materia
      const repObj = reps.find(r => r.fk_materia_inscrita === m.id_materia_inscrita);
      const repNota = repObj ? repObj.rep : '';
      if (
        nombreMateria === 'orientación y convivencia' ||
        nombreMateria === 'participación en grupos de recreación'
      ) {
        return {
          ...m,
          momento1: notaALetra(m.momento1),
          momento2: notaALetra(m.momento2),
          momento3: notaALetra(m.momento3),
          nota_final: definitivaLetra(
            notaALetra(m.momento1),
            notaALetra(m.momento2),
            notaALetra(m.momento3)
          ),
          rep: repNota
        };
      }
      let sumaFinal = '';
      if (
        m.momento1 !== null && m.momento1 !== undefined && m.momento1 !== '' &&
        m.momento2 !== null && m.momento2 !== undefined && m.momento2 !== '' &&
        m.momento3 !== null && m.momento3 !== undefined && m.momento3 !== ''
      ) {
        sumaFinal = (
          Number(m.momento1) +
          Number(m.momento2) +
          Number(m.momento3)
        ).toString();
      }
      return {
        ...m,
        suma_final: sumaFinal,
        rep: repNota
      };
    });

    // 4. Materias pendientes (máximo 2 registros)
    const pendientesResult = await pool.query(`
      SELECT m.nombre AS nombre_materia,
        (SELECT nota FROM "Evaluacion" ev WHERE ev.fk_materia_inscrita = mi.id_materia_inscrita AND ev.fk_momento = 1 LIMIT 1) AS momento1,
        (SELECT nota FROM "Evaluacion" ev WHERE ev.fk_materia_inscrita = mi.id_materia_inscrita AND ev.fk_momento = 2 LIMIT 1) AS momento2,
        (SELECT nota FROM "Evaluacion" ev WHERE ev.fk_materia_inscrita = mi.id_materia_inscrita AND ev.fk_momento = 3 LIMIT 1) AS momento3
      FROM "MateriaInscrita" mi
      JOIN "Año_Materia" am ON am.id_año_materia = mi.id_año_materia
      JOIN "Materia" m ON m.codigo_materia = am.codigo_materia
      JOIN "Inscripcion" i ON mi.id_inscripcion = i.id_inscripcion
      WHERE i.cedula_estudiante = $1 AND mi.estado = 'reprobada'
        AND i.id_inscripcion != $2
      LIMIT 2
    `, [cedula, inscripcion.id_inscripcion]);
    let materiasPendientes = pendientesResult.rows;
    while (materiasPendientes.length < 2) {
      materiasPendientes.push({ nombre_materia: '', momento1: '', momento2: '', momento3: '' });
    }

    // --- Crear Excel ---
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Boletín');

    // --- Encabezado ---
    sheet.addRow([]);
    sheet.addRow(['REPÚBLICA BOLIVARIANA DE VENEZUELA']);
    sheet.addRow(['MINISTERIO DEL PODER POPULAR PARA LA EDUCACIÓN']);
    sheet.addRow(['LICEO NACIONAL LIBERTADOR']);
    sheet.addRow(['PALO GORDO – MUNICIPIO CÁRDENAS – ESTADO TÁCHIRA']);
    sheet.addRow(['INFORME DE RENDIMIENTO ESTUDIANTIL']);
    for (let i = 2; i <= 6; i++) {
      sheet.mergeCells(i, 1, i, 12);
      sheet.getRow(i).alignment = { horizontal: 'center' };
      sheet.getRow(i).font = { bold: true, size: i === 6 ? 13 : 11 };
    }
    sheet.addRow([]);

    // --- Datos del estudiante ---
    sheet.addRow([`APELLIDOS Y NOMBRES DEL ESTUDIANTE: ${estudiante.apellidos} ${estudiante.nombres}`]);
    sheet.mergeCells(sheet.lastRow.number, 1, sheet.lastRow.number, 12);
    sheet.getRow(sheet.lastRow.number).alignment = { horizontal: 'center' };
    sheet.addRow([
      `AÑO: ${inscripcion.año}    SECCIÓN: ${inscripcion.seccion}    DOCENTE GUÍA: ${docenteGuia.docente_nombre ?? ''} ${docenteGuia.docente_apellido ?? ''}`
    ]);
    sheet.mergeCells(sheet.lastRow.number, 1, sheet.lastRow.number, 12);
    sheet.getRow(sheet.lastRow.number).alignment = { horizontal: 'center' };
    sheet.addRow([`AÑO ESCOLAR: ${inscripcion.año_escolar}`]);
    sheet.mergeCells(sheet.lastRow.number, 1, sheet.lastRow.number, 12);
    sheet.getRow(sheet.lastRow.number).alignment = { horizontal: 'center' };
    sheet.addRow([]);

    // --- Cabecera de tabla de materias ---
    sheet.addRow([
      'ÁREAS DE FORMACIÓN',
      'NOTA 1', 'INJUSTIF 1', 'JUSTIF 1',
      'NOTA 2', 'INJUSTIF 2', 'JUSTIF 2',
      'NOTA 3', 'INJUSTIF 3', 'JUSTIF 3',
      'FINAL', 'REP'
    ]);
    // Solo la cabecera en negrita
    sheet.getRow(sheet.lastRow.number).font = { bold: true };
    sheet.getRow(sheet.lastRow.number).alignment = { horizontal: 'center' };

    // --- Filas de materias ---
    materias.forEach(m => {
      const row = sheet.addRow([
        m.nombre_materia,
        m.momento1 ?? '', '', '',
        m.momento2 ?? '', '', '',
        m.momento3 ?? '', '', '',
        m.nota_final !== undefined && m.nota_final !== null && m.nota_final !== ''
          ? m.nota_final
          : (m.suma_final !== undefined && m.suma_final !== '' ? m.suma_final : ''),
        m.rep !== undefined && m.rep !== null && m.rep !== '' ? m.rep : ''
      ]);
      row.font = { bold: true };
    });

    // --- Materias pendientes ---
    sheet.addRow([]);
    // Centrar la tabla de materias pendientes
    const mpStartCol = 4;
    sheet.addRow(['', '', '', 'MATERIAS PENDIENTES:']);
    sheet.mergeCells(sheet.lastRow.number, mpStartCol, sheet.lastRow.number, mpStartCol + 4);
    sheet.getRow(sheet.lastRow.number).alignment = { horizontal: 'center' };
    sheet.addRow(['', '', '', 'MATERIA PENDIENTE', 'I MOMENTO', 'II MOMENTO', 'III MOMENTO', 'IV MOMENTO']);
    sheet.getRow(sheet.lastRow.number).font = { bold: true };
    materiasPendientes.forEach(m => {
      sheet.addRow(['', '', '',
        m.nombre_materia,
        m.momento1 ?? '',
        m.momento2 ?? '',
        m.momento3 ?? '',
        ''
      ]);
    });

    // --- Firmas (alineadas y celdas iguales) ---
    sheet.addRow([]);
    // Fila de momentos (3 bloques de 4 celdas cada uno, todas iguales)
    sheet.addRow([
      'I MOMENTO', '', '', '', 'II MOMENTO','', '', '', 'III MOMENTO','', '', ''
    ]);
    // Fila de firmas (Dpto evaluación alineado a la derecha de cada bloque)
    sheet.addRow([
      '', 'Dpto evaluación', 'Director(a)', 'Representante',
      '', 'Dpto evaluación', 'Director(a)', 'Representante',
      '', 'Dpto evaluación', 'Director(a)', 'Representante'
    ]);
    // Ajustar ancho de columnas para que todas las celdas de firmas sean iguales
    sheet.columns = [
      { width: 35 }, // ÁREAS DE FORMACIÓN (más largo para nombres)
      { width: 14 }, { width: 14 }, { width: 14 },
      { width: 14 }, { width: 14 }, { width: 14 },
      { width: 14 }, { width: 14 }, { width: 14 },
      { width: 14 }, { width: 14 }, 
    ];

    // --- Bordes y formato ---
    sheet.eachRow((row, rowNumber) => {
      row.eachCell(cell => {
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
      // Solo la cabecera y títulos en negrita, no las materias
      if (
        rowNumber === 8 || // cabecera de tabla de materias
        rowNumber === 13 || // cabecera materias pendientes
        rowNumber === 15    // cabecera firmas
      ) {
        row.font = { bold: true };
      }
    });

    // --- Enviar el archivo Excel ---
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=boletin_${cedula}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error generando boletín Excel:', error.message);
    res.status(500).json({ mensaje: "Error generando boletín Excel" });
  }
};

// Listar asignaciones de año a materia
export const listarAniosMateria = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT am.id_año_materia, am.codigo_materia, m.nombre AS nombre_materia, am.id_año, a.nombre AS nombre_año
            FROM "Año_Materia" am
            JOIN "Materia" m ON am.codigo_materia = m.codigo_materia
            JOIN "Año" a ON am.id_año = a.id_año
            ORDER BY am.id_año, m.nombre
        `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ mensaje: "Error listando asignaciones" });
    }
};

// Editar asignación de año a materia
export const editarAniosMateria = async (req, res) => {
    try {
        const { id_año_materia } = req.params;
        const { codigo_materia, id_año } = req.body;

        if (!codigo_materia || !id_año) {
            return res.status(400).json({ mensaje: "Debes seleccionar materia y año." });
        }
        const añoCodigo = parseInt(codigo_materia.substring(0, 2), 10);
        if (isNaN(añoCodigo) || añoCodigo !== parseInt(id_año, 10)) {
            return res.status(400).json({ mensaje: `La materia con código ${codigo_materia} solo puede asignarse al año ${añoCodigo}.` });
        }

        const result = await pool.query(
            `UPDATE "Año_Materia" SET codigo_materia = $1, id_año = $2 WHERE id_año_materia = $3 RETURNING *`,
            [codigo_materia, id_año, id_año_materia]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ mensaje: "Asignación no encontrada." });
        }
        res.json({ mensaje: "Asignación actualizada", asignacion: result.rows[0] });
    } catch (error) {
        res.status(500).json({ mensaje: "Error editando asignación" });
    }
};

// Eliminar asignación de año a materia
export const eliminarAniosMateria = async (req, res) => {
    try {
        const { id_año_materia } = req.params;
        const result = await pool.query(
            `DELETE FROM "Año_Materia" WHERE id_año_materia = $1 RETURNING *`,
            [id_año_materia]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ mensaje: "Asignación no encontrada." });
        }
        res.json({ mensaje: "Asignación eliminada correctamente." });
    } catch (error) {
        res.status(500).json({ mensaje: "Error eliminando asignación" });
    }
};

export const registrarSeccion = async (req, res) => {
    try {
        const { nombre, id_año } = req.body;
        if (!nombre || !id_año) {
            return res.status(400).json({ mensaje: "Nombre y año son obligatorios." });
        }
        const existe = await pool.query(
            `SELECT 1 FROM "Seccion" WHERE nombre = $1 AND id_año = $2`,
            [nombre, id_año]
        );
        if (existe.rows.length > 0) {
            return res.status(409).json({ mensaje: "Ya existe una sección con ese nombre y año." });
        }
        const result = await pool.query(
            `INSERT INTO "Seccion" (nombre, id_año) VALUES ($1, $2) RETURNING *`,
            [nombre, id_año]
        );
        res.status(201).json({ mensaje: "Sección registrada", seccion: result.rows[0] });
    } catch (error) {
        res.status(500).json({ mensaje: "Error registrando sección" });
    }
};

// Listar secciones
export const listarSecciones = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT s.id_seccion, s.nombre, a.id_año, a.nombre AS nombre_año
            FROM "Seccion" s
            JOIN "Año" a ON s.id_año = a.id_año
            ORDER BY a.id_año, s.nombre
        `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ mensaje: "Error listando secciones" });
    }
};

// Editar sección
export const editarSeccion = async (req, res) => {
    try {
        const { id_seccion } = req.params;
        const { nombre, id_año } = req.body;
        if (!nombre || !id_año) {
            return res.status(400).json({ mensaje: "Nombre y año son obligatorios." });
        }
        const result = await pool.query(
            `UPDATE "Seccion" SET nombre = $1, id_año = $2 WHERE id_seccion = $3 RETURNING *`,
            [nombre, id_año, id_seccion]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ mensaje: "Sección no encontrada." });
        }
        res.json({ mensaje: "Sección actualizada", seccion: result.rows[0] });
    } catch (error) {
        res.status(500).json({ mensaje: "Error editando sección" });
    }
};

// Eliminar sección
export const eliminarSeccion = async (req, res) => {
    try {
        const { id_seccion } = req.params;
        const result = await pool.query(
            `DELETE FROM "Seccion" WHERE id_seccion = $1 RETURNING *`,
            [id_seccion]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ mensaje: "Sección no encontrada." });
        }
        res.json({ mensaje: "Sección eliminada correctamente." });
    } catch (error) {
        res.status(500).json({ mensaje: "Error eliminando sección" });
    }
};