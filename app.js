// Importar la libreria:::::::::::::::::::::::::::::
const express = require("express");

const mysql = require("mysql2");

const session = require('express-session');

//objetos para llamar los métodos de express:::::::::::::::::::::::::::::
const app = express();

app.use(session({
    secret: 'tu_secreto', // Cambia esto a un valor seguro en un entorno de producción
    resave: false,
    saveUninitialized: true
  }));

let conexion = mysql.createConnection({
    host: "localhost",
    database: "solicitudesestudiantiles",
    user: "root",
    password: "Juanito2021"
});

//configuraciones
app.set("view engine", "ejs");
app.set("views", __dirname + "/views"); // Especifica el directorio de las vistas

app.use(express.json());
app.use(express.urlencoded({extended:false}));


app.get("/", function(req, res){
    res.render("index");
});

// Ruta para manejar el formulario de inicio de sesión
app.post('/iniciar-sesion', function(req, res){
    const datos = req.body;

    let correo = datos.correo;
    let pass = datos.contrasena;

    // Llamar al procedimiento almacenado
    conexion.query('CALL sp_usuariosLogin(?, ?)', [correo, pass], (error, results) => {
        if (error) {
            console.error('Error al llamar al procedimiento almacenado:', error);
            return res.status(500).send('Error al llamar al procedimiento almacenado');
        }
    
        const mensajeResultado = results[0][0].Result;
    
        // Verificar el resultado del procedimiento almacenado
        if (mensajeResultado === 'Acceso exitoso!') {
          // Redirigir a la página de bienvenida si el inicio de sesión es exitoso
            // Almacena el usuario en la sesión
            req.session.usuario = correo; // Asume que `correo` es el nombre de usuario
            res.redirect('/dashboard');
        } else {
          // Redirigir a la página de inicio de sesión con un mensaje de error
          res.render('index', { error: 'Credenciales incorrectas' });
        }

    });


});

// Ruta para manejar la página de dashboard
app.get('/dashboard', function (req, res) {
  // Recupera el usuario desde la sesión
  const usuario = req.session.usuario;

  // Verifica si hay mensajes de éxito o error en la URL
  const exito = req.query.exito === 'true';
  const error = req.query.error === 'true';
  const mensaje = req.query.mensaje || null;

  // Consulta SQL para obtener el número de documento
  const sqlNumeroDocumento = 'SELECT usuNumeroDocumento FROM usuario WHERE UsuCorreoInstitucional = ?';
  conexion.query(sqlNumeroDocumento, [usuario], (errNumeroDocumento, numeroDocumentoResults) => {
    if (errNumeroDocumento) {
      console.error("Error al obtener el número de documento: " + errNumeroDocumento.message);
      // Manejar el error adecuadamente
      return;
    }

  const numeroDocumento = numeroDocumentoResults[0].usuNumeroDocumento;

  // Consulta SQL para obtener los comentarios recientes
  const sqlConsultaComentarios = `SELECT com.CAdmIdComentarioAdministrativo, 
                                          com.CAdmSolicitudId, 
                                          tra.TraNombre,  
                                          est.EtaNombreEtapa, 
                                          com.CAdmContenido, 
                                          com.CAdmFechaHora 
                                          FROM comentarioadministrativo AS com 
                                            JOIN EtapaSolicitud AS est
                                              ON com.CAdmEtapaSolicitudId = est.Eta_idEtapa
                                            JOIN Solicitud AS sol
                                              ON sol.solId = com.CAdmSolicitudId
                                            JOIN Tramite AS tra
                                              ON tra.TraId = sol.SolTramiteId
                                          WHERE sol.SolEstNumeroDocumento = ?
                                          ORDER BY com.CAdmFechaHora DESC LIMIT 5`;

  // Ejecutar la consulta SQL
  conexion.query(sqlConsultaComentarios,  [numeroDocumento], (errorConsulta, resultadosConsulta) => {
    if (errorConsulta) {
      console.error('Error al consultar comentarios recientes:', errorConsulta);
      return res.status(500).send('Error interno del servidor');
    }

    // Resultados de la consulta
    const comentariosRecientes = resultadosConsulta;
    console.log(comentariosRecientes);
    // Haz lo que necesites con la información del usuario, los mensajes y los comentarios recientes
    res.render('dashboard', { usuario, exito, error, mensaje, comentariosRecientes });
  });
});
});

