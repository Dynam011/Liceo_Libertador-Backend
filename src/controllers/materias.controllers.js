// controllers/users.controllers.js
import { pool } from '../db.js';
import bcrypt from 'bcrypt';
import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import jwt from "jsonwebtoken";
import nodemailer from 'nodemailer';
import crypto from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));



// =======================
// SECCIÓN: MATERIAS Y AÑO-MATERIA
// SUGERIDO: controllers/materias.controllers.js
// =======================

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
            `INSERT INTO "Materia" (codigo_materia, nombre) VALUES (UPPER($1), UPPER($2)) RETURNING *`,
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
         //  Validar si la materia ya está asignada a ese año
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
