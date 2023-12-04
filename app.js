// Importar la libreria:::::::::::::::::::::::::::::
const express = require("express");

const mysql = require("mysql2");

//objetos para llamar los métodos de express:::::::::::::::::::::::::::::
const app = express();

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
          res.redirect('/dashboard');
        } else {
          // Redirigir a la página de inicio de sesión con un mensaje de error
          res.render('index', { error: 'Credenciales incorrectas' });
        }

    });
});

// Ruta para manejar la página de dashboard
app.get('/dashboard', function (req, res) {
    // Puedes hacer consultas a la base de datos u otras operaciones necesarias aquí
    res.render('dashboard');
});


//middleware :::::::::::::::::::::::::::::
app.use(express.static("public"));

//configurar el puerto usado para el servidor local:::::::::::::::::::::::::::::
app.listen(3000, function(){
    console.log("El servidor es http://localhost:3000")
});