// Ruta para cerrar sesión
app.get('/logout', function(req, res) {
    // Destruye la sesión y proporciona un callback
    req.session.destroy(function(err) {
      if (err) {
        console.error('Error al cerrar sesión:', err);
        return res.status(500).send('Error al cerrar sesión');
      }
  
      // Si el callback se ejecuta, la sesión se ha destruido con éxito
      console.log('Sesión destruida con éxito');
  
      // Redirige al usuario a la página de inicio de sesión (o a donde prefieras)
      res.redirect('/index');
    });
  });

// Ruta para la página de inicio de sesión
app.get('/index', function(req, res) {
    // Puedes renderizar la vista de inicio de sesión aquí
    res.render('index');
  });

// Ruta para la página de nueva solicitud
app.get('/nueva_solicitud', async function(req, res) {
    try {
      // Consulta de tipos de trámite
      const tiposTramite = await queryAsync('SELECT TraId, TraNombre FROM tramite');
  
      // Obtener el número de documento del usuario
      const usuario = req.session.usuario;
      const numeroDocumentoResults = await queryAsync('SELECT usuNumeroDocumento FROM usuario WHERE UsuCorreoInstitucional = ?', [usuario]);
      const numeroDocumento = numeroDocumentoResults[0].usuNumeroDocumento;
  
      // Obtener la carrera del usuario
      const carreraResults = await queryAsync('SELECT carNombreCarrera FROM carrera JOIN historiaacademica ON HAcaIdCarrera = CarIdCarrera WHERE HAcaNumeroDocumento = ?', [numeroDocumento]);
      const carrera = carreraResults[0].carNombreCarrera;
      const mensaje = null;

      // Renderizar la vista y pasar los resultados
      res.render('nueva_solicitud', { opciones: tiposTramite, numeroDocumento, carrera, usuario });
    } catch (error) {
      console.error('Error en la ruta /nueva_solicitud:', error);
      return res.status(500).send('Error en la ruta /nueva_solicitud');
    }
  });
  
  // Función para realizar una consulta a la base de datos de manera asíncrona
  function queryAsync(sql, values) {
    return new Promise((resolve, reject) => {
      conexion.query(sql, values, function(error, results, fields) {
        if (error) {
          reject(error);
        } else {
          resolve(results);
        }
      });
    });
  }



//tabla de mapeo entre opciones y procedimientos almacenados
const opcionesProcedimientos = {
    'Autorizacion cursar Menos de la carga minima': 'sp_revisarTra_AutorizacionCargaMinima',
    'Cancelacion de Asignaturas posterior mitad periodo academico': 'sp_revisarTra_CancelacionAsignaturasMitadPAcademico',
    'Cancelación de periodo academico': 'sp_revisarTra_CancelacionPeriodoAcademico',
    'Doble titulacion': 'sp_revisarTra_DobleTitulacion',
    'Homologacion y convalidacion de asignaturas': 'sp_revisarTra_HomologacionConvalidacionAsignaturas',
    'Registro trabajo de grado': 'sp_revisarTra_RegistoTrabajoGrado',
    'Reingreso': 'sp_revisarTra_Reingreso',
    'Reserva cupo adicional': 'sp_revisarTra_ReservaCupoAdicional',
    'Traslado programa Curricular': 'sp_revisarTra_TrasladoProgramaCurricular'
  };
  
  app.get('/obtener-resultados-tramite', function (req, res) {
    // Obtén el nombre del trámite seleccionado de la consulta
    const tramiteSeleccionado = req.query.tramite;
    console.log(tramiteSeleccionado);
    // Accede a las variables adicionales pasadas desde la vista
    const numeroDocumento = req.query.numeroDocumento;
    const carrera = req.query.carrera;
  
    // Verifica si la opción existe en el mapeo
    if (opcionesProcedimientos.hasOwnProperty(tramiteSeleccionado)) {
      // Obten el nombre del procedimiento almacenado asociado a la opción
      const nombreProcedimiento = opcionesProcedimientos[tramiteSeleccionado];
      console.log(nombreProcedimiento);
      // Ajusta los parámetros del procedimiento según tus necesidades
      conexion.query(`CALL ${nombreProcedimiento}(?, ?, ?)`, [numeroDocumento, carrera, 4], (error, results) => {
        if (error) {
          console.error('Error al llamar al procedimiento almacenado:', error);
          return res.status(500).json({ error: 'Error al llamar al procedimiento almacenado' });
        }
        
        // Manejar los resultados como desees
        const datosResultados = results[0];
        console.log(datosResultados);
        // Enviar los resultados al cliente en formato JSON
        res.json(datosResultados);
  
      });
    } else {
      // La opción no está en el mapeo, puedes manejar esto como desees
      res.status(400).send('Opción de trámite no válida');
    }
  });

