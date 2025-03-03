const express = require('express');
const multer = require('multer');
const handlebars = require('express-handlebars');
const { Server } = require('socket.io');
const bodyParser = require('body-parser');
const router = require('./router');
const FilesDao = require('./dao/files.dao');
const cookieParser = require('cookie-parser');
const mongoConnect = require('./db');
const { cookieKey, PORT } = require('./config/config');
const session = require('express-session');
const fileStore = require('session-file-store');
const mongoStore = require('connect-mongo');
const fileStorage = fileStore(session);
const connectedUsers = new Set();
const chatFile = new FilesDao('chats.json');
const initializePassport = require('./config/passport.config');
const { authToken } = require('./utils/jwt-utils');
const cors = require('cors');
const cartsRouter = require('./router/cartRoutes');
const chatRoutes = require('./router/chatRoutes');
const passport = require('passport');
const isUser = require('./middlewares/user.middlewares');
const compression = require('compression');
const logger = require('./middlewares/logger.middlewares');
const { customizeError } = require('./services/error.services');

let chats = [];

const app = express();

mongoConnect();
app.use(cors()); // Usa cors aquí
app.use(express.json());
app.use(cookieParser(cookieKey));
app.use(session({
    store: mongoStore.create({
        mongoUrl: 'mongodb+srv://admin:admin@cluster0.0mdumnn.mongodb.net/ecommerce?retryWrites=true&w=majority',
        ttl: 10000,
    }),
    secret: 'secretLeonel',
    resave: false,
    saveUninitialized: true,
}));
initializePassport();
app.use(passport.initialize());
app.use(passport.session());
app.use(compression({
    brotil: { enabled: true, zlib: {} }
}));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static(process.cwd() + '/src/public'));
app.use(express.static('public', { 'Content-Type': 'text/css' }));
app.engine('handlebars', handlebars.engine({
    runtimeOptions: {
        allowProtoPropertiesByDefault: true,
        allowProtoMethodsByDefault: true,
        defaultLayout: 'main',
    },
}));
app.use(logger)

// Configuración de multer para guardar los archivos en el directorio 'uploads'
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'images/'); // El directorio donde se guardarán los archivos
    },
    filename: function (req, file, cb) {
      cb(null, Date.now() + '-' + file.originalname); // Nombre del archivo
    }
  });
  
  const upload = multer({ storage: storage });
  
  // Ruta para manejar la subida de archivos
  app.post('/images', upload.single('image'), (req, res) => {
    // El archivo se ha subido correctamente y está disponible en req.file
    const file = req.file;
    // Haz lo que necesites con el archivo
    res.send('Archivo subido con éxito');
  });

app.get('/loggerTest', (req, res) => {
    try {
        req.logger.info('Inicia el servicio')
        req.logger.debug('Inicia el debug')
        req.logger.warning('Cuidado vamos para un error')
        throw new Error('Un error!!!')
        res.json({ message: 'Hi Coders!!!' })
    } catch (error) {
        req.logger.error(error.message)
        res.json({ message: error })
    }
})

app.get('/sencilla', (req, res) => {
    let result = 0
    for (let i = 0; i < 10000; i++) {
        result += i
    }

    res.json({ response: result })
})

app.get('/compleja', (req, res) => {
    let result = 0
    for (let i = 0; i < 5e7; i++) {
        result += i
    }

    res.json({ response: result })
})
app.set('views', process.cwd() + '/src/views');

// Colocar Passport antes de las rutas
router(app);

app.get('/', (req, res) => {
    res.redirect('/tienda/products');
});

app.use('/cart', cartsRouter);
app.use('/chat', isUser, chatRoutes);

app.get('/cookies/setCookies', (req, res) => {
    res.cookie('CoderCookie', 'Esta es una cookie poderosa', { maxAge: 10000 }).send("Cookie");
});

app.get('/cookies/getCookies', (req, res) => {
    res.json({ message: 'GET Cookies' });
});

app.get('/login/logout', (req, res) => {
    req.session.destroy();
    res.send('Sesión cerrada');
});

app.get('/cookies/deleteCookies', (req, res) => {
    res.clearCookie('CoderCookie').send('Cookie Removed');
});

app.get('/cookies/setSignedCookie', (req, res) => {
    res.cookie('SignedCookie', 'Esta es una cookie poderosa', { maxAge: 10000, signed: true }).send("Cookie");
});

async function loadChatsFromFile() {
    const data = await chatFile.getItems();
    chats = data.map((chat) => ({ ...chat, createdAt: new Date(chat.createdAt) }));
}

loadChatsFromFile();

const httpServer = app.listen(PORT, (err) => {
    if (err) {
        console.error(customizeError('SERVER_START_ERROR')); // Personaliza el mensaje de error
    }});

const io = new Server(httpServer);

io.on('connection', (socket) => {
    socket.on('newUser', (data) => {
        socket.username = data.username;
        connectedUsers.add(data.username);
        socket.emit('messageLogs', chats);
        io.emit('userConnected', { username: data.username, connectedUsers: Array.from(connectedUsers) });
    });

    socket.on('message', (data) => {
        const message = { ...data, createdAt: new Date() };
        chats.push(message);
        io.emit('messageLogs', chats);
        // Escribir los mensajes en el archivo chat.json
        chatFile.writeItems(chats);
    });

    socket.on('disconnect', () => {
        connectedUsers.delete(socket.username);
        io.emit('userDisconnected', { username: socket.username, connectedUsers: Array.from(connectedUsers) });

        // Crear un nuevo array de chats con la información de desconexión
        const disconnectionMessage = {
            username: socket.username,
            message: 'se ha desconectado',
            createdAt: new Date(),
        };

        chats.push(disconnectionMessage);
        io.emit('messageLogs', chats);
        // Escribir los mensajes en el archivo chat.json
        chatFile.writeItems(chats);
    });
});
