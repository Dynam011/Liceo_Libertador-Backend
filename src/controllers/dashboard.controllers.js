// controllers/users.controllers.js
import { pool } from "../db.js";

// Utilidad para obtener el año escolar actual (el de mayor id)
async function getCurrentSchoolYearId() {
  try {
    const result = await pool.query(
      'SELECT id_año_escolar FROM "año_escolar" ORDER BY id_año_escolar DESC LIMIT 1'
    );
    return result.rows[0]?.id_año_escolar || null;
  } catch (error) {
    console.error("Error fetching current school year:", error);
    return null;
  }
}

// 1. STATS
export const stats = async (req, res) => {

  try {
    const currentYear = await getCurrentSchoolYearId();
    if (!currentYear) {
      return res.status(404).json({ error: "No hay año escolar registrado" });
    }

    const statsQuery = `
   SELECT 
    (SELECT COUNT(DISTINCT cedula) FROM "Estudiante") AS "totalStudents",
    COUNT(DISTINCT CASE WHEN estado = 'aprobada' THEN id_inscripcion END) AS approved,
    COUNT(DISTINCT CASE WHEN estado = 'reprobada' THEN id_inscripcion END) AS failed
FROM "MateriaInscrita";
    `;
    const result = await pool.query(statsQuery);
    const stats = result.rows[0];
    res.json(stats);
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ error: "Error al obtener estadísticas" });
  }
};

// 2. STUDENTS
export const students = async (req, res) => {
  try {
    const currentYear = await getCurrentSchoolYearId();
    if (!currentYear) {
      return res.status(404).json({ error: "No hay año escolar registrado" });
    }

    const studentsQuery = `
      SELECT 
        e.cedula,
        CONCAT(e.nombres, ' ', e.apellidos) AS "name",
        a.nombre AS "year",
        CASE 
          WHEN AVG(mi.nota_final) >= 10 THEN 'Aprobado'
          ELSE 'Reprobado'
        END AS "status",
        ROUND(AVG(mi.nota_final)::numeric, 2) AS "average",
        NULL AS "attendance"
      FROM "Estudiante" e
      JOIN "Inscripcion" i ON i.cedula_estudiante = e.cedula
      JOIN "Seccion" s ON s.id_seccion = i.id_seccion
      JOIN "Año" a ON a.id_año = s.id_año
      JOIN "MateriaInscrita" mi ON mi.id_inscripcion = i.id_inscripcion
      WHERE i.fk_año_escolar = ${currentYear}
      GROUP BY e.cedula, e.nombres, e.apellidos, a.nombre
      ORDER BY a.nombre, e.apellidos, e.nombres
    `;
    const result = await pool.query(studentsQuery);
    const students = result.rows;
    res.json(students);
  } catch (error) {
    console.log("Error fetching students:", error);
    res.status(500).json({ error: "Error al obtener estudiantes" });
  }
};

// 3. METRICS
export const metrics = async (req, res) => {
  try {
    const currentYear = await getCurrentSchoolYearId();
    if (!currentYear) {
      return res.status(404).json({ error: "No hay año escolar registrado" });
    }

    // a) Promedios por año
    const yearAveragesQuery = `
      SELECT 
        a.nombre AS "year",
        ROUND(AVG(mi.nota_final)::numeric, 2) AS "average"
      FROM "Año" a
      JOIN "Seccion" s ON s.id_año = a.id_año
      JOIN "Inscripcion" i ON i.id_seccion = s.id_seccion
      JOIN "MateriaInscrita" mi ON mi.id_inscripcion = i.id_inscripcion
      WHERE i.fk_año_escolar = ${currentYear}
      GROUP BY a.nombre
      ORDER BY a.nombre
    `;
    const yearAveragesResult = await pool.query(yearAveragesQuery);
    const yearAverages = yearAveragesResult.rows;

    // b) Año con mejor promedio
    const bestYearQuery = `
      SELECT "year" FROM (
        SELECT 
          a.nombre AS "year",
          AVG(mi.nota_final) AS avg_year
        FROM "Año" a
        JOIN "Seccion" s ON s.id_año = a.id_año
        JOIN "Inscripcion" i ON i.id_seccion = s.id_seccion
        JOIN "MateriaInscrita" mi ON mi.id_inscripcion = i.id_inscripcion
        WHERE i.fk_año_escolar = ${currentYear}
        GROUP BY a.nombre
      ) sub
      ORDER BY avg_year DESC
      LIMIT 1
    `;
    const bestYearResult = await pool.query(bestYearQuery);
    const bestYear = bestYearResult.rows[0]?.year || null;

    // c) Mejor estudiante
    const bestStudentQuery = `
      SELECT 
        CONCAT(e.nombres, ' ', e.apellidos) AS "name",
        a.nombre AS "year",
        ROUND(AVG(mi.nota_final)::numeric, 2) AS "average"
      FROM "Estudiante" e
      JOIN "Inscripcion" i ON i.cedula_estudiante = e.cedula
      JOIN "Seccion" s ON s.id_seccion = i.id_seccion
      JOIN "Año" a ON a.id_año = s.id_año
      JOIN "MateriaInscrita" mi ON mi.id_inscripcion = i.id_inscripcion
      WHERE i.fk_año_escolar = ${currentYear}
      GROUP BY e.cedula, e.nombres, e.apellidos, a.nombre
      ORDER BY "average" DESC
      LIMIT 1
    `;
    const bestStudentResult = await pool.query(bestStudentQuery);
    const bestStudent = bestStudentResult.rows[0] || null;

    // d) Mejor promedio general
    const bestAverageQuery = `
      SELECT 
        MAX(promedio) AS "bestAverage"
      FROM (
        SELECT AVG(mi.nota_final) AS promedio
        FROM "Estudiante" e
        JOIN "Inscripcion" i ON i.cedula_estudiante = e.cedula
        JOIN "MateriaInscrita" mi ON mi.id_inscripcion = i.id_inscripcion
        WHERE i.fk_año_escolar = ${currentYear}
        GROUP BY e.cedula
      ) sub
    `;
    const bestAverageResult = await pool.query(bestAverageQuery);
    const bestAverage = bestAverageResult.rows[0]?.bestAverage || null;

    res.json({
      bestYear,
      bestAverage,
      bestStudent,
      yearAverages,
    });
  } catch (error) {
    res.status(500).json({ error: "Error al obtener métricas" });
  }
};
