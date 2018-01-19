var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);
var bodyParser = require('body-parser');
var cookierParser = require('cookie-parser');
var session = require('express-session');
var bcrypt = require('bcrypt-nodejs');
var nodemailer = require('nodemailer');
var auth = require('./controllers/htpasswd');

NODE_TLS_REJECT_UNAUTHORIZED='0';

var agences = require('./controllers/agences');

express.static('/views/assets/');

app.use(express.static(__dirname + '/views/assets'));

app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());

app.use(cookierParser());

app.use(session({
    key: 'arthurimmo',
    secret: 'secret',
    resave: false,
    saveUninitialized: false
}));


var tabAgencesCouleurs = new Array();

app.use((req, res, next) => {
    if (req.cookies.user_sid && !req.session.user) {
    res.clearCookie('user_sid');
}
next();
});

var sessionChecker = (req, res, next) => {
    if (req.session.user) {
        var allAgences;
        agences.getAllAgences(function(err, result) {
            if (err) return res(err);
            allAgences = result;
            for (var i=0; i<allAgences.length; i++) {
                var id_agence = 'col'+allAgences[i].id_agence;
                tabAgencesCouleurs[id_agence] = allAgences[i].code_couleur;
            }
            res.render('index.ejs', {agences: allAgences, session_mode: req.session.user});
        })
    } else {
        next();
    }
}

/* On utilise les sessions */
app.get('/', function(req, res) {
	if (!req.session.user) {
        res.render('login.ejs', {error_message: false});
    }
    else {
		res.redirect('/home');
	}
});

app.post('/authentication', function (req, res) {
	if (req.body.user == 'admin') {
        bcrypt.compare(req.body.password, auth.admin.password, function(err, response) {
            if (response) {
                req.session.user = 'logged_admin';
                res.redirect('/home');
            }
            else {
                res.render('login.ejs', {error_message: 'Mauvais identifiants !'})
            }
        })
	}
	else if (req.body.user == 'visiteur') {
		bcrypt.compare(req.body.password, auth.visiteur.password, function(err, response) {
			if (response) {
				req.session.user = 'logged_visitor';
				res.redirect('/home');
			}
			else {
				res.render('login.ejs', {error_message: 'Mauvais identifiants !'})
			}
		})
	}
	else {
	res.render('login.ejs', {error_message: 'Mauvais identifiants !'})
    }
});

app.get('/logout', function (req, res) {
    req.session.destroy(function(err) {
        res.redirect('/');
    })
});

app.get('/home', sessionChecker, function (req, res) {
	res.redirect('/');
});

app.post('/add_agence', function (req, res) {
	var agenceInfos = req.body;
	agences.addAgence(agenceInfos, function (err, result) {
        if (err) return res(err);
        tabAgencesCouleurs['col'+result[0].id_agence] = result[0].code_couleur;
        res.json(result);
    })
});

app.get('/agence/:agenceId', function (req, res) {
	var id = req.params.agenceId;
	agences.getAgenceLight(id, function (err, result) {
		if (err) return res(err);
		res.json(result);
    })
});

app.delete('/del_agence/:agenceId', function (req, res) {
	var id_agence = req.params.agenceId;
	agences.deleteAgence(id_agence, function (err, result) {
		if (err) return res(err);
		res.send(result);
    });
});

app.post('/edit_agence', function (req, res) {
    var agenceInfos = req.body;
	agences.editAgence(agenceInfos, function (err, result) {
        if (err) return res(err);
        res.send(result);
    })
});


app.post('/sendmail', function (req, res) {
    var response;
    let transporter = nodemailer.createTransport({
        service: 'gmail',
        port: 587,
        secure: false,
        auth: {
            user: 'fredericferri.kelquartier@gmail.com',
            pass: '#ny4hm4n#'
        },
        tls: {
            rejectUnauthorized: false
        },
        logger: false,
        debug: false
    });
    let mailOptions = {
        from: '"ArthurImmo Appli" <fredericferri.kelquartier@gmail.com>', // sender address
        to: 'frederic.ferri@kelquartier.com', // list of receivers
        subject: 'Arthurimmo Appli', // Subject line
        text: req.body.message, // plain text body
        html: req.body.message+'<br /><b>Demande provenant de l\'appli Arthurimmo</b><br /><b>Adresse mail de la personne ayant fait la demande: '+req.body.email+'</b>' // html body
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return console.log(error);
            response = 'Erreur lors de l\'envoi du message';
        }
        else {
            response = 'Votre message a bien été envoyé';
        }
    res.send(response);
});

    return false;
});


io.sockets.on('connection', function(socket) {
	// Selection d'une agence
	socket.on('selectAgence', function(agence_id) {
		agences.getAgence(agence_id, function(err, datas) {
			if (err) throw err;
			agences.loadAgence(datas, agence_id, function(err, agenceInfos, zoneInfos) {
				if (err) throw err;
				socket.emit('agenceDatas', {datas: datas, agenceInfos: agenceInfos, zoneInfos: zoneInfos});
			});
		});
	});
	// Click sur un polygone
	socket.on('updatePoly', function(parameters) {
		if (parameters.mode == 'normal') {
			// Si le polygone n'appartenait jusqu'ici à aucune agence
			if (parameters.id_agence == 0) {
				parameters.id_agence = parameters.selectedAgence;
			}
			// Si le polygone cliqué appartenait déja à l'agence en quetsion
			else if (parameters.id_agence == parameters.selectedAgence) {
				parameters.id_agence = 0;
			}
			// Si le polygone cliqué appartenait à une autre agence
			else {
				parameters.id_agence = parameters.selectedAgence;
			}
		}
		
		// On met à jour l'attribution du polygone en base de données et on change sa couleur de remplissage
		agences.updatePolygone(parameters, function(err, updated_params) {
			if (err) throw err;
			var new_color = tabAgencesCouleurs['col'+updated_params.id_agence];
			if (new_color == null) {
				updated_params.couleur = '#ffffff';
			}
			else {
				updated_params.couleur = new_color;
			}
			socket.emit('updatedDatas', updated_params);
		})
	});	
});

server.listen(8080);