// Ruta para manejar la presentación del formulario
app.post('/crear_solicitud', (req, res) => {
  // Recuperar los valores del formulario
  const numeroDocumento = req.body.numeroDocumento;
  const numeroTramite = req.body.opcion;
  console.log(numeroTramite);

  // Llamar al procedimiento almacenado
  const sql = 'CALL sp_estudianteRadicarSolicitud(?, ?, 6)';
  conexion.query(sql, [numeroDocumento, numeroTramite], (err, result) => {
    if (err) {
      console.error(`Error al ejecutar el procedimiento almacenado: ${err.message}`);
      res.status(500).send('Error interno del servidor');
    } else {
      console.log('Procedimiento almacenado ejecutado correctamente');
  
      const mensaje = result[0][0].Mensaje;

      if (mensaje === 'Solicitud creada exitosamente!') {
        // Redirige a la vista de éxito con el mensaje de éxito
        res.redirect('/dashboard?exito=true&mensaje=' + encodeURIComponent(mensaje));
      } else {
        console.error(`Error al radicar la solicitud: ${mensaje}`);
        // Redirige a la vista de error con el mensaje de error
        res.redirect('/dashboard?error=true&mensaje=' + encodeURIComponent(mensaje));
      }
    }
  });
});


// Ruta mis solicitudes
app.get('/mis_solicitudes', async function(req, res) {
  try {
    const usuario = req.session.usuario;

    // Consulta SQL para obtener el número de documento
    const sqlNumeroDocumento = 'SELECT usuNumeroDocumento FROM usuario WHERE UsuCorreoInstitucional = ?';
    const numeroDocumentoResults = await queryAsync(sqlNumeroDocumento, [usuario]);

    if (!numeroDocumentoResults || !numeroDocumentoResults[0]) {
      console.error("No se encontró el número de documento para el usuario:", usuario);
      // Manejar el caso sin resultados adecuadamente
      return res.status(500).send('Error en la ruta /mis_solicitudes');
    }

    const numeroDocumento = numeroDocumentoResults[0].usuNumeroDocumento;
    console.log(numeroDocumento);
    // Solicitudes activas
    const solicitudesResults = await queryAsync(`
    WITH UltimoEstadoSolicitud AS (
      SELECT
        sol.SolId,
        est.EstNombreEstado,
        tra.traNombre,
        sol.SolFechaEstimadaRespuesta,
        ROW_NUMBER() OVER (PARTITION BY sol.SolId ORDER BY she.SEstFechaHora DESC) AS RowNum
      FROM
        solicitud AS sol
        JOIN Solicitud_has_Estado AS she ON she.SEstSolicitudId = sol.solId
        JOIN Estado AS est ON she.SEstdEstadoId = est.EstId
        JOIN tramite AS tra ON sol.SolTramiteId = tra.TraId
      WHERE
        sol.SolEstNumeroDocumento = 1001301429
    )
    SELECT
      SolId,
      EstNombreEstado,
      traNombre,
      SolFechaEstimadaRespuesta
    FROM
      UltimoEstadoSolicitud
    WHERE
      RowNum = 1;`, [numeroDocumento]);

    const solicitudes = solicitudesResults;
    console.log(solicitudes);

    // Renderizar la vista y pasar los resultados
    res.render('mis_solicitudes', { solicitudes, usuario });
  } catch (error) {
    console.error('Error en la ruta /mis_solicitudes:', error);
    return res.status(500).send('Error en la ruta /mis_solicitudes');
  }
});

// Función para realizar una consulta a la base de datos de manera asíncrona
function queryAsync(sql, values) {
  return new Promise((resolve, reject) => {
    conexion.query(sql, values, function(error, results, fields) {
      if (error) {
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
}


//middleware :::::::::::::::::::::::::::::
app.use(express.static("public"));

//configurar el puerto usado para el servidor local:::::::::::::::::::::::::::::
app.listen(3000, function(){
    console.log("El servidor es http://localhost:3000")
});

